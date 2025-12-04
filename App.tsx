import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  NativeModules,
  NativeEventEmitter,
  Alert,
  Platform,
  PermissionsAndroid,
  SafeAreaView,
} from "react-native";

// Access Native Modules
const { BlufiBridge, BluetoothScannerModule } = NativeModules;

// Create Emitters
// Note: Some RN versions/modules require the module to be passed to the emitter constructor
const blufiEmitter = new NativeEventEmitter(BlufiBridge);
const scannerEmitter = new NativeEventEmitter(BluetoothScannerModule);

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);

  // SCANNER STATE
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<any[]>([]);

  // CONFIGURATION INPUTS
  const [deviceMac, setDeviceMac] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [mqttIp, setMqttIp] = useState("3.104.3.162");
  const [mqttPort, setMqttPort] = useState("1060");

  const addLog = (msg: string) =>
    setLogs((p) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p]);

  // PERMISSIONS (Required for BLE Scanning on Android)
  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        return granted;
      } catch (err) {
        addLog("Permission Error: " + err);
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    // --- BLUFI LISTENERS ---
    const statusSub = blufiEmitter.addListener("BlufiStatus", (msg) =>
      addLog("STATUS: " + msg)
    );
    const dataSub = blufiEmitter.addListener("BlufiData", (msg) =>
      addLog("RECEIVED: " + msg)
    );

    // --- SCANNER LISTENERS ---
    // Adjust event name 'DeviceDiscovered' if your native module uses a different name
    const scanSub = scannerEmitter.addListener("DeviceDiscovered", (device) => {
      setScannedDevices((prev) => {
        // Prevent duplicates based on MAC address
        if (prev.some((d) => d.mac === device.mac)) return prev;
        return [...prev, device];
      });
    });

    return () => {
      statusSub.remove();
      dataSub.remove();
      scanSub.remove();
    };
  }, []);

  // --- SCANNER ACTIONS ---
  const handleScanToggle = async () => {
    if (isScanning) {
      BluetoothScannerModule.stopScan();
      setIsScanning(false);
      addLog("Scanning stopped.");
    } else {
      const hasPerms = await requestPermissions();
      if (hasPerms) {
        setScannedDevices([]); // Clear previous list
        BluetoothScannerModule.startScan();
        setIsScanning(true);
        addLog("Scanning started...");
      } else {
        Alert.alert(
          "Permission Denied",
          "Location/Bluetooth permissions required to scan."
        );
      }
    }
  };

  const handleSelectDevice = (mac: string) => {
    setDeviceMac(mac);
    BluetoothScannerModule.stopScan();
    setIsScanning(false);
    addLog(`Selected device: ${mac}`);
  };

  // STEP 1: Connect
  const handleConnect = async () => {
    if (!deviceMac) {
      Alert.alert("Error", "Enter MAC Address");
      return;
    }
    try {
      addLog(`Connecting to ${deviceMac}...`);
      await BlufiBridge.connect(deviceMac);
      addLog("Connect command sent. Waiting for status...");
    } catch (e: any) {
      addLog("Error: " + e.message);
    }
  };

  // STEP 2: Negotiate Security
  const handleSecurity = async () => {
    try {
      addLog("Negotiating Security...");
      await BlufiBridge.negotiateSecurity();
    } catch (e: any) {
      addLog("Error: " + e.message);
    }
  };

  // STEP 3: Configure Wi-Fi
  const handleWifi = async () => {
    try {
      addLog(`Sending Wi-Fi: ${ssid}`);
      await BlufiBridge.configureWifi(ssid, password);
    } catch (e: any) {
      addLog("Error: " + e.message);
    }
  };

  // STEP 4: Configure MQTT
  const handleCustomData = async () => {
    try {
      addLog("Sending Custom Data...");
      await BlufiBridge.postCustomData(`1:${mqttIp}`);
      addLog(`Sent: 1:${mqttIp}`);
      await BlufiBridge.postCustomData(`2:${mqttPort}`);
      addLog(`Sent: 2:${mqttPort}`);
      await BlufiBridge.postCustomData("12:");
      addLog("Sent: 12: (Request UID)");
    } catch (e: any) {
      addLog("Error: " + e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f2f2f2" }}>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Sensor Config Tool</Text>

        {/* SECTION 1: TARGET DEVICE + SCANNER */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>1. Target Device</Text>
            <TouchableOpacity
              style={[
                styles.smallBtn,
                isScanning ? styles.btnDanger : styles.btnSuccess,
              ]}
              onPress={handleScanToggle}
            >
              <Text style={styles.smallBtnText}>
                {isScanning ? "Stop Scan" : "Scan Devices"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Device List Area */}
          {isScanning && scannedDevices.length > 0 && (
            <View style={styles.deviceList}>
              {scannedDevices.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.deviceItem}
                  onPress={() => handleSelectDevice(item.mac)}
                >
                  <Text style={styles.deviceName}>
                    {item.name || "Unknown Device"}
                  </Text>
                  <Text style={styles.deviceMac}>
                    {item.mac} (RSSI: {item.rssi})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="MAC Address (AA:BB...)"
            value={deviceMac}
            onChangeText={setDeviceMac}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.btn} onPress={handleConnect}>
            <Text style={styles.btnText}>Connect</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>2. Security</Text>
          <TouchableOpacity style={styles.btn} onPress={handleSecurity}>
            <Text style={styles.btnText}>Negotiate Security</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>3. Wi-Fi Settings</Text>
          <TextInput
            style={styles.input}
            placeholder="SSID"
            value={ssid}
            onChangeText={setSsid}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity style={styles.btn} onPress={handleWifi}>
            <Text style={styles.btnText}>Send Wi-Fi</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>4. MQTT Settings</Text>
          <TextInput
            style={styles.input}
            placeholder="IP"
            value={mqttIp}
            onChangeText={setMqttIp}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Port"
            value={mqttPort}
            onChangeText={setMqttPort}
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.btn} onPress={handleCustomData}>
            <Text style={styles.btnText}>Send Config</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logs}>
          {logs.map((l, i) => (
            <Text key={i} style={styles.logText}>
              {l}
            </Text>
          ))}
        </View>

        {/* Spacer for bottom scrolling */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    elevation: 2, // Android shadow
    shadowColor: "#000", // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: { fontWeight: "bold", fontSize: 16 },
  input: {
    borderBottomWidth: 1,
    borderColor: "#ddd",
    marginBottom: 10,
    padding: 8,
    fontSize: 14,
  },
  btn: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 5,
  },
  btnText: { color: "white", fontWeight: "bold", fontSize: 16 },

  // Scanner UI Styles
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
  },
  btnSuccess: { backgroundColor: "#28a745" },
  btnDanger: { backgroundColor: "#dc3545" },
  smallBtnText: { color: "white", fontSize: 12, fontWeight: "bold" },

  deviceList: {
    maxHeight: 150,
    backgroundColor: "#f9f9f9",
    marginBottom: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#eee",
  },
  deviceItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  deviceName: { fontWeight: "bold", fontSize: 14 },
  deviceMac: { fontSize: 12, color: "#666" },

  logs: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 5,
    marginTop: 20,
    minHeight: 200,
  },
  logText: {
    color: "#0f0",
    fontFamily: "monospace",
    fontSize: 12,
    marginBottom: 2,
  },
});
