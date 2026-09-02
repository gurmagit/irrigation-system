const EventEmitter = require('events');
const eventEmitter = new EventEmitter();

eventEmitter.on('notifyClient', text => {
  try { if (JSON.parse(text).type === 'sensorData') return; } catch {}
  console.log('eventEmitter log:', text);
});

module.exports = eventEmitter;
