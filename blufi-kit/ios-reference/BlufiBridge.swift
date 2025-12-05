import Foundation
import CoreBluetooth
import React

@objc(BlufiBridge)
public class BlufiBridge: RCTEventEmitter, BlufiDelegate {
    
    var blufiClient: BlufiClient!
    var connectedPeripheral: CBPeripheral?
    
    override init() {
        super.init()
        blufiClient = BlufiClient()
        blufiClient.blufiDelegate = self
    }
    
    @objc func connect(_ deviceId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        // deviceId on iOS is the UUID string
        // In a real scenario, you need to pass the CBPeripheral object to the client.
        // The current BlufiClient.h has - (void)connect:(NSString *)identifier; which takes a string identifier.
        // Assuming the ObjC library handles retrieval or we need to adapt.
        
        blufiClient.connect(deviceId)
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
        params.opMode = OpModeSta
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
    
    // Note: There isn't a generic "didUpdate state" delegate method in the header.
    // We can infer connection state from gattPrepared or other callbacks, or we might need to listen to central manager events if exposed.
    // For now, we'll use gattPrepared as a proxy for "Connected/Ready".
    
    public func blufi(_ client: BlufiClient, gattPrepared status: BlufiStatusCode, service: CBService?, writeChar: CBCharacteristic?, notifyChar: CBCharacteristic?) {
        if status == StatusSuccess {
            sendEvent(withName: "BlufiStatus", body: ["status": "Connected", "state": 2])
        } else {
            sendEvent(withName: "BlufiStatus", body: ["status": "Connection Failed", "state": 0])
        }
    }
    
    public func blufi(_ client: BlufiClient, didNegotiateSecurity status: BlufiStatusCode) {
        sendEvent(withName: "BlufiStatus", body: ["status": "Security Result: \(status.rawValue)"])
    }
    
    public func blufi(_ client: BlufiClient, didPostConfigureParams status: BlufiStatusCode) {
        sendEvent(withName: "BlufiStatus", body: ["status": "Configure Params: \(status.rawValue)"])
    }
    
    public func blufi(_ client: BlufiClient, didReceiveCustomData data: Data, status: BlufiStatusCode) {
        if let dataStr = String(data: data, encoding: .utf8) {
            sendEvent(withName: "BlufiData", body: ["data": dataStr])
        }
    }
    
    // MARK: - RCTEventEmitter
    
    public override func supportedEvents() -> [String]! {
        return ["BlufiStatus", "BlufiLog", "BlufiData"]
    }
    
    public override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}
