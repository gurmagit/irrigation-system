const mqtt = require('mqtt')
const client = mqtt.connect("matang.xyz");
const esp_id = 'ESP32-1';

class MqttService {
  constructor() {
    client.on('connect', () => {
      console.log('Mqtt client connected')
      client.subscribe(esp_id + '/#', () => {})
      client.on('message', (topic, message) => {
        const msg = JSON.parse(message);
        if (topic.includes('ip_address')) {
          console.log('msg:', msg);
          const ip = msg.message;
        }
      })
    })
  }
}

module.exports = {
    MqttService: MqttService
}