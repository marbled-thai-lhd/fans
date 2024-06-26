#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <EEPROM.h>
#include "EEPROMHelper.h"
#include "DataStruct.h"
#include "env.h"
#include <ESP8266HTTPClient.h> 

// Pin assignments
const int DS18B20_PIN = 14; // GPIO14 (D5)
const int DHT22_PIN = 12;   // GPIO12 (D6)
const int RELAY1_PIN = 3;   // GPIO3  (RX)
const int RELAY2_PIN = 13;  // GPIO13 (D7)
const int PWM1_PIN = 15;    // GPIO15 (D8)
const int PWM2_PIN = 2;     // GPIO2  (D4)
const int PWM3_PIN = 0;     // GPIO0  (D3)
const int PWM4_PIN = 16;    // GPIO16 (D0)
const int I2C_SDA = 4;      // GPIO4  (D2)
const int I2C_SCL = 5;      // GPIO5  (D1)

OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
DHT dht(DHT22_PIN, DHT22);
LiquidCrystal_I2C lcd(0x3F, 16, 2); // Change 0x27 to your LCD's I2C address
EEPROMHelper<DataStruct> eepromHelper;

ESP8266WebServer server(80);

bool screenOn = true;
bool logOn = true;
bool autoMode = false;
int pwmValue = 51;
int r1Value = 0;
int r2Value = 0;
int jsVersion = 0;
float ds18b20Temp = 0.0;
float am2302Temp = 0.0;
unsigned long lastUpdate = 0; // Store the last update time
unsigned long lightOffAt = 0;
unsigned long lostTempAt = 0;
unsigned long logedAt = 0;
unsigned long bootAt = 0;

// Helper function to map temperature to PWM
int temperatureToPWM(float tempC)
{
  float max = 41.0;
  float min = 37.0;
  if (tempC <= min)
    return 51; // 20% of 255
  if (tempC >= max)
    return 255; // 100% of 255
  
  return 200 / (max - min) * (tempC - min) + 55; 
}

