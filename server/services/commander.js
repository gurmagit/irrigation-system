const axios = require('axios');

const ESP32 = 'http://192.168.1.241:8080/';

class Operator {
  operateDevice(name, action, cb) {
    const url = ESP32 + name + '/' + action;
    axios(url).then(res => {
      console.log('response:', res.data);
      cb(null, res.data);
    })
    .catch(err => cb(err, null))
    console.log(`Operating device: ${name}, action: ${action}`);
  }
}

module.exports = {
  operator: new Operator()
}