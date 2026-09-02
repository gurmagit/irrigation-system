#include <WiFiClientSecure.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_INA219.h>

#include "secrets.h"
const char* ssid        = WIFI_SSID;
const char* password    = WIFI_PASSWORD;
const char* mqtt_user   = MQTT_USER;
const char* mqtt_pwd    = MQTT_PASSWORD;
const char* mqtt_server = MQTT_SERVER;

#define PULSE_MS            50
#define RELAY_PIN            5
#define SDA_PIN             25
#define SCL_PIN             26
#define FLOW_PIN            27
#define CALIBRATION_FACTOR 7.5

Adafruit_INA219 ina_panel(0x40);
Adafruit_INA219 ina_load(0x41);
Adafruit_INA219 ina_battery(0x44);
bool ina_panel_ok   = false;
bool ina_load_ok    = false;
bool ina_battery_ok = false;

volatile unsigned long pulseCount = 0;
float totalLiters = 0.0;
unsigned long lastFlowSample = 0;

void IRAM_ATTR flowPulse() { pulseCount++; }

int in1_pins[] = {4,  18, 19, 21};
int in2_pins[] = {16, 17, 22, 23};

String topic_sensors;
String myMac;       // no colons, uppercase — used in topics
String myMacColon;  // XX:XX:XX:XX:XX:XX — used in ACK payload
String topic_cmd;
String topic_ack;
String topic_wifi;
long last_wifi_report = 0;

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

void pulse(int valve, uint8_t cmd, int duration = PULSE_MS) {
  int in1 = in1_pins[valve];
  int in2 = in2_pins[valve];
  digitalWrite(in1, cmd == 0 ? HIGH : LOW);
  digitalWrite(in2, cmd == 0 ? LOW  : HIGH);
  delay(duration);
  digitalWrite(in1, LOW);
  digitalWrite(in2, LOW);
}

void reset() {
  for (int i = 0; i < 4; i++) {
    digitalWrite(in1_pins[i], LOW);
    digitalWrite(in2_pins[i], LOW);
  }
}

void closeAllValves() {
  digitalWrite(RELAY_PIN, LOW);
  delay(50);
  for (int i = 0; i < 4; i++) {
    pulse(i, 1);  // cmd=1 = close
    delay(20);
  }
  delay(50);
  digitalWrite(RELAY_PIN, HIGH);
  Serial.println("All valves closed");
}

void publish_mac() {
  StaticJsonDocument<64> doc;
  doc["mac"] = myMac;
  char buf[64];
  serializeJson(doc, buf);
  mqttClient.publish("esp32/register", buf, true);
  Serial.printf("Published: esp32/register → %s\n", buf);
}

void publishSensors() {
  long now = millis();
  unsigned long elapsed = now - lastFlowSample;
  noInterrupts();
  unsigned long pulses = pulseCount;
  pulseCount = 0;
  interrupts();
  lastFlowSample = now;
  float flowRate = elapsed > 0 ? (pulses / (elapsed / 1000.0)) / CALIBRATION_FACTOR : 0;
  totalLiters += flowRate * (elapsed / 1000.0) / 60.0;

  StaticJsonDocument<384> sensorDoc;
  if (ina_panel_ok) {
    sensorDoc["panel"]["v"] = ina_panel.getBusVoltage_V();
    sensorDoc["panel"]["i"] = ina_panel.getCurrent_mA();
    sensorDoc["panel"]["p"] = ina_panel.getPower_mW();
  }
  if (ina_load_ok) {
    sensorDoc["load"]["v"] = ina_load.getBusVoltage_V();
    sensorDoc["load"]["i"] = ina_load.getCurrent_mA();
    sensorDoc["load"]["p"] = ina_load.getPower_mW();
  }
  if (ina_battery_ok) {
    sensorDoc["battery"]["v"] = ina_battery.getBusVoltage_V();
    sensorDoc["battery"]["i"] = ina_battery.getCurrent_mA();
    sensorDoc["battery"]["p"] = ina_battery.getPower_mW();
  }
  sensorDoc["flow"]["rate"]  = flowRate;
  sensorDoc["flow"]["total"] = totalLiters;
  char sensorBuf[384];
  serializeJson(sensorDoc, sensorBuf);
  mqttClient.publish(topic_sensors.c_str(), sensorBuf);
  Serial.printf("Sensors: %s\n", sensorBuf);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, "esp32/republish_mac") == 0) {
    publish_mac();
    return;
  }
  if (strcmp(topic, (myMac + "/sensors/refresh").c_str()) == 0) {
    publishSensors();
    return;
  }
  if (strcmp(topic, (myMac + "/restart").c_str()) == 0) {
    Serial.println("Restart requested via MQTT");
    ESP.restart();
  }
  if (strcmp(topic, (myMac + "/sleep").c_str()) == 0) {
    StaticJsonDocument<64> doc;
    uint64_t minutes = 60;
    if (deserializeJson(doc, payload, length) == DeserializationError::Ok) {
      minutes = doc["minutes"] | 60;
    }
    Serial.printf("Sleep requested: %llu minutes\n", minutes);
    closeAllValves();
    mqttClient.disconnect();
    esp_deep_sleep(minutes * 60ULL * 1000000ULL);
  }
  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, payload, length) != DeserializationError::Ok) return;
  Serial.print("CMD: ");
  serializeJson(doc, Serial);
  Serial.println();
  int duration = doc.containsKey("pulse_ms") ? doc["pulse_ms"].as<int>() : PULSE_MS;
  JsonObject obj = doc.as<JsonObject>();
  int channel = -1;
  uint8_t cmd = 0;
  for (auto kv : obj) {
    if (strcmp(kv.key().c_str(), "pulse_ms") == 0) continue;
    channel = atoi(kv.key().c_str()) - 1;
    cmd = (uint8_t)kv.value().as<int>();
    break;
  }
  if (channel < 0 || channel > 3) return;
  digitalWrite(RELAY_PIN, LOW);
  delay(50);
  pulse(channel, cmd, duration);
  delay(20);
  digitalWrite(RELAY_PIN, HIGH);
  Serial.printf("Valve %d: %s\n", channel + 1, cmd == 0 ? "open" : "close");
  StaticJsonDocument<128> ackDoc;
  ackDoc["mac"]     = myMacColon;
  ackDoc["valve"]   = channel + 1;
  ackDoc["success"] = true;
  char buf[128];
  serializeJson(ackDoc, buf);
  mqttClient.publish(topic_ack.c_str(), buf);
  Serial.printf("ACK: %s → %s\n", topic_ack.c_str(), buf);
}

