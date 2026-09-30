# Irrigation System

Automated garden irrigation controller with 4 (adjustable) latching solenoid valves, optional solar power monitoring, and a web-based control interface accessible from anywhere.

## Setups

### Setup A — Basic (breadboard)

```
12V Supply ──────────────────────────────────────────┐
                                                      ↓
Solar Panel → PWM Charge Controller → 12V Battery → Relay (GPIO 5)
                                                      ↓
                                           L298N H-bridge × 2
                                                      ↓
                                       Latching Solenoid Valves × 4

ESP32 DevKit ──→ L298N IN pins (GPIO 4,16,18,17,19,22,21,23)
             └──→ Relay module (GPIO 5)
```

**Components:**
- ESP32 DevKit (30-pin)
- Relay module — switches 12V to valve coils during pulse (GPIO 5)
- L298N H-bridge × 2 — drives the latching solenoid coils
- External 5V supply for ESP32 logic
- *(Optional)* INA219 current/voltage sensors × up to 3
- *(Optional)* YF-S201 flow sensor

### Setup B — Custom PCB

The PCB integrates the H-bridges, buck converter, and sensor headers onto a single board, replacing the breadboard modules.

```
Solar Panel → PWM Charge Controller → 12V Battery
                                           ↓
                                    Custom PCB
                                    ├── LM2596S-5.0 (12V → 5V for ESP32)
                                    ├── TB6612FNG × 2 (replaces L298N)
                                    ├── STBY (GPIO 5, replaces relay)
                                    ├── (Optional) INA219 × 3 (0x40/0x41/0x44)
                                    └── (Optional) Flow sensor header
                                           ↓
                                 Latching Solenoid Valves × 4
```

**Components assembled by JLCPCB (SMD):**
- TB6612FNG × 2 — MOSFET H-bridge drivers
- INA219AIDR × 3 — current/voltage sensors (built-in)
- LM2596S-5.0 — buck converter
- Passives (capacitors, resistors, SS34 diode, 100µH inductor)

**Through-hole to hand-solder:**
- ESP32 DevKit headers × 2
- KF301-2P screw terminals × 9
- 100µF electrolytic capacitors × 2
- R6 resistor (10kΩ, for LM2596 feedback) × 1

PCB design files (Gerber, BOM, CPL) are in `hardware/`.

> **Note:** GPIO 5 behavior differs between setups — it drives a relay (active-LOW) in Setup A and the TB6612FNG STBY pin (active-HIGH) in Setup B. Update the firmware accordingly when switching.

### Optional Sensors

In Setup A, all sensors are optional add-ons. In Setup B, the INA219 sensors are built into the PCB; only the flow sensor is optional.

| Sensor | Purpose | I2C Address | GPIO |
|--------|---------|-------------|------|
| INA219 A | Solar panel voltage/current | 0x40 | SDA=25, SCL=26 |
| INA219 B | Battery charge current | 0x41 | SDA=25, SCL=26 |
| INA219 C | Load (12V rail) current | 0x44 | SDA=25, SCL=26 |
| YF-S201 | Water flow rate & total volume | — | GPIO 27 |

The firmware detects sensors at startup and skips missing ones gracefully — no code changes needed if sensors are absent.

## Remote Access

### MQTT (ESP32 ↔ Server)

The system uses a self-hosted MQTT broker on a VPS to enable remote control from anywhere, without opening any ports on the home router.

```
[Home]                          [VPS]                    [Anywhere]
ESP32 ──outbound TLS 8883──→ MQTT Broker ←── Node.js server
                                                  ↑
                                            Angular client
                                          (browser / phone)
```

- Both the ESP32 and the Node.js server connect **outbound** to the broker — no inbound firewall rules needed at home.
- The broker is secured with username/password over TLS.
- The Node.js server can run on the same VPS or on any Raspberry Pi that can reach the broker.
- Credentials live in `secrets.h` (firmware) and `.env` (server) — never committed to git.

### Web UI (Cloudflare Tunnel)

The Node.js server can be exposed publicly via a Cloudflare Tunnel — no port forwarding, static IP, or open firewall ports required. Any machine running the server (home server, Raspberry Pi, VPS) can use this approach. You'll need to own a domain name and have it managed by Cloudflare DNS (i.e. Cloudflare must be the authoritative nameserver for the domain).

1. Install `cloudflared` on the machine running the server — see [Cloudflare's install guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
2. Authenticate: `cloudflared tunnel login`
3. Create or reuse a tunnel: `cloudflared tunnel create <name>`
4. Configure `~/.cloudflared/config.yml`:
```yaml
tunnel: <your-tunnel-id>
credentials-file: /path/to/<your-tunnel-id>.json

ingress:
  - hostname: your.domain.com
    service: http://localhost:3000
  - service: http_status:404
```
5. Add DNS record: `cloudflared tunnel route dns <name> your.domain.com`
6. Run as a system service so it starts on boot: `cloudflared service install`

> **Note:** Only one cloudflared instance should run per tunnel at a time. If switching between machines, stop the service on the old machine before starting it on the new one.

**Raspberry Pi (ARM 32-bit) specific:** the standard package manager may not have cloudflared — download the binary directly:
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm -o cloudflared
sudo mv cloudflared /usr/local/bin/
sudo chmod +x /usr/local/bin/cloudflared
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
| 5   | Relay / STBY      |
| 25  | I2C SDA (INA219)  |
| 26  | I2C SCL (INA219)  |
| 27  | Flow sensor       |

## Repository Structure

```
├── esp32/
│   ├── outside_wifi/         # Firmware for Setup A (relay + L298N)
│   │   ├── outside_wifi.ino
│   │   └── secrets.h.example # Copy to secrets.h and fill in your credentials
│   └── outside_wifi_pcb/     # Firmware for Setup B (custom PCB, TB6612FNG)
│       ├── outside_wifi_pcb.ino
│       └── secrets.h.example # Copy to secrets.h and fill in your credentials
├── server/                   # Node.js backend
│   ├── server.js
│   ├── routes/
│   ├── services/
│   └── .env.example          # Copy to .env and fill in your values
├── client/                   # Angular frontend
│   └── src/
└── hardware/                 # PCB design exports (EasyEDA Pro / JLCPCB)
    ├── Gerber_PCB1_*.zip
    ├── BOM_Board1_PCB1_*.csv
    └── PickAndPlace_PCB1_*.csv
```

## Setup

### Firmware

1. Choose the sketch for your setup:
   - Setup A (relay + L298N): `esp32/outside_wifi/`
   - Setup B (custom PCB): `esp32/outside_wifi_pcb/`
2. Copy `secrets.h.example` to `secrets.h` in the same folder
3. Fill in your WiFi SSID/password and MQTT broker credentials
4. Flash the `.ino` file to ESP32 via Arduino IDE

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
