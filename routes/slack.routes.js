import express from 'express';
import {
  installSlack,
  slackOAuthCallback,
  getChannels,
  getChannelMessages,
  joinChannel,
} from '../controllers/slack.controller.js';
import { processSlackData, fetchChannelMessages, saveParsedTasksToDatabase } from '../services/slack.service.js';
import { parseStandupMessage } from '../services/parserService.js';
import { getSlackClient } from '../services/slack.service.js';

const router = express.Router();

// ─── OAuth ────────────────────────────────────────────
// Step 1: Visit this to start the Slack OAuth flow
router.get('/install', installSlack);

// Step 2: Slack redirects here with the auth code
router.get('/oauth/callback', slackOAuthCallback);

// ─── Channel Management ───────────────────────────────
// List all visible channels
router.get('/channels', getChannels);

// Fetch raw messages from a channel (for inspection/testing)
router.get('/channels/:channelId/messages', getChannelMessages);

// Make the bot join a channel
router.post('/channels/:channelId/join', joinChannel);

// ─── Full Pipeline Trigger ────────────────────────────
/**
 * POST /api/slack/channels/:channelId/process
 *
 * MAIN ENDPOINT — end-to-end pipeline:
 *   1. Fetch messages from Slack channel
 *   2. Save raw data to MongoDB (Team, Member, Standup, StandupMessage)
 *   3. Send to Gemini for AI parsing
 *   4. Save parsed tasks to MongoDB (Task, Activity)
 *
 * Query params:
 *   ?limit=50   (number of messages to fetch, default 50)
 */
router.post('/channels/:channelId/process', async (req, res) => {
  try {
    const { channelId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Step 1: Fetch messages from Slack
    console.log(`📥 Fetching up to ${limit} messages from channel ${channelId}...`);
    const rawMessages = await fetchChannelMessages(channelId, limit);

    if (rawMessages.length === 0) {
      return res.status(200).json({
        message: 'No messages found in channel.',
        processedCount: 0,
        tasks: [],
      });
    }

    // Get channel info for the Team record
    const client = await getSlackClient();
    const chanInfo = await client.conversations.info({ channel: channelId });
    const channelName = chanInfo.ok ? chanInfo.channel.name : channelId;

    // Step 2: Save raw data to MongoDB
    console.log(`💾 Saving ${rawMessages.length} message(s) to MongoDB...`);
    const slackPayload = {
      channel: { channelId, channelName },
      messages: rawMessages,
    };
    const { aiReadyText, processedCount } = await processSlackData(slackPayload);

    if (!aiReadyText) {
      return res.status(200).json({
        message: 'Messages saved but no text to parse.',
        processedCount,
        tasks: [],
      });
    }

    // Step 3: AI Parsing
    console.log('🤖 Sending to Gemini for parsing...');
    const parsedTasks = await parseStandupMessage(aiReadyText);

    // Step 4: Save tasks to MongoDB
    console.log(`📝 Saving ${parsedTasks.length} task(s) to MongoDB...`);
    const savedTasks = await saveParsedTasksToDatabase(parsedTasks);

    res.status(200).json({
      message: 'Slack standup pipeline completed successfully.',
      channelId,
      channelName,
      processedCount,
      parsedTaskCount: parsedTasks.length,
      savedTaskCount: savedTasks.length,
      tasks: savedTasks,
    });
  } catch (error) {
    console.error('❌ Pipeline error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Webhook (for Slack Event Subscriptions) ──────────
/**
 * POST /api/slack/webhook
 *
 * Used when Slack pushes data to you (Event Subscriptions / Slash Commands).
 * The body must have: { channel: { channelId, channelName }, messages: [...] }
 *
 * For testing, you can POST the same JSON manually.
 */
router.post('/webhook', async (req, res) => {
  try {
    // Slack sends a URL verification challenge on first setup
    if (req.body.type === 'url_verification') {
      return res.status(200).json({ challenge: req.body.challenge });
    }

    const { channel, messages } = req.body;

    if (!channel || !messages) {
      return res.status(400).json({
        error: 'Request body must include "channel" and "messages" fields.',
      });
    }

    // Step 1: Save to MongoDB
    const result = await processSlackData({ channel, messages });

    if (!result.aiReadyText) {
      return res.status(200).json({ message: 'No parseable messages found.', tasks: [] });
    }

    // Step 2: AI Parse
    const parsedTasks = await parseStandupMessage(result.aiReadyText);

    // Step 3: Save tasks
    const savedTasks = await saveParsedTasksToDatabase(parsedTasks);

    res.status(200).json({
      message: 'Webhook processed successfully.',
      processedCount: result.processedCount,
      savedTaskCount: savedTasks.length,
      tasks: savedTasks,
    });
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;