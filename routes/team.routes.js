import express from 'express';
import { getTeams, getTeamById, getTeamThroughput } from '../controllers/team.controller.js';

const router = express.Router();

router.get('/', getTeams);
router.get('/:id', getTeamById);
router.get('/:id/throughput', getTeamThroughput);

export default router;