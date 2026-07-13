import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import taskRoutes from './routes/task.routes.js';
import memberRoutes from './routes/member.routes.js';
import teamRoutes from './routes/team.routes.js';
import activityRoutes from './routes/activity.routes.js';
import standupRoutes from './routes/standup.routes.js';
import slackRoutes from './routes/slack.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js'; // ← the new one

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:4200', // Replace with your frontend URL
}))

app.use('/api/tasks', taskRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/standups', standupRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/dashboard', dashboardRoutes); // ← add this line

mongoose.connect(process.env.MONGO_URI).then(() => console.log('Mongo connected'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));