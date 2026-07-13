import Member from '../models/Member.js';
import Task from '../models/Task.js';

// GET /api/members?isActive=true&teamId=...
export const getMembers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.teamId) filter.teamId = req.query.teamId;

    const members = await Member.find(filter).sort({ name: 1 });
    res.status(200).json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/members/:id
export const getMemberById = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found.' });
    res.status(200).json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/members/:id/stats
// Real-time workload numbers for the Team page: how many tasks this member
// currently owns, how many are blocked, and how many they finished today.
export const getMemberStats = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await Member.findById(id);
    if (!member) return res.status(404).json({ error: 'Member not found.' });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [current, blocked, doneToday] = await Promise.all([
      Task.countDocuments({ memberId: id, status: { $ne: 'COMPLETED' } }),
      Task.countDocuments({ memberId: id, status: 'BLOCKED' }),
      Task.countDocuments({ memberId: id, status: 'COMPLETED', updatedAt: { $gte: startOfDay } }),
    ]);

    // Workload is an approximation: active tasks against an assumed capacity of 6.
    const capacity = 6;
    const workloadPercent = Math.min(100, Math.round((current / capacity) * 100));

    res.status(200).json({
      memberId: id,
      current,
      blocked,
      doneToday,
      workloadPercent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
