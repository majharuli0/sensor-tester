const fs = require('fs');
const path = require('path');

// --- EMBEDDED SOURCE CODE TEMPLATES ---
// Note: We use placeholders like {{PACKAGE_NAME}} to be replaced dynamically.

const BLUFI_MODULE_JAVA = `package {{PACKAGE_NAME}};

import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.List;

import blufi.espressif.BlufiCallback;
import blufi.espressif.BlufiClient;
import blufi.espressif.params.BlufiConfigureParams;
import blufi.espressif.params.BlufiParameter;
import blufi.espressif.response.BlufiScanResult;
import blufi.espressif.response.BlufiStatusResponse;
import blufi.espressif.response.BlufiVersionResponse;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothProfile;
import android.util.Log;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BlufiModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private BlufiClient blufiClient;
    private String currentDeviceId;
    private static final String TAG = "BlufiModule";

    public BlufiModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "BlufiBridge";
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }

    private void sendStatus(String status) {
        WritableMap params = Arguments.createMap();
        params.putString("status", status);
        sendEvent("BlufiStatus", params);
    }

    private void sendLog(String message) {
        Log.d(TAG, message);
        WritableMap params = Arguments.createMap();
        params.putString("log", message);
        sendEvent("BlufiLog", params);
    }

    @ReactMethod
    public void connect(String deviceId, Promise promise) {
        if (blufiClient != null) {
            blufiClient.close();
            blufiClient = null;
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
             promise.reject("ERR_NO_BT", "Bluetooth not supported");
             return;
        }
        
        BluetoothDevice device = adapter.getRemoteDevice(deviceId);

        if (device == null) {
            promise.reject("ERR_DEVICE_NOT_FOUND", "Device not found");
            return;
        }

        currentDeviceId = deviceId;
        blufiClient = new BlufiClient(reactContext, device);
        blufiClient.setBlufiCallback(new BlufiCallbackMain());
        blufiClient.setGattCallback(new GattCallbackMain()); // Set standard GATT callback
        blufiClient.connect();
        
        promise.resolve(true);
    }

    @ReactMethod
    public void disconnect() {
        if (blufiClient != null) {
            blufiClient.close();
            blufiClient = null;
        }
    }

    @ReactMethod
    public void negotiateSecurity(Promise promise) {
        if (blufiClient == null) {
            promise.reject("ERR_NO_CLIENT", "Blufi client not initialized");
            return;
        }
        blufiClient.negotiateSecurity();
        promise.resolve(true);
    }

    @ReactMethod
    public void configureWifi(String ssid, String password, Promise promise) {
        if (blufiClient == null) {
            promise.reject("ERR_NO_CLIENT", "Blufi client not initialized");
            return;
        }

        BlufiConfigureParams params = new BlufiConfigureParams();
        params.setOpMode(BlufiParameter.OP_MODE_STA);
        params.setStaSSIDBytes(ssid != null ? ssid.getBytes() : new byte[0]);
        params.setStaPassword(password);
        
        blufiClient.configure(params);
        promise.resolve(true);
    }
    
    @ReactMethod
    public void postCustomData(String data, Promise promise) {
        if (blufiClient == null) {
            promise.reject("ERR_NO_CLIENT", "Blufi client not initialized");
            return;
        }
        blufiClient.postCustomData(data.getBytes());
        promise.resolve(true);
    }

    @ReactMethod
    public void requestDeviceStatus() {
        if (blufiClient != null) {
            blufiClient.requestDeviceStatus();
        }
    }

    @ReactMethod
    public void requestDeviceVersion() {
        if (blufiClient != null) {
            blufiClient.requestDeviceVersion();
        }
    }

    // Standard BluetoothGattCallback for connection events
    private class GattCallbackMain extends BluetoothGattCallback {
        @Override
        public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            String stateStr = (newState == BluetoothProfile.STATE_CONNECTED) ? "Connected" : 
                              (newState == BluetoothProfile.STATE_DISCONNECTED) ? "Disconnected" : "Unknown";
            
            sendLog("Gatt Connection State: " + stateStr + " (" + newState + "), Status: " + status);

            if (newState == BluetoothProfile.STATE_CONNECTED) {
                new Handler(Looper.getMainLooper()).post(() -> 
                    Toast.makeText(reactContext, "Blufi Connected!", Toast.LENGTH_SHORT).show()
                );
                sendStatus("Connected");
                
                WritableMap params = Arguments.createMap();
                params.putInt("state", 2); // Connected
                params.putInt("status", 0);
                sendEvent("BlufiStatus", params);
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                sendStatus("Disconnected");
                
                WritableMap params = Arguments.createMap();
                params.putInt("state", 0); // Disconnected
                params.putInt("status", 0);
                sendEvent("BlufiStatus", params);
            }
        }
    }

    private class BlufiCallbackMain extends BlufiCallback {
        
        // Removed @Override to avoid compilation error if signature mismatches
        public void onGattPrepared(BlufiClient client, BluetoothGatt gatt, BluetoothGattService service, BluetoothGattCharacteristic writeChar, BluetoothGattCharacteristic notifyChar) {
            sendLog("Gatt Prepared (Service Discovered)");
            // We handle "Connected" in GattCallbackMain, but this confirms services are ready
        }

        @Override
        public void onNegotiateSecurityResult(BlufiClient client, int status) {
            sendStatus("Security Result: " + status);
            sendLog("Security Negotiation Result: " + status);
        }

        @Override
        public void onPostConfigureParams(BlufiClient client, int status) {
            sendStatus("Configure Params: " + status);
            sendLog("Post Configure Params Result: " + status);
        }

        @Override
        public void onDeviceStatusResponse(BlufiClient client, int status, BlufiStatusResponse response) {
            sendStatus("Device Status: " + status);
            if (response != null) {
                sendLog("Status Response: " + response.toString());
            }
        }

        @Override
        public void onDeviceVersionResponse(BlufiClient client, int status, BlufiVersionResponse response) {
            sendStatus("Device Version: " + status);
            if (response != null) {
                sendLog("Version Response: " + response.getVersionString());
            }
        }

        @Override
        public void onReceiveCustomData(BlufiClient client, int status, byte[] data) {
            if (data != null) {
                String dataStr = new String(data);
                sendLog("Received Custom Data: " + dataStr);
                WritableMap params = Arguments.createMap();
                params.putString("data", dataStr);
                sendEvent("BlufiData", params);
            }
        }
        
        @Override
        public void onPostCustomDataResult(BlufiClient client, int status, byte[] data) {
             sendLog("Post Custom Data Result: " + status);
        }

        @Override
        public void onError(BlufiClient client, int errCode) {
            sendStatus("Error: " + errCode);
            sendLog("Blufi Error Code: " + errCode);
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Keep: Required for React Native built-in Event Emitter Calls.
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Keep: Required for React Native built-in Event Emitter Calls.
    }
}
`;

