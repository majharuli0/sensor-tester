# iOS Setup Guide for Sensor Connection Tester

Since you are developing on Windows, you cannot generate the iOS project directly. This guide explains how to integrate the provided reference files into an iOS project (e.g., on a Mac or CI/CD).

## 1. Prerequisites
*   **Mac with Xcode** (Required for iOS builds).
*   **CocoaPods** installed (`sudo gem install cocoapods`).

## 2. Project Generation (On Mac)
Run the following in your project root:
```bash
npx expo prebuild --platform ios
```
This will create the `ios` directory.

## 3. Add Dependencies (`ios/Podfile`)
Open `ios/Podfile` and add the Espressif BluFi pod:
```ruby
target 'sensorconnectiontester' do
  # ... other pods
  pod 'BluFi' 
end
```
Then run `pod install` inside the `ios` folder.

## 4. Add Native Modules
Copy the files from `ios-reference/` into your Xcode project (e.g., inside the main group `sensorconnectiontester`).

*   `BluetoothScannerModule.swift`
*   `BluetoothScannerModule.m`
*   `BlufiBridge.swift`
*   `BlufiBridge.m`

**Important**: When you add the first Swift file, Xcode will ask to create a **Bridging Header**. Click **"Create Bridging Header"**.

## 5. Configure Bridging Header
Open the created `sensorconnectiontester-Bridging-Header.h` and add:
```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import "AppDelegate.h"
```

## 6. Permissions (`Info.plist`)
Add these keys to `ios/sensorconnectiontester/Info.plist` to allow Bluetooth usage:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>We need Bluetooth to connect to and provision the sensor device.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>We need Bluetooth to connect to and provision the sensor device.</string>
```

## 7. Build and Run
Open `ios/sensorconnectiontester.xcworkspace` in Xcode and run the app on a physical device (Bluetooth does not work on Simulator).

## 8. React Native Code
The `App.tsx` code we wrote is already compatible! It uses `NativeModules` which will automatically map to these new iOS classes.
