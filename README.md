# Attendance Mobile App

Angular + Capacitor mobile app for the geo-fenced attendance prototype.

## Local Preview

```powershell
npm start
```

Push notifications only work in the Android app build, not in the browser preview.

## Android Push Setup

1. Add an Android app in Firebase Console with package name `com.mohan.attendance`.
2. Download `google-services.json`.
3. Put the file here:

```text
android/app/google-services.json
```

4. Build and sync:

```powershell
npm run build
npx cap sync android
```

The app stores the FCM token in Firestore at `devices/{deviceName}`. The admin panel uses that token when queuing an attendance push request.
