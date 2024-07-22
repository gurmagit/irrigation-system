const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const eventEmitter = require('./eventEmitter');
const port = 3001;
const authenticateToken = require('./routes/middleware');

mongoose.connect('mongodb://localhost/irrigation', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('WebSocket connected');
  ws.send(JSON.stringify({message: 'test from server'}));
  ws.on('close', () => {
    console.log('WebSocket disconnected');
  });
  eventEmitter.on('notifyClient', message => {
    console.log('server received emitted message:', message);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
});

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

const deviceRoute = require('./routes/device');
const authRoute = require('./routes/auth');
app.use('/api/devices', authenticateToken, deviceRoute);
app.use('/api/auth', authRoute);

server.listen(port, () => {
  console.log('server is listening on port', port);
});