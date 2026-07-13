import { WebClient } from '@slack/web-api';
import SlackIntegration from '../models/slackIntegration.model.js';
import { getSlackClient, fetchChannelMessages } from '../services/slack.service.js';
import dotenv from 'dotenv';
dotenv.config();

const { SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_REDIRECT_URI } = process.env;

// ─────────────────────────────────────────────
// GET /api/slack/install
// Redirects the user to Slack's OAuth consent page.
// ─────────────────────────────────────────────
export const installSlack = (req, res) => {
  const scopes = [
    'channels:read',
    'channels:history',
    'channels:join',
    'groups:read',
    'groups:history',
    'users:read',
    'users:read.email',
    'chat:write',
  ].join(',');

  const slackAuthUrl =
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${SLACK_CLIENT_ID}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}`;

  res.redirect(slackAuthUrl);
};

// ─────────────────────────────────────────────
// GET /api/slack/oauth/callback
// Slack sends the auth code here. Exchange it for an access token.
// ─────────────────────────────────────────────
export const slackOAuthCallback = async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.status(400).json({ error: error || 'No code received from Slack.' });
  }

  try {
    // Exchange code for access token
    const client = new WebClient();
    const oauthResult = await client.oauth.v2.access({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: SLACK_REDIRECT_URI,
    });

    if (!oauthResult.ok) {
      return res.status(400).json({ error: oauthResult.error });
    }

    const { access_token, team, bot_user_id, scope } = oauthResult;

    // Upsert integration record (one per Slack workspace)
    await SlackIntegration.findOneAndUpdate(
      { teamId: team.id },
      {
        teamId: team.id,
        teamName: team.name,
        accessToken: access_token,
        botUserId: bot_user_id,
        scope,
        connected: true,
      },
      { new: true, upsert: true }
    );

    console.log(`✅ Slack connected for workspace: ${team.name}`);
    res.status(200).json({
      message: `Slack connected successfully for workspace: ${team.name}`,
      workspace: team.name,
    });
  } catch (err) {
    console.error('❌ Slack OAuth error:', err.message);
    res.status(500).json({ error: 'Failed to complete Slack OAuth.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/slack/channels
// Returns a list of public channels the bot can see.
// ─────────────────────────────────────────────
export const getChannels = async (req, res) => {
  try {
    const client = await getSlackClient();
    const result = await client.conversations.list({
      types: 'public_channel,private_channel',
      limit: 100,
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    const channels = result.channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      isPrivate: ch.is_private,
      isMember: ch.is_member,
      memberCount: ch.num_members,
    }));

    res.status(200).json({ channels });
  } catch (err) {
    console.error('❌ getChannels error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/slack/channels/:channelId/messages
// Fetches real messages from a specific Slack channel.
// ─────────────────────────────────────────────
export const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const messages = await fetchChannelMessages(channelId, limit);

    res.status(200).json({
      channelId,
      count: messages.length,
      messages,
    });
  } catch (err) {
    console.error('❌ getChannelMessages error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/slack/channels/:channelId/join
// Makes the bot join a channel so it can read messages.
// ─────────────────────────────────────────────
export const joinChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const client = await getSlackClient();

    const result = await client.conversations.join({ channel: channelId });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.status(200).json({
      message: `Bot joined channel: ${result.channel.name}`,
      channel: { id: result.channel.id, name: result.channel.name },
    });
  } catch (err) {
    console.error('❌ joinChannel error:', err.message);
    res.status(500).json({ error: err.message });
  }
};