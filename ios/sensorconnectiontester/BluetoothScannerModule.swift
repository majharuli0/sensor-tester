import Foundation
import CoreBluetooth
import React

@objc(BluetoothScannerModule)
class BluetoothScannerModule: RCTEventEmitter, CBCentralManagerDelegate {
    
    var centralManager: CBCentralManager!
    var isScanning = false
    
    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: nil)
    }
    
    @objc func startScan() {
        if centralManager.state == .poweredOn {
            isScanning = true
            // Scan for all devices, allowing duplicates to get RSSI updates
            centralManager.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
            sendEvent(withName: "ScanLog", body: ["log": "iOS BLE Scan Started"])
        } else {
            sendEvent(withName: "ScanError", body: ["error": "Bluetooth is not powered on"])
        }
    }
    
    @objc func stopScan() {
        centralManager.stopScan()
        isScanning = false
        sendEvent(withName: "ScanLog", body: ["log": "iOS BLE Scan Stopped"])
    }
    
    // MARK: - CBCentralManagerDelegate
    
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        var stateStr = "Unknown"
        switch central.state {
        case .poweredOn: stateStr = "Powered On"
        case .poweredOff: stateStr = "Powered Off"
        case .resetting: stateStr = "Resetting"
        case .unauthorized: stateStr = "Unauthorized"
        case .unsupported: stateStr = "Unsupported"
        default: break
        }
        sendEvent(withName: "ScanLog", body: ["log": "Bluetooth State: \(stateStr)"])
    }
    
    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        // Filter for devices with names
        guard let name = peripheral.name else { return }
        
        // Construct device object matching Android payload
        let device: [String: Any] = [
            "name": name,
            "mac": peripheral.identifier.uuidString, // iOS uses UUID, not MAC
            "rssi": RSSI
        ]
        
        sendEvent(withName: "DeviceFound", body: device)
    }
    
    // MARK: - RCTEventEmitter
    
    override func supportedEvents() -> [String]! {
        return ["DeviceFound", "ScanLog", "ScanError"]
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}
