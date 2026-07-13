import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  memberId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Member', 
    required: true 
  },
  standupId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Standup', 
    required: false
  },
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: null 
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['PROCESSING', 'COMPLETED', 'BLOCKED'], 
    default: 'PROCESSING' 
  },
  workflowStage: { 
    type: String, 
    required: true, 
    enum: ['DEVELOPMENT', 'QA', 'REVIEW', 'PRODUCTION'], 
    default: 'DEVELOPMENT' 
  },
  priority: { 
    type: String, 
    required: true, 
    enum: ['Low', 'Medium', 'High', 'Critical'], 
    default: 'Medium' 
  },
  deadline: { 
    type: Date, 
    default: null 
  }
}, { timestamps: true });

export default mongoose.model('Task', taskSchema);
