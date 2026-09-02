# Irrigation System

Automated garden irrigation controller with 4 latching solenoid valves, solar power monitoring, and a web-based control interface.

## Architecture

```
Solar Panel → PWM Charge Controller → 12V Battery
                                           ↓
                              ESP32 (firmware) ↔ MQTT Broker (TLS)
                                           ↓
                              TB6612FNG H-bridge × 2
                                           ↓
                          Latching Solenoid Valves × 4
```

**Components:**
- ESP32 DevKit (30-pin) — main controller
- TB6612FNG × 2 — H-bridge drivers for latching valves
- INA219 × 3 — current/voltage sensors (solar panel at 0x40, load at 0x41, battery at 0x44)
- LM2596S-5.0 — 12V → 5V buck converter (on custom PCB)
- YF-S201 flow sensor
- Custom PCB (designed in EasyEDA Pro, assembled by JLCPCB)

**Stack:**
- Firmware: Arduino (C++) on ESP32
- Backend: Node.js + Express + SQLite + MQTT
- Frontend: Angular + Angular Material

## Repository Structure

```
├── esp32/
│   └── outside_wifi/         # Main firmware (valves + sensors)
│       ├── outside_wifi.ino
│       └── secrets.h.example # Copy to secrets.h and fill in your credentials
├── server/                   # Node.js backend
│   ├── server.js
│   ├── routes/
│   ├── services/
│   └── .env.example          # Copy to .env and fill in your values
├── client/                   # Angular frontend
│   └── src/
├── hardware/                 # PCB design exports (EasyEDA Pro / JLCPCB)
│   ├── Gerber_PCB1_*.zip
│   ├── BOM_Board1_PCB1_*.csv
│   └── PickAndPlace_PCB1_*.csv
└── deploy.sh
```

## GPIO Pinout

| Pin | Function          |
|-----|-------------------|
| 4   | Valve 1 IN1       |
| 16  | Valve 1 IN2       |
| 18  | Valve 2 IN1       |
| 17  | Valve 2 IN2       |
| 19  | Valve 3 IN1       |
| 22  | Valve 3 IN2       |
| 21  | Valve 4 IN1       |
| 23  | Valve 4 IN2       |
| 5   | TB6612FNG STBY    |
| 25  | I2C SDA (INA219)  |
| 26  | I2C SCL (INA219)  |
| 27  | Flow sensor       |

## Setup

### Firmware

1. Copy `esp32/outside_wifi/secrets.h.example` to `esp32/outside_wifi/secrets.h`
2. Fill in your WiFi and MQTT credentials in `secrets.h`
3. Open `outside_wifi.ino` in Arduino IDE and flash to ESP32

### Server

```bash
cd server
cp .env.example .env
# Edit .env with your values
npm install
node server.js
```

### Client

```bash
cd client
npm install
ng build --configuration production
```

The server serves the built Angular app from `client/dist/irrigation-system/`.

## Hardware Notes

- PCB manufactured by JLCPCB (5 bare PCBs + 2 PCBA assembled boards)
- SMD components assembled by JLCPCB: INA219 × 3, TB6612FNG × 2, LM2596S, passives
- Through-hole to hand-solder: ESP32 headers, screw terminals (KF301-2P), 100µF caps × 2, R6 (10kΩ)
- PCB Gerber/BOM/CPL files in `hardware/` — open EasyEDA project in EasyEDA Pro
