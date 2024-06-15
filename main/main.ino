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

// Pin assignments
const int DS18B20_PIN = 14; // GPIO14 (D5)
const int DHT22_PIN = 12;   // GPIO12 (D6)
const int RELAY1_PIN = 5;   // GPIO1 (TX)
const int RELAY2_PIN = 13;  // GPIO13 (D7)
const int PWM1_PIN = 15;    // GPIO15 (D8)
const int PWM2_PIN = 2;     // GPIO2 (D4)
const int PWM3_PIN = 0;     // GPIO0 (D3)
const int PWM4_PIN = 16;    // GPIO16 (D0)
const int I2C_SDA = 4;      // GPIO4 (D2)
const int I2C_SCL = 5;      // GPIO5 (D1)

OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
DHT dht(DHT22_PIN, DHT22);
LiquidCrystal_I2C lcd(0x3F, 16, 2); // Change 0x27 to your LCD's I2C address
EEPROMHelper<DataStruct> eepromHelper;

ESP8266WebServer server(80);

bool screenOn = false;
bool autoMode = false;
int pwmValue = 51;
int jsVersion = 0;
float ds18b20Temp = 0.0;
float am2302Temp = 0.0;
unsigned long lastUpdate = 0; // Store the last update time

// Helper function to map temperature to PWM
int temperatureToPWM(float tempC)
{
  if (tempC <= 37.0)
    return 51; // 20% of 255
  if (tempC >= 41.0)
    return 255; // 100% of 255
  return map(tempC, 37.0, 41.0, 51, 255);
}

// Function to connect to WiFi
void connectToWiFi()
{
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to ");
  Serial.println(WIFI_SSID);

  // Wait for connection
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(400); // wait for a second
    Serial.print(".");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WIFI....");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(WiFi.localIP());
}

void setup()
{
  Serial.begin(115200);
  lcd.init();
  lcd.backlight();
  connectToWiFi();

  server.begin();
  ds18b20.begin();
  dht.begin();

  pinMode(PWM1_PIN, OUTPUT);
  pinMode(PWM2_PIN, OUTPUT);
  pinMode(PWM3_PIN, OUTPUT);
  pinMode(PWM4_PIN, OUTPUT);
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  digitalWrite(RELAY1_PIN, LOW); // Ensure relay1 is off initially
  digitalWrite(RELAY2_PIN, LOW); // Ensure relay2 is off initially

  DataStruct dataRead = eepromHelper.get();
  pwmValue = dataRead.pwmValue;
  autoMode = dataRead.autoMode;
  jsVersion = dataRead.version;
  if (pwmValue < 0 || pwmValue > 255)
  {
    pwmValue = 51;
  }

  serverRouteRegister();
}

void loop()
{
  server.handleClient();
  if (WiFi.status() != WL_CONNECTED)
  {
    connectToWiFi();
  }
  pinHandler();
}

void serverRouteRegister()
{
  server.on("/", []()
            {
    String action = getValue("mode");
    String pwm = getValue("pwm");
    String version = getValue("version");
    String _screenOn = getValue("screenOn");
    if (version != "") {
      jsVersion = version.toInt();
    }
    if (_screenOn != "") {
      screenOn = _screenOn == "1";
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

  if (screenOn) {
    // Update LCD display
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Temp");
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
    lcd.print(pwmValue * 100 / 255, 2);
    lcd.print("%  ");
    lcd.print(autoMode ? "Auto" : "Manual");
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
    }

    if (!isnan(am2302Temp) && ds18b20Temp != -127.00)
    {
      if (ds18b20Temp < (am2302Temp + 2) || ds18b20Temp < 36)
      {
        digitalWrite(RELAY1_PIN, LOW); // Turn off relay1
      }
      else
      {
        digitalWrite(RELAY1_PIN, HIGH); // Turn on relay1
      }
    }

    // Control relay2 based on DS18B20 temperature
    if (ds18b20Temp != -127.00)
    {
      digitalWrite(RELAY2_PIN, HIGH); // Turn on relay2
    }
    else
    {
      digitalWrite(RELAY2_PIN, LOW); // Turn off relay2
    }
  }
  
}

/*
Wired Connections:
- Connect DS18B20 data pin to GPIO14 (D5)
- Connect DHT22 data pin to GPIO12 (D6)
- Connect relay1 to GPIO16 (D0)
- Connect relay2 to GPIO13 (D7)
- Connect PWM1 to GPIO15 (D8)
- Connect PWM2 to GPIO2 (D4)
- Connect PWM3 to GPIO0 (D3)
- Connect PWM4 to GPIO4 (D2)
- Connect I2C SDA pin to GPIO4 (D2)
- Connect I2C SCL pin to GPIO5 (D1)
*/
