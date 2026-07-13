import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  slackUserId: { 
    type: String, 
    default: null 
  },
  role: { 
    type: String, 
    required: true,
    enum: ['Developer', 'QA', 'ScrumMaster', 'CTO', 'Admin'] 
  },
  skills: { 
    type: [String], 
    default: [] 
  },
  teamId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Team', 
    default: null 
  },
  isActive: { 
    type: Boolean, 
    required: true, 
    default: true 
  }
}, { timestamps: true }); // Automatically creates createdAt and updatedAt

export default mongoose.model('Member', memberSchema);
