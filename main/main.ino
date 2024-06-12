#include <ESP8266WiFi.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// Pin assignments
const int DS18B20_PIN = 14;   // GPIO14 (D5)
const int DHT22_PIN = 12;     // GPIO12 (D6)
const int RELAY1_PIN = 16;    // GPIO16 (D0)
const int RELAY2_PIN = 13;    // GPIO13 (D7)
const int PWM1_PIN = 15;      // GPIO15 (D8)
const int PWM2_PIN = 2;       // GPIO2 (D4)
const int PWM3_PIN = 0;       // GPIO0 (D3)
const int PWM4_PIN = 4;       // GPIO4 (D2)
const int I2C_SDA = 4;        // GPIO4 (D2)
const int I2C_SCL = 5;        // GPIO5 (D1)

OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
DHT dht(DHT22_PIN, DHT22);
LiquidCrystal_I2C lcd(0x27, 16, 2); // Change 0x27 to your LCD's I2C address

// Network settings
const char* ssid = "JinZun GF";
const char* password = "your_PASSWORD";
WiFiServer server(80);

bool autoMode = false;
int pwmValue = 0;
float ds18b20Temp = 0.0;
float am2302Temp = 0.0;
unsigned long lastUpdate = 0;  // Store the last update time

// Helper function to map temperature to PWM
int temperatureToPWM(float tempC) {
  if (tempC <= 37.0) return 51;  // 20% of 255
  if (tempC >= 41.0) return 255; // 100% of 255
  return map(tempC, 37.0, 41.0, 51, 255);
}

void setup() {
  Serial.begin(115200);
  lcd.init();
  lcd.backlight();
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);                      // wait for a second
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
}

void loop() {
  WiFiClient client = server.available();
  if (client) {
    Serial.println("Connect");
    // Read the client's request
    String request = client.readStringUntil('\r');
    Serial.println(request);
    client.flush();  // Clear the client's buffer
    
    // Check if auto or manual mode is requested
    if (request.indexOf("GET /auto") >= 0) {
      autoMode = true;
    } else if (request.indexOf("GET /manual") >= 0) {
      autoMode = false;
      String pwmParam = "pwm=";
      int pwmStart = request.indexOf(pwmParam) + pwmParam.length();
      int pwmEnd = request.indexOf("&", pwmStart);
      if (pwmEnd == -1) pwmEnd = request.indexOf(" ", pwmStart);
      pwmValue = request.substring(pwmStart, pwmEnd).toInt();
      analogWrite(PWM1_PIN, pwmValue);
      analogWrite(PWM2_PIN, pwmValue);
      analogWrite(PWM3_PIN, pwmValue);
      analogWrite(PWM4_PIN, pwmValue);
    }

    // Construct the HTML response
    String html = "<html><body>";
    html += "<h1>ESP8266 Web Server</h1>";
    html += "<h2>Mode: ";
    html += autoMode ? "Auto" : "Manual";
    html += "</h2>";
    if (ds18b20Temp == -127.00) {
      html += "<h2>Error reading DS18B20 temperature!</h2>";
    } else {
      html += "<h2>Ivt: " + String(ds18b20Temp) + " &deg;C";
    }
    if (isnan(am2302Temp)) {
      html += "<h2>Error reading ENV temperature!</h2>";
    } else {
      html += "<h2>Env: " + String(am2302Temp) + " &deg;C</h2>";
    }

    // Display auto/manual mode button
    html += "<form action=\"/";
    html += !autoMode ? "auto" : "manual";
    html += "\"><input type=\"submit\" value=\"";
    html += autoMode ? "Set Manual" : "Set Auto";
    html += "\"></form>";

    // Display slider for manual mode
    html += "<form action=\"/manual\">";
    html += "PWM: <input type=\"range\" name=\"pwm\" min=\"0\" max=\"255\" value=\"";
    html += String(pwmValue);
    html += "\">";
    html += "<input type=\"submit\" value=\"Set PWM\"></form>";

    html += "</body></html>";
    
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: text/html");
    client.println("Connection: close");
    client.println();
    client.println(html);
    
    client.stop();
  }

  unsigned long currentMillis = millis();
  if (currentMillis - lastUpdate >= 5000) {
    lastUpdate = currentMillis;
    
    // Update the temperature readings
    ds18b20.requestTemperatures();
    ds18b20Temp = ds18b20.getTempCByIndex(0);
    am2302Temp = dht.readTemperature();
    
    // Update LCD display
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Ivt: ");
    if (ds18b20Temp == -127.00) {
      lcd.print("--");
    } else {
      lcd.print(ds18b20Temp, 1);
    }
    lcd.print(" C       Env: ");
    if (isnan(am2302Temp)) {
      lcd.print("--");
    } else {
      lcd.print(am2302Temp, 1);
    }
    lcd.setCursor(0, 1);
    lcd.print("Fan: ");
    lcd.print(map(pwmValue, 0, 255, 0, 100));
    lcd.print("%                ");
    lcd.print(autoMode ? "Auto" : "Manual");

    // Control fans based on auto/manual mode
    if (autoMode) {
      pwmValue = temperatureToPWM(ds18b20Temp);
      analogWrite(PWM1_PIN, pwmValue);
      analogWrite(PWM2_PIN, pwmValue);
      analogWrite(PWM3_PIN, pwmValue);
      analogWrite(PWM4_PIN, pwmValue);
    }

    // Control relay1 based on temperature difference
    if (!isnan(am2302Temp) && ds18b20Temp != -127.00) {
      if (ds18b20Temp < (am2302Temp + 2) || ds18b20Temp < 36) {
        digitalWrite(RELAY1_PIN, LOW); // Turn off relay1
      } else {
        digitalWrite(RELAY1_PIN, HIGH); // Turn on relay1
      }
    }

    // Control relay2 based on DS18B20 temperature
    if (ds18b20Temp != -127.00) {
      digitalWrite(RELAY2_PIN, HIGH); // Turn on relay2
    } else {
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
