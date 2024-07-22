const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  days: {
    type: [String],
    required: true
  }
});

const deviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'close'],
    default: 'close',
    required: true
  },
  schedules: {
    type: [scheduleSchema],
    default: []
  }
});

module.exports = mongoose.model('Device', deviceSchema);
