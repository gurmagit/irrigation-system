const jwt = require('jsonwebtoken');
const config = require('./config.js');

function authenticateToken(req, res, next) {
  if (!req.headers.authorization) {
    return res.status(403).send("Not authorized");
  }
  const token = req.headers.authorization.split(' ')[1];
  console.log('headers:', req.headers.authorization, '\n', token);
  if (!token) return res.status(401).send({ message: 'Access denied' });
  jwt.verify(token, config.secret, (err, user) => {
    if (err) {
      console.log('err:', err.message);
      return res.status(403).send({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
