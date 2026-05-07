import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

export interface AttendanceVerificationRecord {
  attendanceId: string;
  deviceId: string;
  deviceName: string;
  latitude: number;
  longitude: number;
  biometricBindingId: string;
  biometricType: string;
  biometricVerified: boolean;
  biometricVerifiedAt: number;
  phoneVerified: boolean;
  verificationStatus: 'Verified';
  verifiedAt: number;
  checkin?: 'IN' | 'OUT';
  locationTimestamp: number;
}

export interface DeviceRecord {
  deviceId: string;
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

  async sendAttendanceVerification(
    attendanceId: string,
    deviceId: string,
    deviceName: string,
    latitude: number,
    longitude: number,
    biometricBindingId: string,
    biometricType: string,
    checkin?: 'IN' | 'OUT',
  ): Promise<void> {
    const ref = doc(this.firestore, `attendance/${attendanceId}`);
    const timestamp = Date.now();
    const record: AttendanceVerificationRecord = {
      attendanceId,
      deviceId,
      biometricBindingId,
      biometricType,
      biometricVerified: true,
      biometricVerifiedAt: timestamp,
      phoneVerified: true,
      verificationStatus: 'Verified',
      verifiedAt: timestamp,
      deviceName,
      latitude,
      longitude,
      locationTimestamp: timestamp,
    };

    if (checkin) {
      record.checkin = checkin;
    }

    await setDoc(ref, record, { merge: true });
  }

  async declineAttendanceVerification(
    attendanceId: string,
    deviceId: string,
    deviceName: string,
  ): Promise<void> {
    const ref = doc(this.firestore, `attendance/${attendanceId}`);

    await setDoc(
      ref,
      {
        deviceId,
        deviceName,
        phoneVerified: false,
        verificationStatus: 'Declined',
        verifiedAt: Date.now(),
      },
      { merge: true },
    );
  }

  async saveToken(
    deviceId: string,
    deviceName: string,
    token: string,
    biometricBindingId?: string | null,
    biometricType?: string | null,
  ): Promise<void> {
    const ref = doc(this.firestore, `devices/${deviceId}`);
    const device: DeviceRecord = {
      deviceId,
      deviceName,
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
    deviceId: string,
    deviceName: string,
    biometricBindingId: string,
    biometricType: string,
  ): Promise<void> {
    const ref = doc(this.firestore, `devices/${deviceId}`);

    await setDoc(
      ref,
      {
        deviceId,
        biometricBindingId,
        biometricBoundAt: Date.now(),
        biometricType,
        deviceName,
        updatedAt: Date.now(),
      } satisfies Partial<DeviceRecord>,
      { merge: true },
    );
  }
}
