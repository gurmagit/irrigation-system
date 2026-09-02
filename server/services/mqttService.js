const mqtt = require('mqtt');
const eventEmitter = require('./eventEmitter');
const { sqlite } = require('./db');


const REGISTER_TOPIC = 'esp32/register';
const ACK_TIMEOUT_MS = 3000;

class MqttService {
  constructor() {
    this._espMac       = null;
    this._espConnected = null;
    this._pendingAcks  = new Map();
    this._pingPromise  = null;
    this._pingResolve  = null;
    this._sensorData   = null;
    this._sleeping     = false;

    this._client = mqtt.connect(process.env.BROKER_URL, {
      username: process.env.MQTT_USER,
      password: process.env.MQTT_PASSWORD,
      rejectUnauthorized: false,
      reconnectPeriod: 5000,
      connectTimeout: 10000
    });

    this._client.on('connect', () => {
      console.log('MQTT client connected to', process.env.BROKER_URL);
      this._client.subscribe('esp32/outside/status');
      this._client.subscribe(REGISTER_TOPIC, () => {
        this._client.publish('esp32/republish_mac', '');
        console.log('Sent esp32/republish_mac ping');
      });
    });

    this._client.on('error', (err) => {
      console.error('MQTT client error:', err.message);
    });

    this._client.on('close', () => {
      console.warn('MQTT client disconnected');
    });

    this._client.on('message', (topic, message, packet) => {
      let msg;
      try { msg = JSON.parse(message); } catch (_) { return; }

      if (topic === 'esp32/outside/status') {
        if (packet.retain) {
          this._espConnected = msg.online === true ? true : false;
          console.log(`[init] ESP state restored from broker: ${this._espConnected ? 'online' : 'offline'}`);
          this._client.unsubscribe('esp32/outside/status');
        }
        return;
      }

      if (topic === REGISTER_TOPIC) {
        const mac = msg.mac;
        if (!mac) return;
        if (mac !== this._espMac) {
          this._espMac = mac;
          this._client.subscribe(`${mac}/#`, () => {});
          const source = packet.retain ? 'broker (retained)' : 'ESP32 (live)';
          console.log(`ESP32 registered: ${mac} — subscribed to ${mac}/# [${source}]`);
        }
        if (!packet.retain) {
          this._setConnected(true);
          if (this._pingResolve && mac === this._espMac) {
            this._pingResolve(true);
          }
        }
        return;
      }

      if (!this._espMac) return;

      if (topic === `${this._espMac}/will`) {
        if (msg.online === false) this._setConnected(false);
        return;
      }

      if (topic === `${this._espMac}/wifi`) {
        console.log('ESP32 wifi status:', msg);
        return;
      }

      if (topic === `${this._espMac}/sensors`) {
        this._sensorData = { ...msg, timestamp: new Date().toISOString() };
        eventEmitter.emit('notifyClient', JSON.stringify({ type: 'sensorData', ...this._sensorData }));
        return;
      }

      if (topic === `${this._espMac}/ack`) {
        const key     = String(msg.valve);
        const pending = this._pendingAcks.get(key);
        if (pending) {
          clearTimeout(pending.timer);
          this._pendingAcks.delete(key);
          if (msg.success) {
            pending.cb(null, msg);
          } else {
            pending.cb(new Error(`Valve ${msg.valve} reported failure`), null);
          }
        }
      }
    });
  }

  _setConnected(online) {
    if (this._espConnected === online) return;
    const prev = this._espConnected;
    this._espConnected = online;
    if (!online) this._sensorData = null;
    if (online) this._sleeping = false;
    console.log(`ESP32 status: ${online ? 'online' : 'offline'}`);
    this._client.publish('esp32/outside/status', JSON.stringify({ online }), { retain: true });
    eventEmitter.emit('notifyClient', JSON.stringify({ type: 'espStatus', online }));
    if (prev !== null) {
      const logStatus = !online && this._sleeping ? null : (online ? 'online' : 'offline');
      if (logStatus) {
        try { sqlite.logEspEvent(logStatus); } catch (e) { console.error('ESP event log error:', e); }
      }
    }
  }

  isEspConnected() { return this._espConnected; }

  getSensorData() { return this._sensorData; }

  pingEsp(timeoutMs = 1500) {
    if (this._pingPromise) return this._pingPromise;
    this._pingPromise = new Promise((resolve) => {
      this._pingResolve = (result) => {
        this._pingPromise = null;
        this._pingResolve = null;
        if (!result) this._setConnected(false);
        resolve(result);
      };
      this._client.publish('esp32/republish_mac', '');
      setTimeout(() => {
        if (this._pingResolve) this._pingResolve(false);
      }, timeoutMs);
    });
    return this._pingPromise;
  }

  publishSleep(minutes) {
    if (!this._espMac) throw new Error('ESP32 not registered');
    this._sleeping = true;
    this._client.publish(`${this._espMac}/sleep`, JSON.stringify({ minutes }));
    this._setConnected(false);
    console.log(`MQTT publish: ${this._espMac}/sleep → ${minutes} min`);
  }

  publishSensorsRefresh() {
    if (!this._espMac) throw new Error('ESP32 not registered');
    this._client.publish(`${this._espMac}/sensors/refresh`, '');
    console.log(`MQTT publish: ${this._espMac}/sensors/refresh`);
  }

  operateDevice(channel, action, cb) {
    console.log('espMac:', this._espMac);
    if (!this._espMac) {
      return cb(new Error('ESP32 not yet registered — no MAC received on esp32/register'), null);
    }
    const value    = action === 'open' ? 0 : 1;
    const pulse_ms = sqlite.getPulseMs();
    const payload  = JSON.stringify({ [channel]: value, pulse_ms });
    const key     = String(channel);

    const timer = setTimeout(() => {
      this._pendingAcks.delete(key);
      cb(new Error(`MQTT ack timeout for channel ${channel}`), null);
    }, ACK_TIMEOUT_MS);

    this._pendingAcks.set(key, { cb, timer });
    this._client.publish(`${this._espMac}/cmd`, payload);
    console.log(`MQTT publish: ${this._espMac}/cmd → ${payload}`);
  }
}

module.exports = { mqttService: new MqttService() };
