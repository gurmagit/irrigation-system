#include <WiFi.h>
#include <WebServer.h>
#include <map>
#include <string>

typedef std::map<std::string, int> ValvePinMap;
ValvePinMap valves = {
    {"1", 15},
    {"2", 2},
    {"3", 4},
    {"4", 16}
};

const char* ssid = "TP-LINK_7080";
const char* pass = "37631994";

IPAddress ip;
IPAddress local_IP(192,168,1,241);
IPAddress gateway(192,168,1,1);
IPAddress subnet(255,255,255,0);
IPAddress primaryDNS(213,57,2,5);
IPAddress secondaryDNS(213,57,22,5);

WebServer server(8080);

void setup() {
  Serial.begin(115200);
  
  for (const auto& pair : valves) {
    pinMode(pair.second, OUTPUT);
  }
  delay(2000);
  connect_to_wifi();
  
  server.onNotFound(handle_request);
  server.begin();
  Serial.println("Server started.");
}

void loop() {
  server.handleClient();
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
  const char digit = path[6];
  if (method == "GET") {
    String response = "{\"status\":\"fail\",\"message\":\"Valve not found\"}";
    if (path.startsWith("/valve") && isdigit(digit)) {
      for (const auto& pair : valves) {
        std::string digitStr(1, digit);
        if (pair.first == digitStr) {
          response = create_response(String(digit), pair.second, path.substring(8));
          Serial.print("response: ");
          Serial.println(response);
        }
      }
    }
    server.send(200, "application/json", response);
  } else {
    server.send(404, "application/json", "{\"status\":\"fail\",\"message\":\"Command not found\"}");
  }
}

String create_response(String valve, int pin, String command) {
  String response = "";
  if (command == "open") {
    digitalWrite(pin, HIGH);
    response = "{\"status\":\"success\",\"data\":{\"valve\":\"" + valve + "\",\"pin\":1}}";
  } else if (command == "close") {
    digitalWrite(pin, LOW);
    response = "{\"status\":\"success\",\"data\":{\"valve\":\"" + valve + "\",\"pin\":0}}";
  } else {
    response = "{\"status\":\"fail\",\"message\":\"Command not found\"}";
  }
  return response;
}
