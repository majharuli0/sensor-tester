# iOS Setup Guide for Sensor Connection Tester (Blufi)

This guide explains how to set up the **Blufi** native module for iOS. Unlike the Android implementation which uses a Gradle library, the iOS implementation uses a **Local CocoaPod** to bridge the Swift/Objective-C code to React Native.

## 1. Prerequisites
*   **Mac with Xcode** (Required for iOS builds).
*   **CocoaPods** installed (`sudo gem install cocoapods`).
*   **Node.js & NPM** installed.

## 2. Project Structure (Local Pod)

We use a local Pod named `BlufiBridge` to encapsulate the native code. This avoids complex manual linking in Xcode.

### File Locations
Ensure your `ios/` directory has the following structure:

```text
ios/
├── Podfile
├── BlufiBridge.podspec          <-- Pod definition
├── BlufiBridge.swift            <-- Swift Bridge
├── BlufiBridge.m                <-- Obj-C Interface
├── BluetoothScannerModule.swift <-- Scanner Logic
├── BluetoothScannerModule.m     <-- Scanner Interface
└── BlufiLibrary/                <-- Espressif Blufi Library (Obj-C)
    ├── BlufiClient.h
    ├── BlufiClient.m
    └── ... (other library files)
```

### 3. Podspec Configuration (`ios/BlufiBridge.podspec`)
This file tells CocoaPods how to build your module.

```ruby
require "json"

package = JSON.parse(File.read(File.join(__dir__, "../package.json")))

Pod::Spec.new do |s|
  s.name         = "BlufiBridge"
  s.version      = package["version"]
  s.summary      = "Blufi Bridge for Sensor Connection Tester"
  s.homepage     = "https://github.com/example/sensor-connection-tester"
  s.license      = "MIT"
  s.authors      = { "Your Name" => "yourname@example.com" }
  s.platform     = :ios, "13.0"
  s.source       = { :git => "", :tag => "#{s.version}" }

  # CRITICAL: Include all source files (Swift, Obj-C, and Library)
  s.source_files = "BlufiBridge.{h,m,swift}", "BluetoothScannerModule.{h,m,swift}", "BlufiLibrary/**/*.{h,m}"
  s.requires_arc = true

  s.dependency "React-Core"
  s.dependency "OpenSSL-Universal" # Required for Blufi security
end
```

### 4. Podfile Configuration (`ios/Podfile`)
Link the local pod in your `Podfile`:

```ruby
target 'sensorconnectiontester' do
  use_expo_modules!
  config = use_native_modules!

  # ... other pods

  # Link local BlufiBridge pod
  pod 'BlufiBridge', :path => '.' 
end
```

## 5. Swift Implementation Details

### Visibility Modifiers
Swift classes and methods are `internal` by default. To be visible to the Objective-C runtime (and React Native), you **MUST** use `public` and `@objc`.

**Example (`BluetoothScannerModule.swift`):**
```swift
@objc(BluetoothScannerModule)
public class BluetoothScannerModule: RCTEventEmitter, CBCentralManagerDelegate {
    
    // CRITICAL: init must be public!
    public override init() {
        super.init()
        // ...
    }

    @objc public func startScan() { ... }
    
    // ...
}
```

## 6. React Native Integration (Crash Prevention)

Native modules might be `null` if linking fails. Always check before using `NativeEventEmitter`.

**Safe Implementation (`App.tsx` / `BlufiClient.ts`):**
```typescript
import { NativeModules, NativeEventEmitter } from 'react-native';

const { BlufiBridge, BluetoothScannerModule } = NativeModules;

// CRITICAL: Check for null to prevent "Invariant Violation" crash
const blufiEmitter = BlufiBridge ? new NativeEventEmitter(BlufiBridge) : null;
const scannerEmitter = BluetoothScannerModule ? new NativeEventEmitter(BluetoothScannerModule) : null;

// Usage
if (scannerEmitter) {
    scannerEmitter.addListener('DeviceFound', ...);
}
```

## 7. Troubleshooting

### A. "Developer Mode disabled" (Physical Device)
**Issue:** Build fails with `xcodebuild: error: Developer Mode disabled`.
**Fix:**
1.  On iPhone: **Settings > Privacy & Security > Developer Mode**.
2.  Toggle **ON**.
3.  Restart iPhone and follow prompts.

### B. "No script URL provided"
**Issue:** App installs but shows this error on launch.
**Fix:**
1.  Ensure Mac and iPhone are on the **SAME Wi-Fi**.
2.  Start Metro Bundler: `npx expo start`.
3.  Shake iPhone -> **Reload**.

### C. "BluetoothScannerModule not found" (Runtime)
**Issue:** App runs but scanning doesn't work; logs show module is undefined.
**Fix:**
1.  Ensure source files are in `ios/` root (not a subdirectory).
2.  Ensure `BlufiBridge.podspec` includes the files.
3.  Run:
    ```bash
    cd ios
    pod install
    cd ..
    npx expo run:ios --device
    ```

### D. "Invariant Violation: new NativeEventEmitter() requires a non-null argument"
**Issue:** App crashes immediately on launch.
**Fix:**
See **Section 6**. You are trying to create a `NativeEventEmitter` with a null module. Add null checks.
