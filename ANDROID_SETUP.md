# Android App Setup Guide

Your web app is configured to build as a native Android app using Capacitor.

## Prerequisites

- Android Studio installed
- Java Development Kit (JDK) 17 or later
- Android SDK (installed via Android Studio)

## Development Workflow

### 1. Build the web app
```bash
yarn build
```

### 2. Sync web assets to Android
```bash
yarn cap:sync
# or for Android only:
yarn cap sync android
```

### 3. Open in Android Studio
```bash
yarn cap:open:android
# or:
npx cap open android
```

### Combined build and sync
```bash
yarn cap:build
```

## First-Time Android Setup in Android Studio

1. **Open the project** in Android Studio using `yarn cap:open:android`

2. **Wait for Gradle sync** to complete (first time may take a while)

3. **Configure app signing** (for release builds):
   - Generate a keystore for signing
   - Configure signing in `android/app/build.gradle`

4. **Set app icon**:
   - App icon location: `android/app/src/main/res/`
   - Use Android Studio's Image Asset tool:
     - Right-click `res` folder → New → Image Asset
     - Select "Launcher Icons"
     - Choose your 512x512px icon

5. **Update app name** (optional):
   - Edit `android/app/src/main/res/values/strings.xml`
   - Change `<string name="app_name">Unser Stundenplan</string>`

6. **Configure splash screen** (optional):
   - Located in `android/app/src/main/res/drawable/splash.png`
   - Use the Capacitor Splash Screen plugin for dynamic control

7. **Run on device/emulator**:
   - Connect Android device via USB (with USB debugging enabled)
   - OR create an AVD (Android Virtual Device) in Android Studio
   - Click "Run" button (▶️)

## Building for Google Play Store

### 1. Update version and build number
In `android/app/build.gradle`, update:
```gradle
versionCode 1          // Increment for each release
versionName "1.0.0"    // User-facing version
```

### 2. Generate signed APK/Bundle

**For Google Play Store (recommended):**
- Build → Generate Signed Bundle / APK
- Select "Android App Bundle"
- Create or select keystore
- Choose "release" build variant
- Build AAB file

**For direct distribution (APK):**
- Build → Generate Signed Bundle / APK
- Select "APK"
- Choose "release" build variant

### 3. Upload to Google Play Console
- Go to [Google Play Console](https://play.google.com/console)
- Create a new app
- Upload your AAB file
- Complete store listing (description, screenshots, etc.)
- Submit for review

## App Configuration

The app is configured in `capacitor.config.ts`:
- App ID: `net.roblillack.stundenplan`
- App Name: `Unser Stundenplan`
- Web directory: `dist`

Android-specific config in `android/app/build.gradle`:
- Package name: `net.roblillack.stundenplan`
- Min SDK: 22 (Android 5.1)
- Target SDK: Latest

## Installed Plugins

- `@capacitor/app` - App lifecycle and state management
- `@capacitor/splash-screen` - Splash screen control

## Troubleshooting

### Gradle sync failed
- File → Invalidate Caches / Restart
- Try updating Gradle version in `android/build.gradle`

### Web assets not updating
```bash
yarn build
yarn cap sync android
```

### Clean build
In Android Studio:
- Build → Clean Project
- Build → Rebuild Project

### Permission errors
Make sure your `AndroidManifest.xml` includes required permissions:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

### Testing on physical device
1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect device via USB
4. Allow USB debugging on device
5. Select device in Android Studio and run

## App Permissions

By default, Capacitor apps request:
- INTERNET (for loading web content)

Add additional permissions in `android/app/src/main/AndroidManifest.xml` as needed.

## Performance Optimization

For production builds, ensure ProGuard/R8 is enabled:
- Check `android/app/build.gradle`:
  ```gradle
  buildTypes {
      release {
          minifyEnabled true
          proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
      }
  }
  ```

## Resources

- [Capacitor Android Documentation](https://capacitorjs.com/docs/android)
- [Android Studio Download](https://developer.android.com/studio)
- [Google Play Console](https://play.google.com/console)
- [Android App Bundle](https://developer.android.com/guide/app-bundle)
