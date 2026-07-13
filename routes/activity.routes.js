import express from 'express';
import { getRecentActivity } from '../controllers/activity.controller.js';

const router = express.Router();

router.get('/recent', getRecentActivity);

export default router;