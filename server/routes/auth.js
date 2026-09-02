const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sqlite } = require('../services/db');
const authenticateToken = require('./middleware');

router.post('/login', async (req, res) => {
  try {
    const user = sqlite.getUser(req.body.username);
    if (!user || !await bcrypt.compare(req.body.password, user.password)) {
      return res.status(400).send({ message: 'Invalid username or password' });
    }
    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.TOKEN_SECRET, { expiresIn: '12h' });
    res.send({ token });
  } catch (err) {
    res.status(500).send({ message: 'Error logging in', error: err.message });
  }
});

router.get('/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });
  try {
    res.json(sqlite.getUsers());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
    if (sqlite.getUser(username)) return res.status(409).json({ message: 'Username already exists' });
    const hashed = await bcrypt.hash(password, 10);
    sqlite.addUser(username, hashed);
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/users/:username', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });
  const target = sqlite.getUser(req.params.username);
  if (target?.role === 'admin') return res.status(403).json({ message: 'Cannot delete an admin user' });
  try {
    sqlite.deleteUser(req.params.username);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
