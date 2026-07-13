import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },

    slackChannelId: {
        type: String,
        unique: true,
        sparse: true,
    },

    slackChannelName: {
        type: String,
    },

    isSlackConnected: {
        type: Boolean,
        default: false,
    }
});
export default mongoose.model('Team', teamSchema);