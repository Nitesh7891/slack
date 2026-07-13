import mongoose from 'mongoose';

const dependencySchema = new mongoose.Schema({
  taskId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Task', 
    required: true 
  },
  dependsOnTaskId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Task', 
    required: true 
  },
  dependencyType: { 
    type: String, 
    enum: ['Blocks', 'Relates To'], 
    default: 'Blocks' 
  }
});

export default mongoose.model('Dependency', dependencySchema);