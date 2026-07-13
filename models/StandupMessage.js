import mongoose from 'mongoose';

const standupMessageSchema = new mongoose.Schema({
  standupId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Standup', 
    required: true 
  },
  memberId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Member', 
    required: true 
  },
  rawMessage: { 
    type: String, 
    required: true 
  },
  parsed: { 
    type: Boolean, 
    required: true, 
    default: false 
  }
});

export default mongoose.model('StandupMessage', standupMessageSchema);