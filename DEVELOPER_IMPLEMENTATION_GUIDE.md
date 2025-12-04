# React Native ESP32 BluFi Implementation Guide

This guide outlines the technical steps required to implement ESP32 Wi-Fi Provisioning (BluFi) in a React Native Android application.

## 1. Native Setup (Android)

### Dependencies (`android/app/build.gradle`)
Ensure the Espressif BluFi library is included. You can use the official library or a local module.
```gradle
dependencies {
    implementation 'com.github.EspressifApp:lib-blufi-android:2.4.1'
    // ... other dependencies
}
```

### Permissions (`AndroidManifest.xml`)
Required permissions for BLE scanning and connection:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

## 2. Native Modules (Java)

You need two Native Modules: one for Scanning and one for BluFi communication.

### A. BluetoothScannerModule
*   **Purpose**: Scans for BLE devices.
*   **Key Implementation**:
    *   Use `BluetoothLeScanner` (not classic Bluetooth).
    *   Use `ScanSettings.SCAN_MODE_LOW_LATENCY` for fast discovery.
    *   Emit a `DeviceFound` event to JS with the device Name and MAC Address.

### B. BlufiModule (The Bridge)
*   **Purpose**: Wraps the `BlufiClient` to handle connection and data transfer.
*   **Key Implementation**:
    *   Extend `ReactContextBaseJavaModule`.
    *   Methods to expose: `connect`, `negotiateSecurity`, `configureWifi`, `postCustomData`.
    *   **CRITICAL FIX**: When implementing `BlufiCallback`, ensure you include the `BlufiClient` parameter in the method signatures. If you omit it, the callbacks **will not fire**.

    **Correct Signature Example:**
    ```java
    @Override
    public void onNegotiateSecurityResult(BlufiClient client, int status) {
        // ... handle result
    }
    ```

    **Incorrect Signature (DO NOT USE):**
    ```java
    public void onNegotiateSecurityResult(int status) { ... } // This will fail silently!
    ```

*   **Event Emitter Support**:
    *   Implement `addListener` and `removeListeners` methods (even if empty) to avoid React Native warnings.

## 3. React Native Integration (TypeScript)

### Logic Flow
1.  **Scan**: Start scanning and listen for `DeviceFound` events.
2.  **Connect**: Call `BlufiBridge.connect(macAddress)`.
3.  **Security**: Call `BlufiBridge.negotiateSecurity()`.
    *   Wait for success status (0).
4.  **Wi-Fi**: Call `BlufiBridge.configureWifi(ssid, password)`.
    *   Wait for success status (0).
    *   Device will typically reboot or disconnect here.
5.  **MQTT Configuration (Custom Data)**:
    *   The device expects specific custom data packets to set up MQTT.
    *   **Send IP**: `BlufiBridge.postCustomData("1:" + mqttIp)`
    *   **Send Port**: `BlufiBridge.postCustomData("2:" + mqttPort)`
    *   **Finalize**: `BlufiBridge.postCustomData("8:0")`

### Example Code Snippet
```typescript
import { NativeModules, NativeEventEmitter } from 'react-native';
const { BlufiBridge } = NativeModules;
const blufiEmitter = new NativeEventEmitter(BlufiBridge);

// Listen for status updates
blufiEmitter.addListener("BlufiStatus", (event) => {
    console.log("Status:", event.status);
});

// 1. Connect
await BlufiBridge.connect(deviceMac);

// 2. Security
await BlufiBridge.negotiateSecurity();

// 3. Wi-Fi
await BlufiBridge.configureWifi("MySSID", "MyPassword");

// 4. MQTT
await BlufiBridge.postCustomData("1:192.168.1.100"); // Server IP
await BlufiBridge.postCustomData("2:1883");          // Server Port
await BlufiBridge.postCustomData("8:0");             // Done
```
