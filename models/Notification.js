import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  taskId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Task', 
    default: null 
  },
  recipientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Member', 
    required: true 
  },
  senderType: { 
    type: String, 
    enum: ['AI', 'SYSTEM', 'USER'], 
    default: 'SYSTEM' 
  },
  channel: { 
    type: String, 
    enum: ['Slack', 'Email', 'App'], 
    required: true 
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['Queued', 'Sent', 'Delivered', 'Read', 'Failed'], 
    default: 'Queued' 
  }
}, { timestamps: { createdAt: true, updatedAt: false } });
export default mongoose.model('Notification', notificationSchema);