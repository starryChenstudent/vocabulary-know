import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getAdminStats,
  listUsersWithStats,
  deleteUserById,
  assertCanDeleteUser,
  assertUserExists,
} from '../services/adminService.js';
import { updateUserPassword, AuthError } from '../services/authService.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', (_req, res) => {
  res.json(getAdminStats());
});

router.get('/users', (_req, res) => {
  res.json(listUsersWithStats());
});

router.put('/users/:id/password', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { password } = req.body ?? {};
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: '请提供新密码' });
    return;
  }

  try {
    assertUserExists(userId);
    updateUserPassword(userId, password);
    res.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.delete('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  try {
    assertCanDeleteUser(userId, req.userId);
    const ok = deleteUserById(userId);
    if (!ok) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
