import jwt from 'jsonwebtoken';
import config from '../config.js';
import { getDb } from '../db.js';

export function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ message: '未登录或登录已过期' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = getDb().users.find((u) => u.id === payload.id);
    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: '未登录或登录已过期' });
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.user = getDb().users.find((u) => u.id === payload.id);
    } catch (e) {
      req.user = null;
    }
  }
  next();
}
