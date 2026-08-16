import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, nextId, save, now } from '../db.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

function publicUser(u) {
  return { id: u.id, username: u.username, email: u.email, createdAt: u.createdAt };
}

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  const db = getDb();
  if (db.users.some((u) => u.username === username)) {
    return res.status(409).json({ message: '用户名已存在' });
  }
  if (email && db.users.some((u) => u.email === email)) {
    return res.status(409).json({ message: '邮箱已被注册' });
  }
  const user = {
    id: `user_${nextId('user')}`,
    username,
    email: email || '',
    password: await bcrypt.hash(password, 10),
    createdAt: now()
  };
  db.users.push(user);
  save();
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const db = getDb();
  const user = db.users.find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password || '', user.password))) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

export default router;
