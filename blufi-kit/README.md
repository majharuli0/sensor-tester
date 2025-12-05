# 🚀 React Native Blufi (Espressif) Integration Kit

A **robust, self-contained, and portable** solution for integrating Espressif's Blufi (Wi-Fi Provisioning) into React Native applications. 

Designed to solve the build and runtime issues found in unmaintained libraries like `react-native-blufi` (kefudev) and `orbitsystems`.

---

## 🧐 Why this Kit?

If you are trying to implement Espressif Blufi in React Native, you likely faced these issues with existing libraries:
*   ❌ **Build Failures**: Incompatibility with modern Gradle, Android 12+, or iOS 16+.
*   ❌ **Missing Permissions**: Crashes on Android 12+ due to missing `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` permissions.
*   ❌ **Linking Errors**: "Module not found" or null pointer exceptions at runtime.
*   ❌ **Abandoned**: Most libraries haven't been updated in years.

**This Kit Solves It By:**
*   ✅ **Providing Raw Source Code**: No compiled binaries or hidden dependencies. You get the actual Swift and Java files.
*   ✅ **Automated Setup Scripts**: One-command setup for iOS and Android (`npm run setup:ios`, `npm run setup:android`).
*   ✅ **Modern Android Support**: Automatically handles Android 12+ Bluetooth permissions in `AndroidManifest.xml`.
*   ✅ **Modern iOS Support**: Written in Swift with proper `Podspec` and `Info.plist` configuration.
*   ✅ **TypeScript Client**: Includes a ready-to-use `BlufiClient.ts` wrapper.

---

## 📦 Contents

*   `ios-reference/`: Native iOS source files (Swift/Obj-C) and Podspec.
*   `scripts/`: Automation scripts (`setup-ios.js`, `setup-android.js`).
*   `BlufiClient.ts`: TypeScript wrapper for the native modules.

---

## 🚀 Installation Guide

### 1. Copy Files
Copy the contents of this kit into the **root** of your React Native project.

```bash
cp -r blufi-kit/* /path/to/your/project/
```

### 2. Install Dependencies
This kit uses `react-native-permissions` for runtime permission checks (optional but recommended).

```bash
npm install react-native-permissions
```

### 3. Configure `package.json`
Add the setup scripts to your `package.json` under the `"scripts"` section:

```json
"scripts": {
  "setup:ios": "node scripts/setup-ios.js",
  "setup:android": "node scripts/setup-android.js"
}
```

### 4. Run Setup

#### 🍎 iOS Setup
1.  **Prebuild** (if using Expo):
    ```bash
    npx expo prebuild --platform ios
    ```
2.  **Run Script**:
    ```bash
    npm run setup:ios
    ```
    *This copies the Swift/Obj-C files, updates `Podfile`, and adds Bluetooth permissions to `Info.plist`.*
3.  **Install Pods**:
    ```bash
    cd ios && pod install && cd ..
    ```

#### 🤖 Android Setup
1.  **Prebuild** (if using Expo):
    ```bash
    npx expo prebuild --platform android
    ```
2.  **Run Script**:
    ```bash
    npm run setup:android
    ```
    *This generates the Java modules, patches `build.gradle`, and injects required permissions into `AndroidManifest.xml`.*

---

## 💻 Usage

Import `BlufiClient` in your code and use it to connect and provision devices.

```typescript
import { BlufiClient } from './BlufiClient';

// 1. Initialize
const blufi = BlufiClient.getInstance();

// 2. Request Permissions (Android 12+)
const hasPerms = await blufi.requestPermissions();
if (!hasPerms) {
  console.log("Permissions denied");
  return;
}

// 3. Scan for Devices
blufi.startScan((device) => {
  console.log('Found Device:', device.name, device.mac);
  
  // Stop scanning when found
  blufi.stopScan();
  connectToDevice(device.mac);
});

// 4. Connect & Provision
async function connectToDevice(mac: string) {
  try {
    await blufi.connect(mac);
    console.log("Connected!");

    await blufi.negotiateSecurity();
    console.log("Security Negotiated");

    await blufi.configureWifi('MyWifiSSID', 'MyWifiPassword');
    console.log("Wi-Fi Configured!");
    
  } catch (error) {
    console.error("Provisioning failed:", error);
  }
}
```

---

## 🛠 Troubleshooting

*   **iOS: "Developer Mode disabled"**: Go to Settings > Privacy & Security > Developer Mode on your iPhone and enable it.
*   **iOS: "Module not found"**: Ensure you ran `pod install` inside `ios/` after running the setup script.
*   **Android: "Unable to locate Java Runtime"**: Ensure you have JDK 17 installed (`java -version`).
*   **Android: Build Failures**: Ensure you ran `npx expo prebuild` *before* running `npm run setup:android`.

---

## 🤝 Contributing

We welcome contributions! If you find a bug or want to improve the scripts, please check `CONTRIBUTING.md`.
