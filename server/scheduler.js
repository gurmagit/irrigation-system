const nodeSchedule = require('node-schedule');
const Device = require('./models/device.model');
const { operator } = require('./services/commander');
const WebSocket = require('ws');
const eventEmitter = require('./eventEmitter');
const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

class Scheduler {
  constructor() {
    this.jobs = [];
  }

  async initialize() {
    eventEmitter.emit('notifyClient', JSON.stringify({message: "Hello"}));
    const devices = await Device.find();
    devices.forEach(device => {
      device.schedules.forEach(schedule => {
        this.scheduleJob(device.name, schedule);
      });
    });
  }

  scheduleJob(deviceName, schedule) {
    schedule.days.forEach(day => {
      let hour = schedule.startTime.split(':')[0];
      let minute = schedule.startTime.split(':')[1];
      let cron = `${minute} ${hour} * * ${weekday.indexOf(day)}`;
      const startJob = nodeSchedule.scheduleJob(cron, () => {
        operator.operateDevice(deviceName, 'open', (err, res) => {
          this.notifyClients(deviceName, 'open');
        });
      });
      hour = schedule.endTime.split(':')[0];
      minute = schedule.endTime.split(':')[1];
      cron = `${minute} ${hour} * * ${weekday.indexOf(day)}`;
      const endJob = nodeSchedule.scheduleJob(cron, () => {
        operator.operateDevice(deviceName, 'close', (err, res) => {
          this.notifyClients(deviceName, 'close');
        });
      });
      this.jobs.push({ deviceName, startJob, endJob });
    })
  }

  async updateDeviceSchedules(device) {
    this.jobs = this.jobs.filter(job => {
      if (job.deviceName === device.name) {
        job.startJob.cancel();
        job.endJob.cancel();
        return false;
      }
      return true;
    });
    device.schedules.forEach(schedule => {
      this.scheduleJob(device.name, schedule);
    });
  }

  notifyClients(deviceName, action) {
    console.log('notify client:', deviceName, action);
    const message = {deviceName, status: action};
    eventEmitter.emit('notifyClient', JSON.stringify(message));
    // wss.on('connection', function connection(ws) {
    //   ws.on('error', console.error);
    //   ws.send(JSON.stringify({ deviceName, action }));
    // });
  }
}

const scheduler = new Scheduler();
scheduler.initialize();

module.exports = scheduler;
