const { mqttService } = require('./mqttService');
const { sqlite } = require('./db');

class Operator {
  // name  : device name, e.g. "valve1", "valve2"
  // action: 'open' | 'close'
  operateDevice(name, action, cb) {
    if (action === 'open' && !sqlite.getSystemEnabled()) {
      console.log(`Blocked open for ${name}: master switch is off`);
      return cb(new Error('System is paused (master switch is off)'));
    }
    const channel = parseInt(name.replace(/\D/g, ''), 10);
    console.log(`Operating ${name} (channel ${channel}), action: ${action}`);
    mqttService.operateDevice(channel, action, cb);
  }
}

module.exports = { operator: new Operator() };
