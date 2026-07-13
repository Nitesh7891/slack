import Activity from '../models/Activity.js';

// GET /api/activities/recent?limit=5
export const getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const activities = await Activity.find().sort({ createdAt: -1 }).limit(limit);
    res.status(200).json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};