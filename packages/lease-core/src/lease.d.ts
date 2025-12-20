export interface Lease {
    id: string;
    deviceId: string;
    roomId?: string;
    expiresAt: number;
    status: 'active' | 'revoked' | 'expired';
}
export declare class LeaseManager {
    static generateLease(deviceId: string, roomId?: string, durationSeconds?: number): Lease;
    static renewLease(lease: Lease, durationSeconds?: number): Lease;
    static revokeLease(lease: Lease): Lease;
    static isValide(lease: Lease): boolean;
}
//# sourceMappingURL=lease.d.ts.map