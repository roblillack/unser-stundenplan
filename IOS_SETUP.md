# iOS App Setup Guide

The app is configured to build as a native iOS app using Capacitor.

## Prerequisites

- macOS with Xcode installed (required for iOS development)
- Apple Developer account (for App Store distribution)
- CocoaPods installed: `brew install cocoapods`
- XCode Command Line Tools: `xcode-select --install`
- XCode license agreement accepted: `sudo xcodebuild -license accept`
- XCode first-time setup completed: `xcodebuild -runFirstLaunch`

## Development Workflow

### 1. Build the web app

```bash
npm run build
```

### 2. Sync web assets to iOS

```bash
npx cap sync ios
```

### 3. Open in Xcode

```bash
npx cap open ios
```

### Combined build and sync

```bash
npx cap:build
```

## First-Time iOS Setup in Xcode

1. **Open the project** in Xcode using `npx cap:open:ios`

2. **Configure signing**:

   - Select the "App" target in the project navigator
   - Go to "Signing & Capabilities" tab
   - Select your development team
   - Xcode will automatically manage provisioning profiles

3. **Set app icon and splash screen**:

   - App icon: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
   - Splash screen: Configure in `ios/App/App/Assets.xcassets/Splash.imageset/`
   - Use 1024x1024px PNG for app icon
   - Recommended: Use an app icon generator tool

4. **Configure display name** (optional):

   - In Xcode, select the "App" target
   - Change "Display Name" under "General" tab

5. **Run on device/simulator**:
   - Select a target device/simulator in Xcode
   - Click the "Run" button (▶️)

## Building for App Store

### 1. Update version and build number

In Xcode, under "General" tab:

- Version: e.g., "1.0.0"
- Build: e.g., "1"

### 2. Create archive

- In Xcode: Product → Archive
- Wait for archive to complete

### 3. Upload to App Store Connect

- Window → Organizer
- Select your archive
- Click "Distribute App"
- Follow the wizard to upload to App Store Connect

### 4. Complete App Store listing

- Go to App Store Connect (appstoreconnect.apple.com)
- Create a new app
- Fill in metadata (description, screenshots, etc.)
- Submit for review

## App Configuration

The app is configured in `capacitor.config.ts`:

- App ID: `net.roblillack.stundenplan`
- App Name: `Unser Stundenplan`
- Web directory: `dist`

## Installed Plugins

- `@capacitor/app` - App lifecycle and state management
- `@capacitor/splash-screen` - Splash screen control

## Troubleshooting

### CocoaPods errors

```bash
cd ios/App
pod install
cd ../..
```

### Clean and rebuild

```bash
npm run build
npx cap sync ios
```

Then clean build folder in Xcode: Product → Clean Build Folder

### Web assets not updating

Make sure to run `npm run build` before `npm run cap:sync`

## Resources

- [Capacitor Documentation](https://capacitorjs.com)
- [iOS Development Guide](https://capacitorjs.com/docs/ios)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
