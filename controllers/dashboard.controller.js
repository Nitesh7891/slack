import Task from '../models/Task.js';

// GET /api/dashboard/summary
// Powers the 5 stat cards at the top of the dashboard (Total / In Progress /
// Completed / Blocked / Due Today). All real aggregates, no placeholder numbers.
export const getDashboardSummary = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const startOfYesterday = new Date(startOfDay);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const [
      totalTasks,
      inProgress,
      completed,
      blocked,
      dueToday,
      createdToday,
      createdYesterday,
      completedToday,
    ] = await Promise.all([
      Task.countDocuments({}),
      Task.countDocuments({ status: 'PROCESSING' }),
      Task.countDocuments({ status: 'COMPLETED' }),
      Task.countDocuments({ status: 'BLOCKED' }),
      Task.countDocuments({ deadline: { $gte: startOfDay, $lte: endOfDay }, status: { $ne: 'COMPLETED' } }),
      Task.countDocuments({ createdAt: { $gte: startOfDay } }),
      Task.countDocuments({ createdAt: { $gte: startOfYesterday, $lt: startOfDay } }),
      Task.countDocuments({ status: 'COMPLETED', updatedAt: { $gte: startOfDay } }),
    ]);

    res.status(200).json({
      totalTasks,
      inProgress,
      completed,
      blocked,
      dueToday,
      // Simple day-over-day delta, used for the small "+N%" / "+N" hints in the UI.
      taskGrowth: createdYesterday > 0
        ? Math.round(((createdToday - createdYesterday) / createdYesterday) * 100)
        : createdToday > 0 ? 100 : 0,
      completedTodayDelta: completedToday,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
