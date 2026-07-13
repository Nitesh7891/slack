import express from 'express';
import { getMembers, getMemberById, getMemberStats } from '../controllers/member.controller.js';

const router = express.Router();

router.get('/', getMembers);
router.get('/:id/stats', getMemberStats);
router.get('/:id', getMemberById);

export default router;
