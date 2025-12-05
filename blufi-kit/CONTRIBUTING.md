# Contributing to Blufi Integration Kit

Thank you for your interest in improving this kit! We want to make this the standard, reliable way to use Espressif Blufi in React Native.

## 📂 Project Structure

*   **`ios-reference/`**: This is the "source of truth" for iOS.
    *   Contains the `BlufiBridge.swift` (React Native Bridge) and `BluetoothScannerModule.swift`.
    *   Contains the `BlufiLibrary/` (Objective-C library from Espressif).
    *   **Do not edit files in `ios/` directly** when developing. Edit them here, then run the setup script to propagate changes.
*   **`scripts/`**: Contains the automation logic.
    *   `setup-ios.js`: Copies files from `ios-reference` to `ios/` and patches `Podfile`/`Info.plist`.
    *   `setup-android.js`: Generates Java files dynamically (embedded as strings) and patches `build.gradle`/`AndroidManifest.xml`.

## 🧪 How to Test Changes

Since this is a "kit" that generates code, you need to test it by generating a fresh app.

1.  **Create a Test App**:
    ```bash
    npx create-expo-app@latest ../blufi-test-app --yes
    ```
2.  **Copy Your Changes**:
    Copy your modified `scripts` or `ios-reference` into the test app.
3.  **Run Setup**:
    ```bash
    cd ../blufi-test-app
    npm run setup:ios
    npm run setup:android
    ```
4.  **Verify**:
    *   Check if files were created in `ios/` and `android/`.
    *   Check if `Podfile`, `Info.plist`, `build.gradle`, and `AndroidManifest.xml` were patched correctly.
    *   Run the app: `npx expo run:ios` or `npx expo run:android`.

## 📝 Coding Standards

*   **Scripts**: Keep `setup-ios.js` and `setup-android.js` dependency-free (standard Node.js `fs` and `path` only) so users don't need to install extra packages.
*   **Swift**: Ensure all bridge methods are marked `@objc` and classes are `public`.
*   **Java**: Ensure compatibility with standard React Native `ReactContextBaseJavaModule`.

## 🛠 How to Extend (Add New Methods)

Yes! You can easily add more Blufi features. Here is the workflow:

1.  **iOS**:
    *   Edit `ios-reference/BlufiBridge.swift` to add the new Swift method.
    *   Expose it in `ios-reference/BlufiBridge.m` using `RCT_EXTERN_METHOD`.

2.  **Android**:
    *   Edit `scripts/setup-android.js`.
    *   Find the `BLUFI_MODULE_JAVA` string constant.
    *   Add your new `@ReactMethod` inside that Java string.

3.  **TypeScript**:
    *   Edit `BlufiClient.ts` to add the new method to the class and call the native bridge.

4.  **Test**:
    *   Run the setup scripts in your test app to propagate the changes.

## 🚀 Future Improvements Needed

*   [ ] Add support for `react-native-config` if needed.
*   [ ] Improve error handling in the TypeScript client.
*   [ ] Add unit tests for the setup scripts.
