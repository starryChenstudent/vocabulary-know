import type { Request, Response, NextFunction } from 'express';
import { isUserAdmin } from '../services/authService.js';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isUserAdmin(req.userId)) {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  next();
}
