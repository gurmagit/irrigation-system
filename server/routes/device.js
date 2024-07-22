const express = require('express');
const router = express.Router();
const Device = require('../models/device.model');
const { operator } = require('../services/commander');
const scheduler = require('../scheduler');
const eventEmitter = require('../eventEmitter');

router.get('/action/:name/:cmd', getDevice, (req, res) => {
  try {
    const name = req.params.name;
    const cmd = req.params.cmd;
    operator.operateDevice(name, cmd, async (err, data) => {
      if (err) {
        res.status(400).send("err: " + err);
      } else {
        res.device.status = cmd;
        await res.device.save();
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
    const device = new Device(req.body);
    const newDevice = await device.save();
    scheduler.updateDeviceSchedules(device);
    res.status(201).json(newDevice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/updateName/:previousName', async (req, res) => {
  try {
    const device = await Device.findOne({ name: req.params.previousName });
    if (!device) {
      return res.status(404).json({ message: 'Cannot find device' });
    }
    const existingDevice = await Device.findOne({ name: req.body.name });
    if (existingDevice) {
      return res.status(400).json({ message: 'Device name already exists' });
    }
    device.name = req.body.name;
    scheduler.updateDeviceSchedules(device);
    await device.save();
    res.json(device);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/updateSchedule/:name', getDevice, async (req, res) => {
  if (req.body.schedules != null) {
    res.device.schedules = req.body.schedules;
  }
  try {
    const updatedDevice = await res.device.save();
    scheduler.updateDeviceSchedules(updatedDevice);
    res.json(updatedDevice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:name', getDevice, async (req, res) => {
  try {
    await Device.deleteOne({ name: res.device.name });
    res.json({ message: 'Deleted Device' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.use('/', async (req, res) => {
  console.log('getting devices ...');
  try {
    const devices = await Device.find();
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
    device = await Device.findOne({ name: req.params.name });
    if (device == null) {
      return res.status(404).json({ message: 'Cannot find device' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  res.device = device;
  next();
}

module.exports = router;
