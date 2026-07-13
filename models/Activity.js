import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  taskId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Task', 
    required: true 
  },
  actorType: { 
    type: String, 
    enum: ['USER', 'AI_AGENT', 'SYSTEM'], 
    default: 'SYSTEM' 
  },
  actorId: { 
    type: mongoose.Schema.Types.Mixed, // Can hold a Member ObjectId string or 'AI_AGENT' token name
    default: null 
  },
  activityType: { 
    type: String, 
    enum: ['STATUS_CHANGE', 'COMMENT', 'NOTIFICATION', 'FOLLOWUP'], 
    default: 'STATUS_CHANGE' 
  },
  previousStatus: { 
    type: String, 
    default: null 
  },
  currentStatus: { 
    type: String, 
    default: null 
  },
  oldValue: { 
    type: mongoose.Schema.Types.Mixed, 
    default: null 
  },
  newValue: { 
    type: mongoose.Schema.Types.Mixed, 
    default: null 
  },
  message: { 
    type: String, 
    default: null // Houses comment text when activityType = 'COMMENT'
  }
}, { timestamps: true });

export default mongoose.model('Activity', activitySchema);