import Foundation
import CoreBluetooth
import React
import BluFi

@objc(BlufiBridge)
class BlufiBridge: RCTEventEmitter, BlufiDelegate {
    
    var blufiClient: BlufiClient!
    var connectedPeripheral: CBPeripheral?
    
    override init() {
        super.init()
        blufiClient = BlufiClient()
        blufiClient.delegate = self
    }
    
    @objc func connect(_ deviceId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        // deviceId on iOS is the UUID string
        guard let uuid = UUID(uuidString: deviceId) else {
            reject("ERR_INVALID_UUID", "Invalid UUID string", nil)
            return
        }
        
        // Note: In a real app, you might need to retrieve the CBPeripheral from the CentralManager 
        // in BluetoothScannerModule or scan for it again if not cached.
        // For this reference, we assume we can retrieve it or start a connection flow.
        // This part often requires sharing the CentralManager instance or passing the peripheral object.
        
        // Simplified for reference:
        sendEvent(withName: "BlufiLog", body: ["log": "Attempting to connect to \(deviceId)..."])
        // blufiClient.connect(peripheral) // Actual call requires CBPeripheral object
        
        // Mocking success for structure
        resolve(true)
    }
    
    @objc func disconnect() {
        blufiClient.close()
        sendEvent(withName: "BlufiStatus", body: ["status": "Disconnected", "state": 0])
    }
    
    @objc func negotiateSecurity(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        blufiClient.negotiateSecurity()
        resolve(true)
    }
    
    @objc func configureWifi(_ ssid: String, password: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        let params = BlufiConfigureParams()
        params.opMode = .STA
        params.staSsid = ssid
        params.staPassword = password
        
        blufiClient.configure(params)
        resolve(true)
    }
    
    @objc func postCustomData(_ data: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if let dataBytes = data.data(using: .utf8) {
            blufiClient.postCustomData(dataBytes)
            resolve(true)
        } else {
            reject("ERR_DATA", "Failed to convert string to bytes", nil)
        }
    }
    
    // MARK: - BlufiDelegate
    
    func blufi(_ client: BlufiClient, didUpdate state: BlufiStatus, status: BlufiStatus) {
        // Handle connection state changes
        if status == .connected {
             sendEvent(withName: "BlufiStatus", body: ["status": "Connected", "state": 2])
        } else {
             sendEvent(withName: "BlufiStatus", body: ["status": "Disconnected", "state": 0])
        }
    }
    
    func blufi(_ client: BlufiClient, didNegotiateSecurity result: BlufiStatus) {
        sendEvent(withName: "BlufiStatus", body: ["status": "Security Result: \(result.rawValue)"])
    }
    
    func blufi(_ client: BlufiClient, didPostConfigureParams result: BlufiStatus) {
        sendEvent(withName: "BlufiStatus", body: ["status": "Configure Params: \(result.rawValue)"])
    }
    
    func blufi(_ client: BlufiClient, didReceiveCustomData data: Data, status: BlufiStatus) {
        if let dataStr = String(data: data, encoding: .utf8) {
            sendEvent(withName: "BlufiData", body: ["data": dataStr])
        }
    }
    
    // MARK: - RCTEventEmitter
    
    override func supportedEvents() -> [String]! {
        return ["BlufiStatus", "BlufiLog", "BlufiData"]
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}
