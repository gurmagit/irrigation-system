const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  if (!req.headers.authorization) {
    return res.status(403).send("Not authorized");
  }
  const token = req.headers.authorization.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'Access denied' });
  jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
    if (err) {
      console.log('err:', err.message);
      return res.status(403).send({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
