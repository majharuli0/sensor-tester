package com.maj001.sensorconnectiontester;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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
    private Set<String> foundDevices = new HashSet<>();

    public BluetoothScannerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    @Override
    public String getName() {
        return "BluetoothScanner";
    }

    @ReactMethod
    public void startScan() {
        if (bluetoothAdapter == null) return;
        
        foundDevices.clear();
        
        // Register receiver for finding devices
        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
        try {
            reactContext.registerReceiver(receiver, filter);
        } catch (Exception e) {
            // Already registered or permission issue
        }

        if (bluetoothAdapter.isDiscovering()) {
            bluetoothAdapter.cancelDiscovery();
        }
        bluetoothAdapter.startDiscovery();
    }

    @ReactMethod
    public void stopScan() {
        if (bluetoothAdapter != null && bluetoothAdapter.isDiscovering()) {
            bluetoothAdapter.cancelDiscovery();
        }
        try {
            reactContext.unregisterReceiver(receiver);
        } catch (Exception e) {
            // Ignore if not registered
        }
    }

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device != null) {
                    String address = device.getAddress();
                    if (!foundDevices.contains(address)) {
                        foundDevices.add(address);
                        
                        WritableMap params = Arguments.createMap();
                        params.putString("name", device.getName() != null ? device.getName() : "Unknown");
                        params.putString("id", address); // MAC Address
                        
                        sendEvent("DeviceFound", params);
                    }
                }
            }
        }
    };

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
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