const Database = require('better-sqlite3');
const db = new Database('irrigation.db');

process.on('exit', () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));

class Sqlite3 {
  getUser(user) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(user);
  }

  getUsers() {
    return db.prepare('SELECT username, role FROM users').all();
  }

  addUser(username, hashedPassword) {
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hashedPassword, 'user');
  }

  deleteUser(username) {
    db.prepare('DELETE FROM users WHERE username = ?').run(username);
  }

  getDevices() {
    return db.prepare('SELECT * FROM devices').all();
  }

  getDeviceNames() {
    return db.prepare('SELECT name FROM devices').all();
  }
  
  getDevice(deviceName) {
    const stmt = db.prepare('SELECT * FROM devices WHERE name = ?');
    return stmt.get(deviceName);
  }

  addDevice(name) {
    const stmt = db.prepare('INSERT INTO devices (name) VALUES (?)');
    stmt.run(name);
  }

  deleteDevice(name) {
    const stmt = db.prepare('DELETE FROM devices WHERE name = ?');
    stmt.run(name);
  }

  updateDeviceName(previousName, newName) {
    const stmt = db.prepare('UPDATE devices SET name = ? WHERE name = ?');
    stmt.run(newName, previousName);
  }

  updateDeviceStatus(name, status) {
    const stmt = db.prepare('UPDATE devices SET status = ? WHERE name = ?');
    stmt.run(status, name);
  }

  resetAllDeviceStatuses() {
    const stmt = db.prepare('UPDATE devices SET status = ?');
    stmt.run('close');
  }

  updateSchedules(deviceName, schedules) {
    this.deleteSchedules(deviceName);
    this.addSchedules(deviceName, schedules)
  }
  
  getSchedules() {
    return db.prepare('SELECT * FROM schedules').all();
  }

  getGroupedSchedules() {
    const q = "\
      WITH AggregatedSchedules AS (\
        SELECT deviceName, startTime, endTime, GROUP_CONCAT(day) AS days\
        FROM schedules GROUP BY deviceName, startTime, endTime\
      )\
      SELECT d.name, d.status, json_group_array(json_object(\
        'startTime', a.startTime, 'endTime', a.endTime, 'days', a.days\
      )) AS schedules\
      FROM devices d LEFT JOIN AggregatedSchedules a ON d.name = a.deviceName\
      GROUP BY d.name, d.status;\
    "
    return db.prepare(q).all();
  }
  
  getDeviceGroupedSchedules(deviceName) {
    const q = `\
      WITH AggregatedSchedules AS (\
        SELECT deviceName, startTime, endTime, GROUP_CONCAT(day) AS days\
        FROM schedules GROUP BY deviceName, startTime, endTime\
      )\
      SELECT d.name, d.status, json_group_array(json_object(\
        'startTime', a.startTime, 'endTime', a.endTime, 'days', a.days\
      )) AS schedules\
      FROM devices d LEFT JOIN AggregatedSchedules a ON d.name = a.deviceName\
      WHERE deviceName = '${deviceName}' GROUP BY d.name, d.status;\
    `
    return db.prepare(q).all();
  }

  getDeviceSchedules(deviceName) {
    return db.prepare('SELECT * FROM schedules WHERE deviceName = ?').all(deviceName);
  }

  addSchedules(deviceName, schedules) {
    const insert = db.prepare('INSERT INTO schedules VALUES (?, ?, ?, ?)');
    const transaction = db.transaction(schedules => {
      schedules.forEach(schedule => {
        schedule.days.forEach(day => {
          const startTime = schedule.startTime;
          const endTime = schedule.endTime;
          insert.run(deviceName, startTime, endTime, day)
        });
      })
    })
    transaction(schedules);
  }

  deleteSchedules(deviceName) {
    const stmt = db.prepare('DELETE FROM schedules WHERE deviceName = ?');
    stmt.run(deviceName)
  }

  initSchema() {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
      )
    `).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS devices (
        name TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'close'
      )
    `).run();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS schedules (
        deviceName TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        day TEXT NOT NULL
      )
    `).run();
  }

  initValveLogs() {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS valve_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviceName TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT,
        duration INTEGER,
        consumption REAL,
        status TEXT
      )
    `).run();
    try {
      db.prepare('ALTER TABLE valve_logs ADD COLUMN status TEXT').run();
    } catch (_) { /* column already exists */ }
  }

  logScheduleFailed(deviceName) {
    const time = new Date().toISOString();
    db.prepare('INSERT INTO valve_logs (deviceName, startTime, endTime, status) VALUES (?, ?, ?, ?)').run(deviceName, time, time, 'failed');
  }

  logEspEvent(status) {
    const time = new Date().toISOString();
    db.prepare('INSERT INTO valve_logs (deviceName, startTime, endTime, status) VALUES (?, ?, ?, ?)').run('ESP32', time, time, status);
  }

  logValveOpen(deviceName) {
    const startTime = new Date().toISOString();
    const stuck = db.prepare('SELECT id, startTime FROM valve_logs WHERE deviceName = ? AND endTime IS NULL ORDER BY id DESC LIMIT 1').get(deviceName);
    if (stuck) {
      const duration = Math.round((new Date(startTime) - new Date(stuck.startTime)) / 1000);
      db.prepare('UPDATE valve_logs SET endTime = ?, duration = ? WHERE id = ?').run(startTime, duration, stuck.id);
    }
    db.prepare('INSERT INTO valve_logs (deviceName, startTime) VALUES (?, ?)').run(deviceName, startTime);
  }

  logValveClose(deviceName) {
    const endTime = new Date().toISOString();
    const last = db.prepare('SELECT id, startTime FROM valve_logs WHERE deviceName = ? AND endTime IS NULL ORDER BY id DESC LIMIT 1').get(deviceName);
    if (last) {
      const duration = Math.round((new Date(endTime) - new Date(last.startTime)) / 1000);
      db.prepare('UPDATE valve_logs SET endTime = ?, duration = ? WHERE id = ?').run(endTime, duration, last.id);
    }
  }

  getValveLogs() {
    return db.prepare(
      `SELECT * FROM valve_logs
       WHERE startTime IS NOT NULL
         AND datetime(startTime) >= datetime('now', '-7 days')
       ORDER BY id DESC LIMIT 20`
    ).all();
  }

  getAllValveLogs() {
    return db.prepare('SELECT * FROM valve_logs WHERE startTime IS NOT NULL ORDER BY id DESC').all();
  }

  initSettings() {
    db.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)').run();
    const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    ins.run('night_mode_enabled', 'false');
    ins.run('night_mode_start', '00:00');
    ins.run('night_mode_end', '05:00');
    ins.run('pulse_ms', '50');
  }

  getPulseMs() {
    return parseInt(db.prepare('SELECT value FROM settings WHERE key = ?').get('pulse_ms')?.value ?? '50');
  }

  setPulseMs(ms) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('pulse_ms', String(ms));
  }

  getNightMode() {
    const get = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
    return {
      enabled: get('night_mode_enabled') === 'true',
      start: get('night_mode_start') ?? '00:00',
      end: get('night_mode_end') ?? '05:00'
    };
  }

  setNightMode(enabled, start, end) {
    const set = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    set.run('night_mode_enabled', String(enabled));
    set.run('night_mode_start', start);
    set.run('night_mode_end', end);
  }
}

const sqlite = new Sqlite3();
sqlite.initSchema();
sqlite.initValveLogs();
sqlite.initSettings();
module.exports = { sqlite };