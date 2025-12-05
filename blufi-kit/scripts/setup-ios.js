const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const IOS_DIR = path.join(PROJECT_ROOT, 'ios');
const IOS_REFERENCE_DIR = path.join(PROJECT_ROOT, 'ios-reference');

function setupIOS() {
    console.log('🍎 Setting up iOS Blufi Module...');

    // 1. Check if iOS directory exists
    if (!fs.existsSync(IOS_DIR)) {
        console.error('❌ ios/ directory not found. Please run "npx expo prebuild --platform ios" first.');
        process.exit(1);
    }

    // 2. Copy Reference Files
    console.log('📂 Copying native module files...');
    if (!fs.existsSync(IOS_REFERENCE_DIR)) {
        console.error('❌ ios-reference/ directory not found.');
        process.exit(1);
    }

    const filesToCopy = [
        'BlufiBridge.podspec',
        'BlufiBridge.swift',
        'BlufiBridge.m',
        'BluetoothScannerModule.swift',
        'BluetoothScannerModule.m'
    ];

    filesToCopy.forEach(file => {
        const src = path.join(IOS_REFERENCE_DIR, file);
        const dest = path.join(IOS_DIR, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`   ✅ Copied ${file}`);
        } else {
            console.warn(`   ⚠️ Warning: ${file} not found in reference.`);
        }
    });

    // Copy BlufiLibrary folder
    const libSrc = path.join(IOS_REFERENCE_DIR, 'BlufiLibrary');
    const libDest = path.join(IOS_DIR, 'BlufiLibrary');
    if (fs.existsSync(libSrc)) {
        if (!fs.existsSync(libDest)) fs.mkdirSync(libDest, { recursive: true });
        fs.cpSync(libSrc, libDest, { recursive: true });
        console.log('   ✅ Copied BlufiLibrary/');
    } else {
        console.warn('   ⚠️ Warning: BlufiLibrary/ not found in reference.');
    }

    // 3. Update Podfile
    console.log('📝 Updating Podfile...');
    const podfilePath = path.join(IOS_DIR, 'Podfile');
    if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        if (!podfileContent.includes("pod 'BlufiBridge'")) {
            // Insert before the last 'end' of the target block, or just after use_native_modules!
            if (podfileContent.includes('use_native_modules!')) {
                podfileContent = podfileContent.replace(
                    'use_native_modules!',
                    "use_native_modules!\n  pod 'BlufiBridge', :path => '.'"
                );
                fs.writeFileSync(podfilePath, podfileContent);
                console.log('   ✅ Added BlufiBridge to Podfile');
            } else {
                console.warn('   ⚠️ Could not find "use_native_modules!" marker in Podfile. Please add "pod \'BlufiBridge\', :path => \'.\'" manually.');
            }
        } else {
            console.log('   ℹ️ BlufiBridge already in Podfile');
        }
    } else {
        console.error('❌ Podfile not found.');
    }

    // 4. Update Info.plist
    console.log('🔐 Configuring Permissions (Info.plist)...');
    // Find the project name to locate Info.plist
    const xcodeproj = fs.readdirSync(IOS_DIR).find(f => f.endsWith('.xcodeproj'));
    if (xcodeproj) {
        const projectName = xcodeproj.replace('.xcodeproj', '');
        const plistPath = path.join(IOS_DIR, projectName, 'Info.plist');

        if (fs.existsSync(plistPath)) {
            let plistContent = fs.readFileSync(plistPath, 'utf8');

            if (!plistContent.includes('NSBluetoothAlwaysUsageDescription')) {
                const permissionEntry = `
	<key>NSBluetoothAlwaysUsageDescription</key>
	<string>We need Bluetooth to connect to and provision the sensor device.</string>
	<key>NSBluetoothPeripheralUsageDescription</key>
	<string>We need Bluetooth to connect to and provision the sensor device.</string>`;

                // Insert before the closing </dict>
                const lastDictIndex = plistContent.lastIndexOf('</dict>');
                if (lastDictIndex !== -1) {
                    plistContent = plistContent.slice(0, lastDictIndex) + permissionEntry + plistContent.slice(lastDictIndex);
                    fs.writeFileSync(plistPath, plistContent);
                    console.log('   ✅ Added Bluetooth Permissions to Info.plist');
                }
            } else {
                console.log('   ℹ️ Permissions already present in Info.plist');
            }
        } else {
            console.warn(`   ⚠️ Info.plist not found at ${plistPath}`);
        }
    }

    console.log('\n✅ iOS Setup Complete!');
    console.log('👉 Next Step: Run "cd ios && pod install" to link the module.');
}

setupIOS();
