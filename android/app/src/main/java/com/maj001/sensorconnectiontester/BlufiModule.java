package com.maj001.sensorconnectiontester;

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
