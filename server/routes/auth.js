const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('./config.js');

router.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (!user || !await bcrypt.compare(req.body.password, user.password)) {
      return res.status(400).send({ message: 'Invalid username or password' });
    }
    const token = jwt.sign({ id: user._id }, config.secret, { expiresIn: '12h' });
    res.send({ token });
  } catch (err) {
    res.status(500).send({ message: 'Error logging in', error: err.message });
  }
});

module.exports = router;
