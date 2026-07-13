import { WebClient } from '@slack/web-api';
import SlackIntegration from '../models/slackIntegration.model.js';
import Team from '../models/Team.js';
import Member from '../models/Member.js';
import Standup from '../models/Standup.js';
import StandupMessage from '../models/StandupMessage.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';

// ─────────────────────────────────────────────
// Helper: get an authenticated Slack WebClient
// ─────────────────────────────────────────────
export const getSlackClient = async () => {
  const integration = await SlackIntegration.findOne({ connected: true });
  if (!integration) {
    throw new Error('Slack is not connected. Please complete the OAuth flow at /api/slack/install');
  }
  return new WebClient(integration.accessToken);
};

// ─────────────────────────────────────────────────────────────────────────────
// fetchChannelMessages
// Directly hits the Slack API and returns raw messages from a given channel.
// ─────────────────────────────────────────────────────────────────────────────
export const fetchChannelMessages = async (channelId, limit = 50) => {
  const client = await getSlackClient();

  // Pull recent messages
  const result = await client.conversations.history({
    channel: channelId,
    limit,
  });

  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error}`);
  }

  // Filter out bot messages and system messages; keep only real user messages
  const userMessages = result.messages.filter(
    (m) => m.type === 'message' && !m.subtype && m.user
  );

  // Resolve user info for each message (name, email)
  const enriched = await Promise.all(
    userMessages.map(async (msg) => {
      let userName = 'Unknown User';
      let email = null;

      try {
        const userInfo = await client.users.info({ user: msg.user });
        if (userInfo.ok) {
          userName =
            userInfo.user.real_name ||
            userInfo.user.profile?.display_name ||
            userInfo.user.name ||
            'Unknown User';
          email = userInfo.user.profile?.email || null;
        }
      } catch (err) {
        console.warn(`⚠️  Could not fetch user info for ${msg.user}:`, err.message);
      }

      return {
        slackUserId: msg.user,
        userName,
        email,
        rawMessage: msg.text,
        ts: msg.ts,
      };
    })
  );

  return enriched;
};

// ─────────────────────────────────────────────────────────────────────────────
// processSlackData
// Takes a structured payload { channel, messages } (either from a webhook or
// from our own fetchChannelMessages), saves everything to MongoDB, and returns
// the AI-ready formatted text.
// ─────────────────────────────────────────────────────────────────────────────
export async function processSlackData(slackPayload) {
  const { channel, messages } = slackPayload;

  if (!messages || messages.length === 0) {
    return { success: true, processedCount: 0, aiReadyText: '' };
  }

  // 1. Upsert the Team record using the Slack channel as the identifier
  const team = await Team.findOneAndUpdate(
    { slackChannelId: channel.channelId },
    {
      name: channel.channelName,
      slackChannelId: channel.channelId,
      slackChannelName: channel.channelName,
      isSlackConnected: true,
    },
    { new: true, upsert: true }
  );

  const compiledAiText = [];

  // 2. For each Slack message: upsert Member → create Standup → create StandupMessage
  for (const msg of messages) {
    // Skip empty messages
    if (!msg.rawMessage || msg.rawMessage.trim() === '') continue;

    // Find or create the member by their Slack user ID
    let member = await Member.findOne({ slackUserId: msg.slackUserId });

    if (!member) {
      // Slack doesn't always expose email; use a placeholder so required field is satisfied
      const safeEmail = msg.email || `${msg.slackUserId}@slack.placeholder`;

      member = await Member.create({
        name: msg.userName || 'Unknown User',
        email: safeEmail,
        slackUserId: msg.slackUserId,
        role: 'Developer',          // Default role — can be updated later via the member API
        teamId: team._id,
        isActive: true,
      });

      console.log(`👤 Created new member: ${member.name} (${member.slackUserId})`);
    } else if (!member.teamId) {
      // Existing member not yet linked to a team → link now
      member.teamId = team._id;
      await member.save();
    }

    // Create the parent Standup record
    const standup = await Standup.create({
      submittedBy: member._id,
      source: 'Slack',
      parsingStatus: 'Pending',
      message: msg.rawMessage,
      parsed: false,
    });

    // Create the child StandupMessage record
    await StandupMessage.create({
      standupId: standup._id,
      memberId: member._id,
      rawMessage: msg.rawMessage,
      parsed: false,
    });

    // Build the AI-readable string for this message
    compiledAiText.push(`Member: ${member.name}\nMessage: ${msg.rawMessage}\n---`);
  }

  const aiFormattedString = compiledAiText.join('\n');

  return {
    success: true,
    processedCount: messages.length,
    aiReadyText: aiFormattedString,
    teamId: team._id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// saveParsedTasksToDatabase
// Takes the AI output array and persists each task to the Task collection,
// linked to the correct Member and Standup. Also logs an Activity record.
// ─────────────────────────────────────────────────────────────────────────────
export async function saveParsedTasksToDatabase(parsedTasks) {
  const savedTasks = [];

  for (const taskData of parsedTasks) {
    try {
      // Match parsed owner name back to a Member document
      const member = await Member.findOne({
        name: { $regex: new RegExp(`^${taskData.owner}$`, 'i') },
      });

      if (!member) {
        console.warn(`⚠️  No member found for owner: "${taskData.owner}" — skipping task.`);
        continue;
      }

      // Find the most recent Standup for this member
      const latestStandup = await Standup.findOne({ submittedBy: member._id })
        .sort({ createdAt: -1 })
        .limit(1);

      if (!latestStandup) {
        console.warn(`⚠️  No standup found for member: ${member.name} — skipping task.`);
        continue;
      }

      // Map AI output fields to Task schema enums (with safe defaults)
      const status = normalizeStatus(taskData.status);
      const priority = normalizePriority(taskData.priority);
      const workflowStage = normalizeWorkflowStage(taskData.workflowStage);

      // Create the Task
      const task = await Task.create({
        memberId: member._id,
        standupId: latestStandup._id,
        title: taskData.taskName,
        description: taskData.blockerDescription || null,
        status,
        workflowStage,
        priority,
      });

      // Log an Activity for the task creation
      await Activity.create({
        taskId: task._id,
        actorType: 'AI_AGENT',
        actorId: 'gemini-standup-parser',
        activityType: 'STATUS_CHANGE',
        previousStatus: null,
        currentStatus: status,
        newValue: { title: task.title, priority, workflowStage },
        message: `Task created from Slack standup via AI parsing.`,
      });

      // Mark the StandupMessage as parsed
      await StandupMessage.findOneAndUpdate(
        { standupId: latestStandup._id, memberId: member._id },
        { parsed: true }
      );

      // Mark the Standup as completed
      await Standup.findByIdAndUpdate(latestStandup._id, {
        parsingStatus: 'Completed',
        parsed: true,
      });

      savedTasks.push(task);
      console.log(`✅ Saved task: "${task.title}" for ${member.name}`);
    } catch (err) {
      console.error(`❌ Error saving task "${taskData.taskName}":`, err.message);
    }
  }

  return savedTasks;
}

// ─────────────────────────────────────────────
// Normalisation helpers
// ─────────────────────────────────────────────

function normalizeStatus(raw = '') {
  const s = raw.toUpperCase();
  if (s === 'COMPLETED' || s === 'DONE' || s === 'FINISHED') return 'COMPLETED';
  if (s === 'BLOCKED' || s === 'WAITING' || s === 'STUCK') return 'BLOCKED';
  return 'PROCESSING';
}

function normalizePriority(raw = '') {
  const p = (raw || '').toLowerCase();
  if (p.includes('critical')) return 'Critical';
  if (p.includes('high') || p.includes('urgent')) return 'High';
  if (p.includes('low')) return 'Low';
  return 'Medium';
}

function normalizeWorkflowStage(raw = '') {
  const w = (raw || '').toUpperCase();
  if (w === 'QA' || w.includes('TEST')) return 'QA';
  if (w === 'REVIEW' || w.includes('PR') || w.includes('REVIEW')) return 'REVIEW';
  if (w === 'PRODUCTION' || w.includes('PROD') || w.includes('DEPLOY')) return 'PRODUCTION';
  return 'DEVELOPMENT';
}
