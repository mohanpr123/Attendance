import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

export interface LocationRecord {
  deviceName: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface DeviceRecord {
  deviceName: string;
  token: string;
  updatedAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private readonly firestore = inject(Firestore);

  async sendLocation(
    deviceName: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const safeDeviceName = this.getSafeDeviceName(deviceName);
    const ref = doc(this.firestore, `locations/${safeDeviceName}`);

    await setDoc(ref, {
      deviceName: safeDeviceName,
      latitude,
      longitude,
      timestamp: Date.now(),
    } satisfies LocationRecord);
  }

  async saveToken(deviceName: string, token: string): Promise<void> {
    const safeDeviceName = this.getSafeDeviceName(deviceName);
    const ref = doc(this.firestore, `devices/${safeDeviceName}`);

    await setDoc(
      ref,
      {
        deviceName: safeDeviceName,
        token,
        updatedAt: Date.now(),
      } satisfies DeviceRecord,
      { merge: true },
    );
  }

  private getSafeDeviceName(deviceName: string): string {
    const value = deviceName.trim() || 'Mohan';

    return value.replace(/[\/\\#?]/g, '-');
  }
}
