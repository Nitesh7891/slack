import mongoose from 'mongoose';

/**
 * Stores the Slack OAuth access token for a connected workspace.
 * Only one active integration is expected at a time (connected: true).
 */
const slackIntegrationSchema = new mongoose.Schema({
  teamId: {
    type: String,
    required: true,
    unique: true,        // One record per Slack workspace
  },
  teamName: {
    type: String,
    default: null,
  },
  accessToken: {
    type: String,
    required: true,
  },
  botUserId: {
    type: String,
    default: null,
  },
  scope: {
    type: String,
    default: null,
  },
  connected: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

export default mongoose.model('SlackIntegration', slackIntegrationSchema);