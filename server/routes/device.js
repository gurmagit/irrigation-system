const express = require('express');
const router = express.Router();
const activeRuns = new Map();
const util = require('util');
const { operator } = require('../services/commander');
const { mqttService } = require('../services/mqttService');
const { sqlite } = require('../services/db');
const scheduler = require('../services/scheduler');
const eventEmitter = require('../services/eventEmitter');

router.get('/action/:name/:cmd', getDevice, async (req, res) => {
  try {
    const online = await mqttService.pingEsp();
    if (!online) return res.status(503).json({ message: 'ESP is offline' });
    const name = req.params.name;
    const cmd = req.params.cmd;
    operator.operateDevice(name, cmd, async (err, data) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      } else {
        sqlite.updateDeviceStatus(name, cmd);
        try {
          if (cmd === 'open') sqlite.logValveOpen(name);
          else if (cmd === 'close') sqlite.logValveClose(name);
        } catch (e) { console.error('Log error:', e); }
        res.status(201).json(data);
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  console.log('post:', req.body)
  try {
    const device = req.body;
    sqlite.addDevice(device.name);
    sqlite.addSchedules(device.name, device.schedules);
    scheduler.updateDeviceSchedules(device.name);
    res.status(201).json(device);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/updateSchedule/:name', getDevice, async (req, res) => {
  try {
    const device = res.device;
    if (!device) {
      return res.status(404).json({ message: 'Cannot find device' });
    }
    if (req.body.schedules != null) {
      res.device.schedules = req.body.schedules;
    }
    sqlite.updateSchedules(device.name, device.schedules);
    scheduler.updateDeviceSchedules(device.name);
    res.json(device);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/updateName/:name', getDevice, async (req, res) => {
  try {
    const device = res.device;
    if (device.name == req.body.name) {
      return res.status(200).json({ message: 'Names are the same' });
    }
    if (!device) {
      return res.status(404).json({ message: 'Cannot find device' });
    }
    const existingDevice = sqlite.getDevice(req.body.name);
    if (existingDevice) {
      return res.status(400).json({ message: 'Device name already exists' });
    }
    sqlite.updateDeviceName(device.name, req.body.name);
    device.name = req.body.name;
    res.json(device);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:name/schedules', getDevice, async (req, res) => {
  try {
    sqlite.deleteSchedules(req.params.name);
    scheduler.updateDeviceSchedules(req.params.name);
    res.json({ message: 'Schedules deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:name', getDevice, async (req, res) => {
  try {
    if (!res.device) {
      return res.status(404).json({ message: 'Cannot find device' });
    }
    sqlite.deleteDevice(req.params.name);
    res.json({ message: req.params.name + ' Deleted!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/logs', (req, res) => {
  try {
    res.json(sqlite.getValveLogs());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/logs/all', (_req, res) => {
  try {
    res.json(sqlite.getAllValveLogs());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/esp-status', async (_req, res) => {
  const online = await mqttService.pingEsp();
  res.json({ online });
});

router.get('/sensors', (_req, res) => {
  res.json(mqttService.getSensorData() || {});
});

router.get('/night-mode', (_req, res) => {
  res.json(sqlite.getNightMode());
});

router.post('/night-mode', (req, res) => {
  const { enabled, start, end } = req.body;
  sqlite.setNightMode(enabled, start, end);
  scheduler.updateNightMode();
  res.json({ message: 'Night mode updated' });
});

router.get('/system-enabled', (_req, res) => {
  res.json({ enabled: sqlite.getSystemEnabled() });
});

router.post('/system-enabled', (req, res) => {
  const enabled = !!req.body.enabled;
  sqlite.setSystemEnabled(enabled);
  res.json({ enabled });
});

router.get('/pulse-ms', (_req, res) => {
  res.json({ pulse_ms: sqlite.getPulseMs() });
});

router.post('/pulse-ms', (req, res) => {
  const ms = parseInt(req.body.pulse_ms);
  if (!ms || ms < 20 || ms > 2000) return res.status(400).json({ message: 'pulse_ms must be 20–2000' });
  sqlite.setPulseMs(ms);
  res.json({ pulse_ms: ms });
});

router.post('/sensors/refresh', (_req, res) => {
  try {
    mqttService.publishSensorsRefresh();
    res.json({ message: 'Refresh requested' });
  } catch (err) {
    res.status(503).json({ message: err.message });
  }
});

router.post('/resetStatuses', (_req, res) => {
  try {
    sqlite.resetAllDeviceStatuses();
    res.json({ message: 'All statuses reset' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

router.post('/run', async (req, res) => {
  const { name, minutes } = req.body;
  if (!name || !minutes) return res.status(400).json({ message: 'name and minutes required' });
  const online = await mqttService.pingEsp();
  if (!online) return res.status(503).json({ message: 'ESP is offline' });

  const device = sqlite.getDevice(name);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (device.status === 'open') return res.status(409).json({ message: `${name} is already running` });

  const allSchedules = sqlite.getSchedules();
  const now = new Date();
  const runEnd = new Date(now.getTime() + minutes * 60 * 1000);
  const today = weekdays[now.getDay()];

  for (const schedule of allSchedules) {
    if (schedule.day !== today) continue;
    const [sh, sm] = schedule.startTime.split(':').map(Number);
    const [eh, em] = schedule.endTime.split(':').map(Number);
    const schedStart = new Date(now); schedStart.setHours(sh, sm, 0, 0);
    const schedEnd = new Date(now); schedEnd.setHours(eh, em, 0, 0);
    if (now < schedEnd && runEnd > schedStart) {
      return res.status(409).json({ message: `Overlaps with ${schedule.deviceName} scheduled at ${schedule.startTime}–${schedule.endTime}` });
    }
  }

  operator.operateDevice(name, 'open', (err) => {
    if (err) return res.status(400).json({ message: err.message });
    try { sqlite.logValveOpen(name); } catch (e) { console.error('Log error:', e); }
    sqlite.updateDeviceStatus(name, 'open');
    const endTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    activeRuns.set(name, endTime);
    eventEmitter.emit('notifyClient', JSON.stringify({ deviceName: name, status: 'open' }));
    eventEmitter.emit('notifyClient', JSON.stringify({ type: 'timedRun', deviceName: name, endTime }));
    res.json({ message: `${name} will run for ${minutes} minutes` });
    setTimeout(() => {
      operator.operateDevice(name, 'close', (closeErr) => {
        if (!closeErr) {
          activeRuns.delete(name);
          try { sqlite.logValveClose(name); } catch (e) { console.error('Log error:', e); }
          sqlite.updateDeviceStatus(name, 'close');
          eventEmitter.emit('notifyClient', JSON.stringify({ deviceName: name, status: 'close' }));
        }
      });
    }, minutes * 60 * 1000);
  });
});

router.post('/sleep', (req, res) => {
  try {
    const minutes = req.body.minutes ?? 60;
    mqttService.publishSleep(minutes);
    res.json({ message: `Sleep command sent for ${minutes} minutes` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.use('/', async (req, res) => {
  try {
    const gs = sqlite.getGroupedSchedules();
    const devices = gs.map(row => ({
      name: row.name,
      status: row.status,
      schedules: JSON.parse(row.schedules)
        .filter(s => s.startTime !== null)
        .map(schedule => ({
          ...schedule,
          days: schedule.days.split(',')
        }))
    }))
    res.json(devices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
  eventEmitter.emit('notifyClient', JSON.stringify({message: "from router"}));
});

async function getDevice(req, res, next) {
  console.log('getDevice:', req.url, req.params);
  let device;
  try {
    device = sqlite.getDevice(req.params.name);
    if (device == null) {
      return res.status(404).json({ message: 'Cannot find device' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  res.device = device;
  next();
}

module.exports = { router, activeRuns };