const BLUETOOTH_SCANNER_MODULE_JAVA = `package {{PACKAGE_NAME}};

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashSet;
import java.util.Set;

public class BluetoothScannerModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bluetoothLeScanner;
    private Set<String> foundDevices = new HashSet<>();
    private boolean isScanning = false;
    private static final String TAG = "BluetoothScanner";

    public BluetoothScannerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    @Override
    public String getName() {
        return "BluetoothScannerModule";
    }

    private void sendLog(String message) {
        Log.d(TAG, message);
        WritableMap params = Arguments.createMap();
        params.putString("log", message);
        sendEvent("ScanLog", params);
    }

    @ReactMethod
    public void startScan() {
        if (bluetoothAdapter == null) {
            sendLog("BluetoothAdapter is null");
            sendError("BluetoothAdapter is null");
            return;
        }
        
        bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
        if (bluetoothLeScanner == null) {
             sendLog("BluetoothLeScanner is null");
             sendError("BluetoothLeScanner is null (Bluetooth might be off)");
             return;
        }

        if (isScanning) {
            sendLog("Already scanning");
            return;
        }

        foundDevices.clear();
        isScanning = true;
        
        // Use default settings to match reference app
        try {
            bluetoothLeScanner.startScan(scanCallback);
            sendLog("BLE Scan started (Default Settings)");
        } catch (SecurityException e) {
            sendLog("SecurityException during scan: " + e.getMessage());
            sendError("SecurityException: " + e.getMessage());
            isScanning = false;
        }
    }

    @ReactMethod
    public void stopScan() {
        if (bluetoothLeScanner != null && isScanning) {
            try {
                bluetoothLeScanner.stopScan(scanCallback);
                sendLog("BLE Scan stopped");
            } catch (SecurityException e) {
                sendLog("SecurityException during stop scan: " + e.getMessage());
            }
            isScanning = false;
        }
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            if (device != null) {
                String address = device.getAddress();
                if (!foundDevices.contains(address)) {
                    foundDevices.add(address);
                    
                    WritableMap params = Arguments.createMap();
                    try {
                        String name = device.getName();
                        params.putString("name", name != null ? name : "Unknown");
                        sendLog("Found: " + (name != null ? name : "Unknown") + " (" + address + ")");
                    } catch (SecurityException e) {
                        params.putString("name", "Unknown (Perm)");
                        sendLog("Found: " + address + " (Perm Error)");
                    }
                    params.putString("id", address);
                    params.putString("mac", address);
                    params.putInt("rssi", result.getRssi());
                    
                    sendEvent("DeviceFound", params);
                }
            }
        }

        @Override
        public void onScanFailed(int errorCode) {
            sendLog("Scan failed: " + errorCode);
            sendError("Scan failed with error code: " + errorCode);
        }
    };

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        } else {
            Log.e(TAG, "No active CatalystInstance, cannot send event: " + eventName);
        }
    }

    private void sendError(String errorMessage) {
        WritableMap params = Arguments.createMap();
        params.putString("error", errorMessage);
        sendEvent("ScanError", params);
    }
    
    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}
}
`;

