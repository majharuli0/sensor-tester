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
const blufiEmitter = new NativeEventEmitter(BlufiBridge);
const scannerEmitter = new NativeEventEmitter(BluetoothScannerModule);

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<any[]>([]);
  const [deviceMac, setDeviceMac] = useState("");
  const [connected, setConnected] = useState(false);

  // Inputs
  const [ssid, setSsid] = useState("TP-Link_AD75");
  const [password, setPassword] = useState("82750152");
  const [customData, setCustomData] = useState("");
  const [deviceUid, setDeviceUid] = useState("");
  const [mqttServer, setMqttServer] = useState("3.104.3.162");
  const [mqttPort, setMqttPort] = useState("1060");

  const addLog = (msg: string) =>
    setLogs((p) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p]);

  // PERMISSIONS
  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ];
        
        const result = await PermissionsAndroid.requestMultiple(permissions);
        addLog("Permissions Result: " + JSON.stringify(result));
        
        const allGranted = Object.values(result).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );
        
        return allGranted;
      } catch (err) {
        addLog("Permission Error: " + err);
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    const statusSub = blufiEmitter.addListener("BlufiStatus", (event) => {
      addLog("STATUS: " + (event.status || JSON.stringify(event)));
      // Handle both string status and integer state (2 = Connected, 0 = Disconnected)
      if (event.status === "Connected" || event.state === 2) {
        setConnected(true);
        addLog("State updated to CONNECTED");
      }
      if (event.status === "Disconnected" || event.state === 0) {
        setConnected(false);
        addLog("State updated to DISCONNECTED");
      }
      
      // Handle Success Responses
      if (typeof event.status === 'string') {
          if (event.status.includes("Security Result: 0")) {
              Alert.alert("Success", "Security Negotiation Complete!");
          }
          if (event.status.includes("Configure Params: 0")) {
              Alert.alert("Success", "Wi-Fi Credentials Sent! Device may reboot now.");
          }
      }
    });
    
    const logSub = blufiEmitter.addListener("BlufiLog", (event) => {
      console.log("BlufiLog:", event.log);
      addLog("LOG: " + (event.log || JSON.stringify(event)));
    });

    const dataSub = blufiEmitter.addListener("BlufiData", (event) => {
      addLog("RECEIVED: " + (event.data || JSON.stringify(event)));
      if (event.data && event.data.includes("uID:")) {
          const uid = event.data.split("uID:")[1].trim();
          setDeviceUid(uid);
          addLog("UID Extracted: " + uid);
      }
    });

    const scanSub = scannerEmitter.addListener("DeviceFound", (device) => {
      setScannedDevices((prev) => {
        if (prev.some((d) => d.mac === device.mac)) return prev;
        return [...prev, device];
      });
    });

    // New ScanLog listener
    const scanLogSub = scannerEmitter.addListener("ScanLog", (event) => {
        console.log("ScanLog:", event.log);
        addLog("SCAN: " + (event.log || JSON.stringify(event)));
    });

    const scanErrorSub = scannerEmitter.addListener("ScanError", (event) => {
      addLog("SCAN ERROR: " + (event.error || JSON.stringify(event)));
      Alert.alert("Scan Error", event.error || "Unknown error occurred");
      setIsScanning(false);
    });

    return () => {
      statusSub.remove();
      logSub.remove();
      dataSub.remove();
      scanSub.remove();
      scanLogSub.remove();
      scanErrorSub.remove();
    };
  }, []);

  const handleScanToggle = async () => {
    addLog("Scan button pressed."); // Immediate feedback
    if (isScanning) {
      BluetoothScannerModule.stopScan();
      setIsScanning(false);
      addLog("Scanning stopped.");
    } else {
      addLog("Requesting permissions...");
      const hasPerms = await requestPermissions();
      if (hasPerms) {
        setScannedDevices([]);
        addLog("Starting Scan...");
        BluetoothScannerModule.startScan();
        setIsScanning(true);
      } else {
        Alert.alert("Permission Denied", "Permissions required to scan.");
        addLog("Scan failed: Permissions denied.");
      }
    }
  };

  const handleConnect = async () => {
    if (!deviceMac) return Alert.alert("Error", "Select a device first.");
    try {
      addLog(`Connecting to ${deviceMac}...`);
      await BlufiBridge.connect(deviceMac);
      // Fallback: Assume connected if no error thrown, in case event is missed
      setConnected(true); 
    } catch (e: any) {
      addLog("Error: " + e.message);
      setConnected(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await BlufiBridge.disconnect();
      setConnected(false);
      addLog("Disconnected.");
    } catch (e: any) {
      addLog("Error: " + e.message);
    }
  };

  const handleNegotiateSecurity = async () => {
    try {
      addLog("Negotiating Security...");
      await BlufiBridge.negotiateSecurity();
    } catch (e: any) {
      addLog("Error: " + e.message);
    }
  };

  const handleConfigureWifi = async () => {
    try {
      addLog(`Configuring Wi-Fi: ${ssid}`);
      await BlufiBridge.configureWifi(ssid, password);
    } catch (e: any) {
      addLog("Error: " + e.message);
    }
  };

  const handleConfigureMqtt = async () => {
      try {
          addLog(`Sending MQTT Config: ${mqttServer}:${mqttPort}`);
          // 1. Send IP
          await BlufiBridge.postCustomData(`1:${mqttServer}`);
          // 2. Send Port
          await BlufiBridge.postCustomData(`2:${mqttPort}`);
          // 3. Finalize
          await BlufiBridge.postCustomData("8:0");
          addLog("MQTT Config Sent. Waiting for device...");
      } catch (e: any) {
          addLog("Error sending MQTT config: " + e.message);
      }
  };

  const handlePostCustomData = async () => {
    try {
      addLog(`Sending Data: ${customData}`);
      await BlufiBridge.postCustomData(customData);
    } catch (e: any) {
      addLog("Error: " + e.message);
    }
  };

  const handleRequestStatus = async () => {
    try {
      addLog("Requesting Device Status (sends 12:)...");
      // Reference app sends "12:" to trigger status response with UID
      await BlufiBridge.postCustomData("12:");
      await BlufiBridge.requestDeviceStatus();
    } catch (e: any) {
      addLog("Error: " + e.message);
    }
  };

  const handleRequestVersion = async () => {
    try {
      addLog("Requesting Device Version...");
      await BlufiBridge.requestDeviceVersion();
    } catch (e: any) {
      addLog("Error: " + e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Blufi Debugger</Text>

        {/* SCANNER */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Scan & Connect</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={handleScanToggle}>
              <Text style={styles.btnText}>{isScanning ? "Stop Scan" : "Scan"}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btn, connected ? styles.btnRed : styles.btnGreen, { marginLeft: 10 }]} 
              onPress={connected ? handleDisconnect : handleConnect}
            >
              <Text style={styles.btnText}>{connected ? "Disconnect" : "Connect"}</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.subText}>Selected: {deviceMac || "None"}</Text>

          {scannedDevices.length > 0 && (
            <ScrollView 
              style={styles.deviceList} 
              nestedScrollEnabled={true}
            >
              {scannedDevices.map((d, i) => (
                <TouchableOpacity key={i} style={styles.deviceItem} onPress={() => {
                  setDeviceMac(d.mac);
                  BluetoothScannerModule.stopScan();
                  setIsScanning(false);
                }}>
                  <Text style={{fontWeight:'bold'}}>{d.name || "Unknown"}</Text>
                  <Text>{d.mac} (RSSI: {d.rssi})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ACTIONS */}
        <View style={[styles.card, { opacity: connected ? 1 : 0.6 }]}>
          <Text style={styles.sectionTitle}>2. Actions</Text>
          
          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={handleNegotiateSecurity} disabled={!connected}>
            <Text style={styles.btnOutlineText}>Negotiate Security</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.label}>Device UID</Text>
          <View style={styles.row}>
             <TextInput 
                style={[styles.input, {flex: 1}]} 
                placeholder="Device UID" 
                value={deviceUid} 
                onChangeText={setDeviceUid} 
             />
             <TouchableOpacity style={[styles.btn, styles.btnOutline, {marginLeft: 5}]} onPress={handleRequestStatus} disabled={!connected}>
                <Text style={styles.btnOutlineText}>Get UID</Text>
             </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <Text style={styles.label}>Wi-Fi Configuration</Text>
          <TextInput style={styles.input} placeholder="SSID" value={ssid} onChangeText={setSsid} />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={handleConfigureWifi} disabled={!connected}>
            <Text style={styles.btnText}>Configure Wi-Fi</Text>
          </TouchableOpacity>

          <View style={styles.divider} />
          
          <Text style={styles.label}>MQTT Configuration</Text>
          <TextInput style={styles.input} placeholder="MQTT Server" value={mqttServer} onChangeText={setMqttServer} />
          <TextInput style={styles.input} placeholder="MQTT Port" value={mqttPort} onChangeText={setMqttPort} />
          <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={handleConfigureMqtt} disabled={!connected}>
            <Text style={styles.btnText}>Send MQTT Config</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.label}>Custom Data</Text>
          <TextInput style={styles.input} placeholder="Data (e.g. 12:)" value={customData} onChangeText={setCustomData} />
          <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={handlePostCustomData} disabled={!connected}>
            <Text style={styles.btnText}>Send Data</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, {flex:1, marginLeft:5}]} onPress={handleRequestVersion} disabled={!connected}>
              <Text style={styles.btnOutlineText}>Get Version</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* LOGS */}
        <View style={styles.logs}>
          {logs.map((l, i) => (
            <Text key={i} style={styles.logText}>{l}</Text>
          ))}
        </View>
        <View style={{height: 50}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  card: { backgroundColor: "white", padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center" },
  btn: { padding: 12, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  btnBlue: { backgroundColor: "#007AFF" },
  btnGreen: { backgroundColor: "#28a745" },
  btnRed: { backgroundColor: "#dc3545" },
  btnOutline: { borderWidth: 1, borderColor: "#007AFF", backgroundColor: "transparent" },
  btnText: { color: "white", fontWeight: "bold" },
  btnOutlineText: { color: "#007AFF", fontWeight: "bold" },
  subText: { marginTop: 10, color: "#666" },
  deviceList: { marginTop: 10, maxHeight: 150, backgroundColor: "#f9f9f9", borderRadius: 5 },
  deviceItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 5, padding: 10, marginBottom: 10 },
  label: { fontWeight: "bold", marginBottom: 5, marginTop: 10 },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 15 },
  logs: { backgroundColor: "#222", padding: 10, borderRadius: 5, minHeight: 150 },
  logText: { color: "#0f0", fontFamily: "monospace", fontSize: 11, marginBottom: 2 },
});
