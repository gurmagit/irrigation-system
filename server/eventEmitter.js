const EventEmitter = require('events');
const eventEmitter = new EventEmitter();

eventEmitter.on('notifyClient', text => {
  console.log('eventEmitter log:', text);
});

module.exports = eventEmitter;