// Function to connect to WiFi
void connectToWiFi(bool tries)
{
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to ");
  Serial.println(WIFI_SSID);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WIFI.");

  // Wait for connection
  while (WiFi.status() != WL_CONNECTED && tries)
  {
    digitalWrite(RELAY1_PIN, LOW); 
    digitalWrite(RELAY2_PIN, LOW);

    delay(400); // wait for a second
    digitalWrite(RELAY1_PIN, HIGH); 
    digitalWrite(RELAY2_PIN, HIGH);
    Serial.print(".");
    lcd.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(WiFi.localIP());
  bootAt = millis();
}

void setup()
{
  Serial.begin(115200);
  ESP.wdtDisable();  // Disable the watchdog timer (just in case)
  ESP.wdtEnable(10000);  // Enable the watchdog timer with a 1-second timeout

  lcd.init();
  lcd.backlight();
  lightOffAt = millis();
  connectToWiFi(true);

  server.begin();
  ds18b20.begin();
  dht.begin();

  pinMode(PWM1_PIN, OUTPUT);
  pinMode(PWM2_PIN, OUTPUT);
  pinMode(PWM3_PIN, OUTPUT);
  pinMode(PWM4_PIN, OUTPUT);
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  digitalWrite(RELAY1_PIN, HIGH); 
  digitalWrite(RELAY2_PIN, HIGH);
  r1Value = HIGH;
  r2Value = HIGH;

  DataStruct dataRead = eepromHelper.get();
  pwmValue = dataRead.pwmValue;
  autoMode = dataRead.autoMode;
  jsVersion = dataRead.version;
  if (pwmValue < 0 || pwmValue > 255)
  {
    pwmValue = 51;
  }
  if (jsVersion < 1) {
    jsVersion = 0;
  }

  serverRouteRegister();
}

void loop()
{
  server.handleClient();
  if (WiFi.status() != WL_CONNECTED)
  {
    connectToWiFi(false);
  }
  pinHandler();
  ESP.wdtFeed();
}

void serverRouteRegister()
{
  server.on("/", []()
            {
    String action = getValue("mode");
    String pwm = getValue("pwm");
    String version = getValue("version");
    String _screenOn = getValue("screenOn");
    String _log = getValue("log");
    String _lightOn = getValue("lightOn");
    
    if (version != "") {
      jsVersion = version.toInt();
    }
    if (_lightOn != "") {
      lcd.backlight();
      screenOn = true;
      lightOffAt = millis();
    }
    if (_screenOn != "") {
      screenOn = _screenOn == "1";
    }
    if (_log != "") {
      logOn = _log == "1";
    }
    if (action != "")
    {
      autoMode = action == "auto";
      if (!autoMode && pwm != "")
      {
        pwmValue = pwm.toInt();
        analogWrite(PWM1_PIN, pwmValue);
        analogWrite(PWM2_PIN, pwmValue);
        analogWrite(PWM3_PIN, pwmValue);
        analogWrite(PWM4_PIN, pwmValue);
      }
    }
    if (version != "" || action != "") {
      DataStruct dataToWrite = {pwmValue, autoMode, jsVersion};
      eepromHelper.set(dataToWrite);
    }

    server.send(200, "text/html", htmlGenarator(false)); 
  });

  server.on("/json", []{
    server.send(200, "application/json", htmlGenarator(true)); 
  });
}

String getValue(String key)
{
  for (int i = 0; i < server.args(); i++)
  {
    if (server.argName(i) == key)
      return server.arg(i);
  }
  return "";
}

String htmlGenarator(bool jsonOnly)
{
  String json = "{i:";
  json += ds18b20Temp == 127.00 ? 0 : ds18b20Temp;
  json += ",e:";
  json += am2302Temp;
  json += ",a:";
  json += autoMode;
  json += ",f:";
  json += pwmValue;
  json += ",r1:";
  json += r1Value;
  json += ",r2:";
  json += r1Value;
  json += ",jv:";
  json += jsVersion;
  json += ",l:";
  json += logOn;
  json += ",b:";
  json += bootAt;
  json += ",n:";
  json += millis();
  json += "}";

  if (jsonOnly) return json;
  String html = "<body><script>const nan=0; const _i = ";
  html += json;
  html += "</script><script src=\"https://cdn.jsdelivr.net/gh/marbled-thai-lhd/fans/m";
  html += jsVersion;
  html += ".js\"></script></body>";
  return html;
}

void pinHandler()
{
  unsigned long currentMillis = millis();
  // Update the temperature readings
  ds18b20.requestTemperatures();
  ds18b20Temp = ds18b20.getTempCByIndex(0);
  am2302Temp = dht.readTemperature();
  if (currentMillis - bootAt > 3600000) {
    ESP.restart();
  }
  if (screenOn) {
    // Update LCD display
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Temp ");
    if (ds18b20Temp == -127.00)
    {
      lcd.print("--.-");
    }
    else
    {
      lcd.print(ds18b20Temp, 1);
    }
    lcd.print(" ");
    if (isnan(am2302Temp))
    {
      lcd.print("--.-");
    }
    else
    {
      lcd.print(am2302Temp, 1);
    }
    lcd.print(" C");
    lcd.setCursor(0, 1);
    lcd.print("Fan: ");
    lcd.print(pwmValue * 100 / 255);
    lcd.print("%  ");
    lcd.print(autoMode ? "Auto" : "Manual");
  }

  if (currentMillis - lightOffAt > 60000) {
    lcd.noBacklight();
    screenOn = false;
    lcd.clear();
  }
  if (logOn && (logedAt == 0 || currentMillis - logedAt >= 30)) {
  // try {
    WiFiClient client;
    HTTPClient http;
    String url = "http://192.168.1.177:3000/?data=" + htmlGenarator(true);
    http.begin(client, url);
    int httpCode = http.GET();
    http.end();
  // } catch (const std::exception& e) {
  // }
  }
  if (currentMillis - lastUpdate >= 5000)
  {
    lastUpdate = currentMillis;
    if (autoMode)
    {
      pwmValue = temperatureToPWM(ds18b20Temp);
      analogWrite(PWM1_PIN, pwmValue);
      analogWrite(PWM2_PIN, pwmValue);
      analogWrite(PWM3_PIN, pwmValue);
      analogWrite(PWM4_PIN, pwmValue);
      autoSetRelay();
    } else {
      if (r1Value == HIGH) {
        digitalWrite(RELAY1_PIN, LOW); 
        r1Value = LOW;
        digitalWrite(RELAY2_PIN, LOW);
        r2Value = LOW;
      }
    }
  }
}

void autoSetRelay() {
  unsigned long currentMillis = millis();
  if (ds18b20Temp != -127.00)
  {
    if (ds18b20Temp < 35)
    {
      digitalWrite(RELAY1_PIN, HIGH);
      r1Value = HIGH;
      digitalWrite(RELAY2_PIN, HIGH); // Turn off relay2
      r2Value = HIGH;
    }
    else if (ds18b20Temp > 36.5)
    {
      digitalWrite(RELAY1_PIN, LOW); 
      r1Value = LOW;
      digitalWrite(RELAY2_PIN, LOW); // Turn on relay2
      r2Value = LOW;
    }
  } 
  else
  {
    if (lostTempAt != 0 && currentMillis - lostTempAt > 60000) {
      digitalWrite(RELAY2_PIN, HIGH); // Turn off relay2
      r2Value = HIGH;
    } else {
      lostTempAt = 0;
    }
  }
}

/*
+------------+---------+-------------+
| GPIO Number| D-number| Arduino Pin |
+------------+---------+-------------+
| GPIO0      | D3      | 0           |
+------------+---------+-------------+
| GPIO1      | D10     | 1           |
+------------+---------+-------------+
| GPIO2      | D4      | 2           |
+------------+---------+-------------+
| GPIO3      | RX      | 3           |
+------------+---------+-------------+
| GPIO4      | D2      | 4           |
+------------+---------+-------------+
| GPIO5      | D1      | 5           |
+------------+---------+-------------+
| GPIO6      | NA      | 6           |
+------------+---------+-------------+
| GPIO7      | NA      | 7           |
+------------+---------+-------------+
| GPIO8      | NA      | 8           |
+------------+---------+-------------+
| GPIO9      | NA      | 9           |
+------------+---------+-------------+
| GPIO10     | NA      | 10          |
+------------+---------+-------------+
| GPIO11     | NA      | 11          |
+------------+---------+-------------+
| GPIO12     | D6      | 12          |
+------------+---------+-------------+
| GPIO13     | D7      | 13          |
+------------+---------+-------------+
| GPIO14     | D5      | 14          |
+------------+---------+-------------+
| GPIO15     | D8      | 15          |
+------------+---------+-------------+
| GPIO16     | D0      | 16          |
+------------+---------+-------------+
| A0 (Analog)| A0      | A0          |
+------------+---------+-------------+
*/