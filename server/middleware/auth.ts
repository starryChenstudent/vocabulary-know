import type { Request, Response, NextFunction } from 'express';
import {
  validateSession,
  getSessionCookieName,
  getClearSessionCookieOptions,
  parseCookies,
} from '../services/authService.js';

declare global {
  namespace Express {
    interface Request {
      userId: number;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = parseCookies(req)[getSessionCookieName()];
  if (!token) {
    res.status(401).json({ error: '请先登录' });
    return;
  }

  const userId = validateSession(token);
  if (!userId) {
    res.setHeader('Set-Cookie', `${getSessionCookieName()}=${getClearSessionCookieOptions()}`);
    res.status(401).json({ error: '登录已过期，请重新登录' });
    return;
  }

  req.userId = userId;
  next();
}
