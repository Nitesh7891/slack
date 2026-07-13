import mongoose from 'mongoose';

const standupSchema = new mongoose.Schema({
  submittedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Member', 
    required: false 
  },
  source: { 
    type: String, 
    enum: ['Manual', 'Slack', 'API'], 
    default: 'Manual' 
  },
  parsingStatus: { 
    type: String, 
    required: true, 
    enum: ['Pending', 'Processing', 'Completed', 'Failed'], 
    default: 'Pending' 
  },
  message: { 
    type: String, 
    default: null 
  },
  parsed: { 
    type: Boolean, 
    required: true, 
    default: false 
  }
}, { timestamps: { createdAt: true, updatedAt: false } }); // Only logs submission intake timestamp

export default mongoose.model('Standup', standupSchema);
