import { Capacitor } from '@capacitor/core';
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
//Hello Mohan
  protected readonly deviceName = signal('Mohan');
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
    await this.initPush();
  }

  protected updateDeviceName(value: string): void {
    this.deviceName.set(value);

    if (this.pushToken()) {
      void this.savePushToken(this.pushToken() ?? '');
    }
  }

  protected approveAttendanceRequest(): void {
    this.pendingAttendanceRequest.set(false);
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
      await this.locationService.saveToken(this.deviceName(), token);
    } catch (error) {
      console.error('Token save error', error);
      this.pushStatus.set('Could not save push token.');
    }
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
