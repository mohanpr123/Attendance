import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LocationService } from './services/location';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly locationService = inject(LocationService);

  protected readonly deviceName = signal('Mohan');
  protected readonly isSending = signal(false);
  protected readonly status = signal('Ready');
  protected readonly lastLocation = signal<{
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null>(null);

  protected updateDeviceName(value: string): void {
    this.deviceName.set(value);
  }

  protected getLocation(): void {
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
