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
  s.source       = { :git => "https://github.com/example/sensor-connection-tester.git", :tag => "#{s.version}" }

  s.source_files = "BlufiBridge.{h,m,swift}", "BluetoothScannerModule.{h,m,swift}", "BlufiLibrary/**/*.{h,m}"
  s.requires_arc = true

  s.dependency "React-Core"
  s.dependency "OpenSSL-Universal"
end
