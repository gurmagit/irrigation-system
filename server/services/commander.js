const { mqttService } = require('./mqttService');

class Operator {
  operateDevice(name, action, cb) {
    const channel = parseInt(name.replace(/\D/g, ''), 10);
    console.log(`Operating ${name} (channel ${channel}), action: ${action}`);
    mqttService.operateDevice(channel, action, cb);
  }
}

module.exports = { operator: new Operator() };
