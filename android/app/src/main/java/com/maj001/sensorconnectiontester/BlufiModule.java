package com.maj001.sensorconnectiontester;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.AsyncTask;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;

public class BlufiModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket bluetoothSocket;
    private OutputStream outputStream;
    private InputStream inputStream;
    private boolean isConnected = false;

    // Standard SPP UUID
    private static final UUID MY_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    public BlufiModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    @Override
    public String getName() {
        return "BlufiBridge"; // This matches NativeModules.BlufiBridge in App.jsx
    }

    private void sendEvent(String eventName, String message) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, message);
        }
    }

    @ReactMethod
    public void connect(String address, Promise promise) {
        if (bluetoothAdapter == null || address == null) {
            promise.reject("BLUETOOTH_ERR", "Bluetooth not supported or address null");
            return;
        }

        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
        
        new Thread(() -> {
            try {
                // Close existing connection if any
                if (bluetoothSocket != null && isConnected) {
                    bluetoothSocket.close();
                }

                bluetoothSocket = device.createRfcommSocketToServiceRecord(MY_UUID);
                bluetoothAdapter.cancelDiscovery(); // Always cancel discovery before connecting
                bluetoothSocket.connect();

                outputStream = bluetoothSocket.getOutputStream();
                inputStream = bluetoothSocket.getInputStream();
                isConnected = true;

                sendEvent("BlufiStatus", "Connected to " + address);
                promise.resolve(true);

                // Start Listening for Data
                listenForData();

            } catch (IOException e) {
                isConnected = false;
                promise.reject("CONNECT_ERR", e.getMessage());
                sendEvent("BlufiStatus", "Connection Failed: " + e.getMessage());
            }
        }).start();
    }

    private void listenForData() {
        new Thread(() -> {
            byte[] buffer = new byte[1024];
            int bytes;

            while (isConnected) {
                try {
                    bytes = inputStream.read(buffer);
                    if (bytes > 0) {
                        String received = new String(buffer, 0, bytes);
                        sendEvent("BlufiData", received);
                    }
                } catch (IOException e) {
                    isConnected = false;
                    sendEvent("BlufiStatus", "Disconnected");
                    break;
                }
            }
        }).start();
    }

    @ReactMethod
    public void postCustomData(String data, Promise promise) {
        if (!isConnected || outputStream == null) {
            promise.reject("WRITE_ERR", "Not connected");
            return;
        }
        try {
            outputStream.write(data.getBytes());
            promise.resolve(true);
        } catch (IOException e) {
            promise.reject("WRITE_ERR", e.getMessage());
        }
    }

    @ReactMethod
    public void negotiateSecurity(Promise promise) {
        // Since we are using standard SPP, we just mock this success
        // or send a specific handshake string if your device needs it
        if (isConnected) {
            sendEvent("BlufiStatus", "Security Negotiated (Mock)");
            promise.resolve(true);
        } else {
            promise.reject("ERR", "Not connected");
        }
    }

    @ReactMethod
    public void configureWifi(String ssid, String password, Promise promise) {
        if (!isConnected || outputStream == null) {
            promise.reject("ERR", "Not connected");
            return;
        }
        try {
            // Sending as a simple string format "WIFI:SSID,PASSWORD"
            // Adjust this format to match what your Arduino/ESP32 expects!
            String configData = "WIFI:" + ssid + "," + password;
            outputStream.write(configData.getBytes());
            sendEvent("BlufiStatus", "Wi-Fi Config Sent");
            promise.resolve(true);
        } catch (IOException e) {
            promise.reject("WRITE_ERR", e.getMessage());
        }
    }
}