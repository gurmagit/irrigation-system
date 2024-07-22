#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
//#include <PubSubClient.h>

#define VALVE1_PIN 15
#define VALVE2_PIN 2
#define VALVE3_PIN 4
#define VALVE4_PIN 16

const char* ssid = "TP-LINK_7080";
const char* pass = "37631994";
//const char* broker = "192.168.1.12";
//const char* id = "ESP32-1";
//char mqtt_topic[50];

//WiFiClient WiFiclient;
//PubSubClient mqttClient(WiFiclient);

IPAddress ip;
IPAddress local_IP(192,168,1,241);
IPAddress gateway(192,168,1,1);
IPAddress subnet(255,255,255,0);
IPAddress primaryDNS(213,57,2,5);
IPAddress secondaryDNS(213,57,22,5);

WebServer server(8080);


void setup() {
  Serial.begin(115200);

  pinMode(VALVE1_PIN, OUTPUT);
  pinMode(VALVE2_PIN, OUTPUT);
  pinMode(VALVE3_PIN, OUTPUT);
  pinMode(VALVE4_PIN, OUTPUT);

  delay(2000);
  connect_to_wifi();
//  mqttClient.setServer(broker, 1883);
//  mqttClient.setCallback(callback);
//  reconnect();
  
  server.onNotFound(handle_request);
  server.begin();
  Serial.println("Server started.");
}

void loop() {
  server.handleClient();
//  if (!mqttClient.connected()) {
//    reconnect();
//  }
//  mqttClient.loop();
}

void connect_to_wifi() {
  if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS)) {
    Serial.println("STA Failed to configure");
  }
  WiFi.begin(ssid, pass);
  Serial.println("Connecting to WiFi..");
  int i = 0;
  while (WiFi.status() != WL_CONNECTED && i < 30) {
    delay(1000);
    Serial.print(i);
    Serial.print("- WiFi.status: ");
    Serial.println(WiFi.status());
    i++;
  }
  if (i >= 30) {
    ESP.restart();
  }
  ip = WiFi.localIP();
  Serial.print("Connected with IP address: ");
  Serial.println(ip);
  Serial.println(WiFi.macAddress());
}

void handle_request() {
  String path = server.uri();
  String method = server.method() == HTTP_GET ? "GET" : "POST";
  Serial.printf("Received %s request for %s\n", method.c_str(), path.c_str());
  if (method == "GET") {
    String response = "";
    if (path.startsWith("/valve1/")) {
      response = handle_valve_request(VALVE1_PIN, path.substring(8));
    } else if (path.startsWith("/valve2/")) {
      response = handle_valve_request(VALVE2_PIN, path.substring(8));
    } else if (path.startsWith("/valve3/")) {
      response = handle_valve_request(VALVE3_PIN, path.substring(8));
    } else if (path.startsWith("/valve4/")) {
      response = handle_valve_request(VALVE4_PIN, path.substring(8));
    } else {
      response = "{\"status\":\"fail\",\"message\":\"Valve not found\"}";
    }
    server.send(200, "application/json", response);
  } else {
    server.send(404, "application/json", "{\"status\":\"fail\",\"message\":\"Command not found\"}");
  }
}

String handle_valve_request(int pin, String command) {
  String response = "";
  if (command == "open") {
    digitalWrite(pin, HIGH);
    response = "{\"status\":\"success\",\"data\":{\"valve\":\"" + String(pin) + "\",\"pin\":1}}";
  } else if (command == "close") {
    digitalWrite(pin, LOW);
    response = "{\"status\":\"success\",\"data\":{\"valve\":\"" + String(pin) + "\",\"pin\":0}}";
  } else {
    response = "{\"status\":\"fail\",\"message\":\"Command not found\"}";
  }
  return response;
}

//void reconnect() {
//  Serial.println("initialize mqtt client...");
//  if (mqttClient.connect(id)) {
//    Serial.println("Connected to broker");    
//    String str = String(id) + "/ip_address";
//    str.toCharArray(mqtt_topic, str.length() + 1);
//    send_mqtt(mqtt_topic, ip.toString());
//    str = String(id) + "/#";
//    str.toCharArray(mqtt_topic, str.length() + 1);
//    mqttClient.subscribe(mqtt_topic);
//  } else {
//    Serial.println("Connection failed ");
//    Serial.println(mqttClient.state());
//    delay(5000);
//  }
//}

//void send_mqtt(char* topic, String msg) {
//  StaticJsonDocument<200> doc;
//  doc["message"] = msg;
//  char jsonBuffer[512];
//  serializeJson(doc, jsonBuffer);
//  mqttClient.publish(topic, jsonBuffer);
//}

//void callback(char* topic, byte* payload, unsigned int len) {
//  Serial.print("Message arrived [");
//  Serial.print(topic);
//  Serial.print("] ");
//  for (unsigned int i = 0; i < len; i++) {
//    Serial.print((char)payload[i]);
//  }
//  Serial.println();
//  StaticJsonDocument<200> doc;
//  deserializeJson(doc, payload, len);
//  const char* msg = doc["message"];  
//  Serial.print("message: ");
//  Serial.println(msg);
//  if (String(msg) == "resend") {
//    send_mqtt(mqtt_topic, ip.toString());
//  }
//}
