export interface Lease {
    id: string;
    deviceId: string;
    roomId?: string;
    expiresAt: number; // Timestamp
    status: 'active' | 'revoked' | 'expired';
}

export class LeaseManager {
    // Simple in-memory storage for core logic
    // In real service, this might delegate to a DB

    static generateLease(deviceId: string, roomId?: string, durationSeconds: number = 300): Lease {
        const now = Date.now();
        return {
            id: Math.random().toString(36).substring(7),
            deviceId,
            roomId,
            expiresAt: now + (durationSeconds * 1000),
            status: 'active'
        };
    }

    static renewLease(lease: Lease, durationSeconds: number = 300): Lease {
        if (lease.status !== 'active') {
            throw new Error('Cannot renew inactive lease');
        }
        const now = Date.now();
        // Use the greater of (current expiry, now) + duration? 
        // Usually renew implies extending from NOW.
        lease.expiresAt = now + (durationSeconds * 1000);
        return lease;
    }

    static revokeLease(lease: Lease): Lease {
        lease.status = 'revoked';
        return lease;
    }

    static isValide(lease: Lease): boolean {
        if (lease.status !== 'active') return false;
        return Date.now() < lease.expiresAt;
    }
}
