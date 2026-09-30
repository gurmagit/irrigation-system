require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const eventEmitter = require('./services/eventEmitter');
const { mqttService } = require('./services/mqttService');
const port = process.env.PORT_HTTP || 3000;
const authenticateToken = require('./routes/middleware');
const path = require('path');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', ws => {
  console.log('WebSocket connected');
  ws.send(JSON.stringify({ type: 'espStatus', online: mqttService.isEspConnected() }));
  const sensorData = mqttService.getSensorData();
  if (sensorData) ws.send(JSON.stringify({ type: 'sensorData', ...sensorData }));
  activeRuns.forEach((endTime, deviceName) => {
    ws.send(JSON.stringify({ type: 'timedRun', deviceName, endTime }));
  });
  const messageHandler = (message) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  };
  eventEmitter.on('notifyClient', messageHandler);
  ws.on('close', () => {
    console.log('WebSocket disconnected');
    eventEmitter.removeListener('notifyClient', messageHandler);
  });
});

app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true,
  methods: ['GET', 'POST']
}));
app.use(express.json());
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});
app.use('/api', (req, res, next) => {
  // API responses are dynamic state (device status, settings, logs) — never let a browser,
  // proxy, or CDN edge (e.g. Cloudflare Tunnel) cache them and serve stale data on refresh.
  res.set('Cache-Control', 'no-store');
  next();
});
const { router: deviceRoute, activeRuns } = require('./routes/device');
const authRoute = require('./routes/auth');
app.use('/api/devices', authenticateToken, deviceRoute);
app.use('/api/auth', authRoute);
app.use(express.static(path.join(__dirname, '../client/dist/irrigation-system')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/irrigation-system/index.html'));
});
server.listen(port, () => {
  console.log('server is listening on port', port);
});