const BLUFI_PACKAGE_JAVA = `package {{PACKAGE_NAME}};

import androidx.annotation.NonNull;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class BlufiPackage implements ReactPackage {
    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        // Register BOTH modules here:
        modules.add(new BlufiModule(reactContext)); 
        modules.add(new BluetoothScannerModule(reactContext));
        return modules;
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;

// --- INSTALLATION LOGIC ---

const PROJECT_ROOT = process.cwd();
const ANDROID_MANIFEST_PATH = path.join(PROJECT_ROOT, 'android/app/src/main/AndroidManifest.xml');
const BUILD_GRADLE = path.join(PROJECT_ROOT, 'android/app/build.gradle');

function getAndroidPackageName() {
    if (!fs.existsSync(ANDROID_MANIFEST_PATH)) {
        console.error('❌ AndroidManifest.xml not found. Is this a React Native project?');
        return null;
    }
    const content = fs.readFileSync(ANDROID_MANIFEST_PATH, 'utf8');
    const match = content.match(/package="([^"]+)"/);
    if (match && match[1]) {
        return match[1];
    }
    console.error('❌ Could not parse package name from AndroidManifest.xml');
    return null;
}

function writeFile(dest, content) {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dest, content);
    console.log(`✅ Created ${path.basename(dest)}`);
}

function installAndroid() {
    console.log('\n--- Installing Android Native Modules ---');
    const packageName = getAndroidPackageName();
    if (!packageName) return;

    console.log(`ℹ️  Detected Android Package: ${packageName}`);

    // Convert package (com.example.app) to path (com/example/app)
    const packagePath = packageName.replace(/\./g, '/');
    const targetDir = path.join(PROJECT_ROOT, 'android/app/src/main/java', packagePath);

    // Replace placeholder in templates
    const blufiModule = BLUFI_MODULE_JAVA.replace('{{PACKAGE_NAME}}', packageName);
    const scannerModule = BLUETOOTH_SCANNER_MODULE_JAVA.replace('{{PACKAGE_NAME}}', packageName);
    const blufiPackage = BLUFI_PACKAGE_JAVA.replace('{{PACKAGE_NAME}}', packageName);

    writeFile(path.join(targetDir, 'BlufiModule.java'), blufiModule);
    writeFile(path.join(targetDir, 'BluetoothScannerModule.java'), scannerModule);
    writeFile(path.join(targetDir, 'BlufiPackage.java'), blufiPackage);

    // Patch build.gradle
    if (fs.existsSync(BUILD_GRADLE)) {
        let content = fs.readFileSync(BUILD_GRADLE, 'utf8');
        if (!content.includes('lib-blufi-android')) {
            console.log('🔧 Patching build.gradle...');
            const dependency = `    implementation 'com.github.EspressifApp:lib-blufi-android:2.4.1'`;
            content = content.replace('dependencies {', `dependencies {\n${dependency}`);
            fs.writeFileSync(BUILD_GRADLE, content);
            console.log('✅ Added Blufi dependency to build.gradle');
        } else {
            console.log('✅ build.gradle already patched');
        }
    }
}

function main() {
    console.log('🚀 Starting Blufi Android Installer ...');
    installAndroid();
    console.log('\n✅ Android Setup Complete! Rebuild your app with "npx expo run:android".');
}

main();
