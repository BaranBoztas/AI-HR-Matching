import express from 'express';
import { getNotifications, markAsRead } from '../controllers/notificationController.js';
// notificationRoutes.js dosyasında düzeltilecek satır:
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, getNotifications);
router.put('/:id/read', authMiddleware, markAsRead);

export default router;
