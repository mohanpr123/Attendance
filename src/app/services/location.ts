import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

export interface LocationRecord {
  deviceName: string;
  latitude: number;
  longitude: number;
  timestamp: number;
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

  private getSafeDeviceName(deviceName: string): string {
    const value = deviceName.trim() || 'Mohan';

    return value.replace(/[\/\\#?]/g, '-');
  }
}
