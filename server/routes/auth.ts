import { Router } from 'express';
import {
  register,
  login,
  logout,
  getUserById,
  getSessionCookieName,
  getSessionCookieOptions,
  getClearSessionCookieOptions,
  isRegistrationAllowed,
  parseCookies,
  AuthError,
} from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/registration-status', (_req, res) => {
  res.json({ allowed: isRegistrationAllowed() });
});

router.post('/register', (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: '请填写用户名和密码' });
    return;
  }

  try {
    const { user, token } = register(String(username), String(password));
    res.setHeader('Set-Cookie', `${getSessionCookieName()}=${token}; ${getSessionCookieOptions()}`);
    res.json(user);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: '请填写用户名和密码' });
    return;
  }

  try {
    const { user, token } = login(String(username), String(password));
    res.setHeader('Set-Cookie', `${getSessionCookieName()}=${token}; ${getSessionCookieOptions()}`);
    res.json(user);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post('/logout', requireAuth, (req, res) => {
  const token = parseCookies(req)[getSessionCookieName()];
  if (token) logout(token);
  res.setHeader('Set-Cookie', `${getSessionCookieName()}=${getClearSessionCookieOptions()}`);
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) {
    res.status(401).json({ error: '用户不存在' });
    return;
  }
  res.json(user);
});

export default router;
