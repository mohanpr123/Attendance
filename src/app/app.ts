import { Capacitor } from '@capacitor/core';
import {
  AndroidBiometryStrength,
  BiometricAuth,
  BiometryError,
} from '@aparajita/capacitor-biometric-auth';
import { PushNotifications } from '@capacitor/push-notifications';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LocationService } from './services/location';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private readonly locationService = inject(LocationService);
  private readonly biometricBindingStorageKey = 'attendance.biometricBindingId';
  private readonly biometricTypeStorageKey = 'attendance.biometricType';

  protected readonly deviceName = signal('Mohan');
  protected readonly biometricBindingId = signal<string | null>(null);
  protected readonly biometricStatus = signal('Fingerprint setup pending');
  protected readonly biometricType = signal('strong');
  protected readonly pendingAttendanceRequest = signal(false);
  protected readonly isSending = signal(false);
  protected readonly status = signal('Ready');
  protected readonly pushStatus = signal('Push registration pending');
  protected readonly pushToken = signal<string | null>(null);
  protected readonly lastLocation = signal<{
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null>(null);

  async ngOnInit(): Promise<void> {
    this.loadBiometricBinding();
    await this.checkBiometricAvailability();
    await this.initPush();
  }

  protected updateDeviceName(value: string): void {
    this.deviceName.set(value);

    if (this.pushToken()) {
      void this.savePushToken(this.pushToken() ?? '');
      void this.saveBiometricBinding();
    }
  }

  protected async setupFingerprint(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.biometricStatus.set('Fingerprint setup works in the Android app build.');
      return;
    }

    const verified = await this.authenticateWithFingerprint(
      'Set up fingerprint attendance',
      'Verify once to bind this phone for attendance',
    );

    if (!verified) {
      return;
    }

    const bindingId = this.createBindingId();
    this.biometricBindingId.set(bindingId);
    localStorage.setItem(this.biometricBindingStorageKey, bindingId);
    localStorage.setItem(this.biometricTypeStorageKey, this.biometricType());
    await this.saveBiometricBinding();
    this.biometricStatus.set('Fingerprint binding saved.');
  }

  protected async approveAttendanceRequest(): Promise<void> {
    this.pendingAttendanceRequest.set(false);

    if (!this.biometricBindingId()) {
      await this.setupFingerprint();
    }

    if (!this.biometricBindingId()) {
      this.status.set('Fingerprint setup is required.');
      return;
    }

    const verified = await this.authenticateWithFingerprint(
      'Verify attendance',
      'Use fingerprint before sending location',
    );

    if (!verified) {
      this.status.set('Fingerprint verification failed.');
      return;
    }

    this.sendLocation();
  }

  protected declineAttendanceRequest(): void {
    this.pendingAttendanceRequest.set(false);
    this.status.set('Attendance request skipped.');
  }

  private async initPush(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.pushStatus.set('Push notifications run in the Android app build.');
      return;
    }

    try {
      if (Capacitor.getPlatform() === 'android') {
        await PushNotifications.createChannel({
          id: 'attendance',
          name: 'Attendance',
          description: 'Attendance check requests',
          importance: 4,
          visibility: 1,
          vibration: true,
        });
      }

      await PushNotifications.addListener('registration', (token) => {
        this.pushToken.set(token.value);
        this.pushStatus.set('Push token registered.');
        void this.savePushToken(token.value);
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error', error);
        this.pushStatus.set('Push registration failed.');
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const action = notification.data?.['action'];

        if (action === 'SEND_LOCATION') {
          this.pendingAttendanceRequest.set(true);
          this.status.set('Attendance request received.');
        }

        this.pushStatus.set('Attendance request received.');
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
        const action = event.notification.data?.['action'];

        if (action === 'SEND_LOCATION') {
          this.pendingAttendanceRequest.set(true);
          this.status.set('Attendance request opened.');
        }
      });

      const permission = await PushNotifications.requestPermissions();

      if (permission.receive !== 'granted') {
        this.pushStatus.set('Push permission denied.');
        return;
      }

      await PushNotifications.register();
      this.pushStatus.set('Waiting for push token...');
    } catch (error) {
      console.error('Push init error', error);
      this.pushStatus.set('Push setup failed.');
    }
  }

  private async savePushToken(token: string): Promise<void> {
    if (!token) {
      return;
    }

    try {
      await this.locationService.saveToken(
        this.deviceName(),
        token,
        this.biometricBindingId(),
        this.biometricType(),
      );
    } catch (error) {
      console.error('Token save error', error);
      this.pushStatus.set('Could not save push token.');
    }
  }

  private loadBiometricBinding(): void {
    const bindingId = localStorage.getItem(this.biometricBindingStorageKey);
    const biometricType = localStorage.getItem(this.biometricTypeStorageKey);

    if (bindingId) {
      this.biometricBindingId.set(bindingId);
      this.biometricType.set(biometricType || 'strong');
      this.biometricStatus.set('Fingerprint binding ready.');
    }
  }

  private async checkBiometricAvailability(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.biometricStatus.set('Fingerprint runs in the Android app build.');
      return;
    }

    try {
      const info = await BiometricAuth.checkBiometry();

      if (!info.strongBiometryIsAvailable) {
        this.biometricStatus.set('Strong fingerprint/biometric is not enrolled.');
        return;
      }

      this.biometricType.set(String(info.biometryType));

      if (!this.biometricBindingId()) {
        this.biometricStatus.set('Tap Set Up Fingerprint before attendance.');
      }
    } catch (error) {
      console.error('Biometry check error', error);
      this.biometricStatus.set('Could not check fingerprint availability.');
    }
  }

  private async authenticateWithFingerprint(
    title: string,
    subtitle: string,
  ): Promise<boolean> {
    try {
      await BiometricAuth.authenticate({
        reason: 'Attendance requires fingerprint verification.',
        cancelTitle: 'Cancel',
        allowDeviceCredential: false,
        androidTitle: title,
        androidSubtitle: subtitle,
        androidConfirmationRequired: false,
        androidBiometryStrength: AndroidBiometryStrength.strong,
      });

      return true;
    } catch (error) {
      if (error instanceof BiometryError) {
        this.biometricStatus.set(error.message);
      } else {
        this.biometricStatus.set('Fingerprint verification failed.');
      }

      console.error('Fingerprint auth error', error);
      return false;
    }
  }

  private async saveBiometricBinding(): Promise<void> {
    const bindingId = this.biometricBindingId();

    if (!bindingId) {
      return;
    }

    try {
      await this.locationService.saveBiometricBinding(
        this.deviceName(),
        bindingId,
        this.biometricType(),
      );
    } catch (error) {
      console.error('Biometric binding save error', error);
      this.biometricStatus.set('Could not save fingerprint binding.');
    }
  }

  private createBindingId(): string {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private sendLocation(): void {
    if (!navigator.geolocation) {
      this.status.set('Location is not available on this device.');
      return;
    }

    this.isSending.set(true);
    this.status.set('Getting location...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
          await this.locationService.sendLocation(
            this.deviceName(),
            latitude,
            longitude,
            this.biometricBindingId() ?? '',
            this.biometricType(),
          );

          this.lastLocation.set({
            latitude,
            longitude,
            timestamp: Date.now(),
          });
          this.status.set('Location sent to Firebase.');
        } catch (error) {
          console.error('Firebase error', error);
          this.status.set('Could not send location.');
        } finally {
          this.isSending.set(false);
        }
      },
      (error) => {
        console.error('Location error', error);
        this.status.set(error.message || 'Could not get location.');
        this.isSending.set(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );
  }

  protected formatCoordinate(value: number): string {
    return value.toFixed(6);
  }

  protected formatTime(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(timestamp);
  }
}
