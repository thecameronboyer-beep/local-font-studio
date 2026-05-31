# Android App Build

Local Font Studio now ships as a Capacitor Android app in addition to the browser/PWA build.

## Download from GitHub

Every push to `main` runs the **Android APK** workflow. Open the latest successful run in GitHub Actions and download the `local-font-studio-debug-apk` artifact. The artifact contains `app-debug.apk`, which can be installed on Android after enabling installs from unknown sources for the browser or file manager you use.

For release-style downloads, publish a GitHub Release. The same workflow attaches the generated debug APK to the release.

## Local Build

Requirements:

- Node 22 or newer.
- JDK 21.
- Android SDK with a recent Android platform installed.

Commands:

```bash
npm ci
npm run android:sync
cd android
./gradlew assembleDebug
```

The APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Notes

- The app ID is `com.thecameronboyer.localfontstudio`.
- The Android shell loads the built Vite assets from `dist`.
- Debug APKs use the project debug signing key so future downloads install as updates.
- Project data still stays local to the device WebView storage, so use the Phase 4 JSON export/import tools when moving projects between devices.
