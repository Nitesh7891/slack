import Task from '../models/Task.js';

// GET /api/tasks?memberId=&status=&priority=&standupId=&teamId=
export const getTasks = async (req, res) => {
  try {
    const filter = {};
    if (req.query.memberId) filter.memberId = req.query.memberId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.standupId) filter.standupId = req.query.standupId;

    const tasks = await Task.find(filter)
      .populate('memberId', 'name role email')
      .sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('memberId', 'name role email');
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.status(200).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/tasks
// Manual task creation from the dashboard "Create Task" button.
export const createTask = async (req, res) => {
  try {
    const { memberId, title, description, status, workflowStage, priority, deadline, standupId } = req.body;

    if (!memberId || !title) {
      return res.status(400).json({ error: 'memberId and title are required.' });
    }

    const task = await Task.create({
      memberId,
      standupId: standupId || null,
      title,
      description: description || null,
      status: status || 'PROCESSING',
      workflowStage: workflowStage || 'DEVELOPMENT',
      priority: priority || 'Medium',
      deadline: deadline || null,
    });

    const populated = await task.populate('memberId', 'name role email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateTaskStatus = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    ).populate('memberId', 'name role email');
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.status(200).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
