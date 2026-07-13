import express from 'express';
import { getTasks, getTaskById,createTask, updateTaskStatus } from '../controllers/task.controller.js';

const router = express.Router();

router.get('/', getTasks);
router.get('/:id', getTaskById);
router.post('/', createTask);
router.patch('/:id/status', updateTaskStatus);

export default router;