void reconnect_mqtt() {
  int i = 0;
  while (!mqttClient.connected() && i < 10) {
    Serial.print("Connecting to MQTT...");
    String willTopic = myMac + "/will";
    if (mqttClient.connect(myMac.c_str(), mqtt_user, mqtt_pwd,
                           willTopic.c_str(), 1, true, "{\"online\":false}")) {
      Serial.printf("connected (RSSI: %d dBm)\n", WiFi.RSSI());
      publish_mac();
      mqttClient.subscribe(topic_cmd.c_str());
      mqttClient.subscribe((myMac + "/restart").c_str());
      mqttClient.subscribe((myMac + "/sleep").c_str());
      mqttClient.subscribe((myMac + "/sensors/refresh").c_str());
      mqttClient.subscribe("esp32/republish_mac");
      Serial.printf("Subscribed: %s\n", topic_cmd.c_str());
    } else {
      Serial.printf("failed rc=%d, retry in 5s\n", mqttClient.state());
      delay(5000);
      i++;
    }
  }
  if (i >= 10) {
    Serial.println("MQTT connect failed — restarting");
    ESP.restart();
  }
}

void setup_wifi() {
  WiFi.mode(WIFI_STA);
  esp_wifi_set_max_tx_power(80);
  esp_wifi_set_ps(WIFI_PS_NONE);
  esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  int i = 0;
  while (WiFi.status() != WL_CONNECTED && i < 40) {
    delay(500);
    Serial.print(".");
    i++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nFailed to connect — restarting");
    ESP.restart();
  }
  myMacColon = WiFi.macAddress();
  myMac = myMacColon;
  myMac.replace(":", "");
  myMac.toUpperCase();
  topic_cmd     = myMac + "/cmd";
  topic_ack     = myMac + "/ack";
  topic_wifi    = myMac + "/wifi";
  topic_sensors = myMac + "/sensors";
  Serial.printf("\nConnected — IP: %s  ch: %d  RSSI: %d dBm\n",
    WiFi.localIP().toString().c_str(), WiFi.channel(), WiFi.RSSI());
  Serial.printf("MAC: %s\n", myMacColon.c_str());
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 4; i++) {
    pinMode(in1_pins[i], OUTPUT); digitalWrite(in1_pins[i], LOW);
    pinMode(in2_pins[i], OUTPUT); digitalWrite(in2_pins[i], LOW);
  }
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);
  reset();
  closeAllValves();

  Wire.begin(SDA_PIN, SCL_PIN);
  ina_panel_ok   = ina_panel.begin();
  ina_load_ok    = ina_load.begin();
  ina_battery_ok = ina_battery.begin();
  Serial.printf("INA panel (0x40): %s\n",   ina_panel_ok   ? "OK" : "not found");
  Serial.printf("INA load (0x41): %s\n",    ina_load_ok    ? "OK" : "not found");
  Serial.printf("INA battery (0x44): %s\n", ina_battery_ok ? "OK" : "not found");

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), flowPulse, RISING);
  lastFlowSample = millis();

  setup_wifi();
  espClient.setInsecure();
  mqttClient.setServer(mqtt_server, 8883);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost — restarting");
    ESP.restart();
  }
  if (!mqttClient.connected()) reconnect_mqtt();
  mqttClient.loop();
  long now = millis();
  if (now - last_wifi_report > 30000) {
    last_wifi_report = now;
    int rssi = WiFi.RSSI();
    Serial.printf("WiFi status — MAC: %s  IP: %s  RSSI: %d dBm\n",
      myMacColon.c_str(), WiFi.localIP().toString().c_str(), rssi);
    StaticJsonDocument<128> doc;
    doc["mac"]  = myMacColon;
    doc["ip"]   = WiFi.localIP().toString();
    doc["rssi"] = rssi;
    char buf[128];
    serializeJson(doc, buf);
    mqttClient.publish(topic_wifi.c_str(), buf);

    publishSensors();
  }
}
