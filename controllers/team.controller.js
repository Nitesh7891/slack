import Team from '../models/Team.js';
import Task from '../models/Task.js';

// GET /api/teams
export const getTeams = async (req, res) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    res.status(200).json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/teams/:id
export const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found.' });
    res.status(200).json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/teams/:id/throughput
// Groups COMPLETED tasks by day-of-week for the last 7 days (real DB aggregate, not fake numbers).
export const getTeamThroughput = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const tasks = await Task.find({
      status: 'COMPLETED',
      updatedAt: { $gte: sevenDaysAgo },
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = {};
    dayNames.forEach((d) => (counts[d] = 0));

    tasks.forEach((t) => {
      const day = dayNames[new Date(t.updatedAt).getDay()];
      counts[day]++;
    });

    const points = dayNames.map((day) => ({ day, completed: counts[day], capacity: 8 }));
    res.status(200).json(points);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};