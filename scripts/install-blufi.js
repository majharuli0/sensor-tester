const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_DIR = path.join(__dirname, '../blufi-lib'); // Assuming source files are here
const ANDROID_MAIN = path.join(process.cwd(), 'android/app/src/main/java/com/maj001/sensorconnectiontester');
const IOS_DIR = path.join(process.cwd(), 'ios/sensorconnectiontester');
const BUILD_GRADLE = path.join(process.cwd(), 'android/app/build.gradle');

// Files to copy
const ANDROID_FILES = [
    'BlufiModule.java',
    'BluetoothScannerModule.java',
    'BlufiPackage.java'
];

const IOS_FILES = [
    'BlufiBridge.swift',
    'BluetoothScannerModule.swift',
    'BlufiBridge.m',
    'BluetoothScannerModule.m'
];

function copyFile(src, dest) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copied ${path.basename(src)} to ${dest}`);
    } else {
        console.warn(`⚠️ Source file not found: ${src}`);
    }
}

function installAndroid() {
    console.log('\n--- Installing Android Native Modules ---');
    if (!fs.existsSync(ANDROID_MAIN)) {
        console.error('❌ Android project structure not found. Run "npx expo prebuild" first.');
        return;
    }

    // 1. Copy Java Files
    ANDROID_FILES.forEach(file => {
        copyFile(path.join(SOURCE_DIR, 'android', file), path.join(ANDROID_MAIN, file));
    });

    // 2. Patch build.gradle
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

function installIOS() {
    console.log('\n--- Installing iOS Native Modules ---');
    if (!fs.existsSync(IOS_DIR)) {
        console.log('⚠️ iOS project not found (Skipping). Run "npx expo prebuild --platform ios" on Mac.');
        return;
    }

    // 1. Copy Swift/Obj-C Files
    IOS_FILES.forEach(file => {
        copyFile(path.join(SOURCE_DIR, 'ios', file), path.join(IOS_DIR, file));
    });

    console.log('ℹ️  Remember to add "pod \'BluFi\'" to your Podfile and run "pod install".');
}

function main() {
    console.log('🚀 Starting Blufi Portable Installer...');
    installAndroid();
    installIOS();
    console.log('\n✅ Installation Complete! Rebuild your app with "npx expo run:android" or "npx expo run:ios".');
}

main();
