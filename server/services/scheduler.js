const nodeSchedule = require('node-schedule');
const { operator } = require('../services/commander');
const { sqlite } = require('./db');
const { mqttService } = require('./mqttService');
const eventEmitter = require('./eventEmitter');
const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

class Scheduler {
  constructor() {
    this.jobs = [];
    this.nightModeJob = null;
  }

  async initialize() {
    eventEmitter.emit('notifyClient', JSON.stringify({message: "Hello"}));
    const schedules = sqlite.getSchedules();
    if (schedules) {
      schedules.forEach(schedule => {
        this.scheduleJob(schedule.deviceName, schedule);
      });
    }
    this.scheduleNightMode();
  }

  scheduleNightMode() {
    if (this.nightModeJob) {
      this.nightModeJob.cancel();
      this.nightModeJob = null;
    }
    const nm = sqlite.getNightMode();
    if (!nm.enabled) return;
    const [hour, minute] = nm.start.split(':').map(Number);
    this.nightModeJob = nodeSchedule.scheduleJob(`${minute} ${hour} * * *`, () => {
      const current = sqlite.getNightMode();
      if (!current.enabled) return;
      const [sh, sm] = current.start.split(':').map(Number);
      const [eh, em] = current.end.split(':').map(Number);
      let duration = (eh * 60 + em) - (sh * 60 + sm);
      if (duration <= 0) duration += 24 * 60;
      try {
        mqttService.publishSleep(duration);
        sqlite.logEspEvent('sleep');
      } catch (e) { console.error('Night mode sleep error:', e.message); }
    });
    console.log(`Night mode scheduled: sleep at ${nm.start}, wake at ${nm.end}`);
  }

  updateNightMode() {
    this.scheduleNightMode();
  }

  scheduleJob(deviceName, schedule) {
    let hour = schedule.startTime.split(':')[0];
    let minute = schedule.startTime.split(':')[1];
    let cron = `${minute} ${hour} * * ${weekday.indexOf(schedule.day)}`;
    const startJob = nodeSchedule.scheduleJob(cron, () => {
      if (!sqlite.getSystemEnabled()) {
        console.log(`Skipped scheduled open for ${deviceName}: master switch is off`);
        try { sqlite.logSchedulePaused(deviceName); } catch (e) { console.error('Log error:', e); }
        return;
      }
      operator.operateDevice(deviceName, 'open', (err) => {
        if (err) {
          console.error(`Scheduled open failed for ${deviceName}:`, err.message);
          try { sqlite.logScheduleFailed(deviceName); } catch (e) { console.error('Log error:', e); }
        } else {
          try { sqlite.logValveOpen(deviceName); } catch (e) { console.error('Log error:', e); }
          sqlite.updateDeviceStatus(deviceName, 'open');
          this.notifyClients(deviceName, 'open');
        }
      });
    });
    hour = schedule.endTime.split(':')[0];
    minute = schedule.endTime.split(':')[1];
    cron = `${minute} ${hour} * * ${weekday.indexOf(schedule.day)}`;
    const endJob = nodeSchedule.scheduleJob(cron, () => {
      operator.operateDevice(deviceName, 'close', (err) => {
        if (!err) {
          try { sqlite.logValveClose(deviceName); } catch (e) { console.error('Log error:', e); }
          sqlite.updateDeviceStatus(deviceName, 'close');
          this.notifyClients(deviceName, 'close');
        }
      });
    });
    this.jobs.push({ deviceName, startJob, endJob });
  }

  async updateDeviceSchedules(deviceName) {
    this.jobs = this.jobs.filter(job => {
      if (job.deviceName === deviceName) {
        job.startJob.cancel();
        job.endJob.cancel();
        return false;
      }
      return true;
    });
    const schedules = sqlite.getDeviceSchedules(deviceName);
    if (schedules) {
      schedules.forEach(schedule => {
        this.scheduleJob(schedule.deviceName, schedule);
      })
    }
  }

  notifyClients(deviceName, action) {
    console.log('notify client:', deviceName, action);
    const message = {deviceName, status: action};
    eventEmitter.emit('notifyClient', JSON.stringify(message));
  }
}

const scheduler = new Scheduler();
scheduler.initialize();

module.exports = scheduler;
