import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';

const { BlufiBridge, BluetoothScannerModule } = NativeModules;
const blufiEmitter = BlufiBridge ? new NativeEventEmitter(BlufiBridge) : null;
const scannerEmitter = BluetoothScannerModule ? new NativeEventEmitter(BluetoothScannerModule) : null;

export interface BlufiDevice {
  name: string;
  mac: string;
  rssi: number;
}

export class BlufiClient {
  private static instance: BlufiClient;
  private listeners: any[] = [];

  private constructor() { }

  static getInstance(): BlufiClient {
    if (!BlufiClient.instance) {
      BlufiClient.instance = new BlufiClient();
    }
    return BlufiClient.instance;
  }

  // --- Permissions ---
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        return Object.values(granted).every((status) => status === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.error('Permission error:', err);
        return false;
      }
    }
    return true;
  }

  // --- Scanning ---
  startScan(onDeviceFound: (device: BlufiDevice) => void, onScanError?: (error: string) => void) {
    this.stopScan(); // Ensure clean start

    if (scannerEmitter) {
      const sub1 = scannerEmitter.addListener('DeviceFound', onDeviceFound);
      this.listeners.push(sub1);

      if (onScanError) {
        const sub2 = scannerEmitter.addListener('ScanError', (e) => onScanError(e.error));
        this.listeners.push(sub2);
      }
    }

    if (BluetoothScannerModule) {
      BluetoothScannerModule.startScan();
    } else {
      console.warn("BluetoothScannerModule is not available");
    }
  }

  stopScan() {
    if (BluetoothScannerModule) {
      BluetoothScannerModule.stopScan();
    }
    // Remove scan-specific listeners if needed, or rely on clearListeners
  }

  // --- Connection & Provisioning ---

  /**
   * Connect to a device.
   * Note: Resolves when the native connect call succeeds, but "Connected" state comes via event.
   */
  async connect(deviceId: string): Promise<void> {
    return BlufiBridge.connect(deviceId);
  }

  async disconnect(): Promise<void> {
    return BlufiBridge.disconnect();
  }

  async negotiateSecurity(): Promise<void> {
    return BlufiBridge.negotiateSecurity();
  }

  async configureWifi(ssid: string, password: string): Promise<void> {
    return BlufiBridge.configureWifi(ssid, password);
  }

  /**
   * Configure MQTT settings.
   * Sends IP (1:), Port (2:), and Finalize (8:0) commands.
   */
  async configureMqtt(ip: string, port: string): Promise<void> {
    await BlufiBridge.postCustomData(`1:${ip}`);
    await BlufiBridge.postCustomData(`2:${port}`);
    await BlufiBridge.postCustomData("8:0");
  }

  async postCustomData(data: string): Promise<void> {
    return BlufiBridge.postCustomData(data);
  }

  async getDeviceVersion(): Promise<void> {
    return BlufiBridge.requestDeviceVersion();
  }

  async getDeviceStatus(): Promise<void> {
    // Sending "12:" triggers the status response in some firmwares
    await BlufiBridge.postCustomData("12:");
    return BlufiBridge.requestDeviceStatus();
  }

  // --- Event Listeners ---

  onStatusChange(callback: (status: { connected: boolean; msg: string }) => void) {
    if (blufiEmitter) {
      const sub = blufiEmitter.addListener('BlufiStatus', (event) => {
        const isConnected = event.status === 'Connected' || event.state === 2;
        const msg = typeof event.status === 'string' ? event.status : `State: ${event.state}`;
        callback({ connected: isConnected, msg });
      });
      this.listeners.push(sub);
    }
  }

  onLog(callback: (log: string) => void) {
    if (blufiEmitter) {
      const sub1 = blufiEmitter.addListener('BlufiLog', (e) => callback(e.log));
      this.listeners.push(sub1);
    }
    if (scannerEmitter) {
      const sub2 = scannerEmitter.addListener('ScanLog', (e) => callback(e.log));
      this.listeners.push(sub2);
    }
  }

  onDataReceived(callback: (data: string) => void) {
    if (blufiEmitter) {
      const sub = blufiEmitter.addListener('BlufiData', (e) => callback(e.data));
      this.listeners.push(sub);
    }
  }

  cleanup() {
    this.listeners.forEach((l) => l.remove());
    this.listeners = [];
  }
}
