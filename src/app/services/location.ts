import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

export interface LocationRecord {
  deviceName: string;
  latitude: number;
  longitude: number;
  biometricBindingId: string;
  biometricType: string;
  biometricVerified: boolean;
  biometricVerifiedAt: number;
  timestamp: number;
}

export interface DeviceRecord {
  biometricBindingId?: string;
  biometricBoundAt?: number;
  biometricType?: string;
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
    biometricBindingId: string,
    biometricType: string,
  ): Promise<void> {
    const safeDeviceName = this.getSafeDeviceName(deviceName);
    const ref = doc(this.firestore, `locations/${safeDeviceName}`);
    const timestamp = Date.now();

    await setDoc(ref, {
      biometricBindingId,
      biometricType,
      biometricVerified: true,
      biometricVerifiedAt: timestamp,
      deviceName: safeDeviceName,
      latitude,
      longitude,
      timestamp,
    } satisfies LocationRecord);
  }

  async saveToken(
    deviceName: string,
    token: string,
    biometricBindingId?: string | null,
    biometricType?: string | null,
  ): Promise<void> {
    const safeDeviceName = this.getSafeDeviceName(deviceName);
    const ref = doc(this.firestore, `devices/${safeDeviceName}`);
    const device: DeviceRecord = {
      deviceName: safeDeviceName,
      token,
      updatedAt: Date.now(),
    };

    if (biometricBindingId) {
      device.biometricBindingId = biometricBindingId;
      device.biometricBoundAt = Date.now();
      device.biometricType = biometricType || 'strong';
    }

    await setDoc(
      ref,
      device,
      { merge: true },
    );
  }

  async saveBiometricBinding(
    deviceName: string,
    biometricBindingId: string,
    biometricType: string,
  ): Promise<void> {
    const safeDeviceName = this.getSafeDeviceName(deviceName);
    const ref = doc(this.firestore, `devices/${safeDeviceName}`);

    await setDoc(
      ref,
      {
        biometricBindingId,
        biometricBoundAt: Date.now(),
        biometricType,
        deviceName: safeDeviceName,
        updatedAt: Date.now(),
      } satisfies Partial<DeviceRecord>,
      { merge: true },
    );
  }

  private getSafeDeviceName(deviceName: string): string {
    const value = deviceName.trim() || 'Mohan';

    return value.replace(/[\/\\#?]/g, '-');
  }
}
