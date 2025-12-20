"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaseManager = void 0;
class LeaseManager {
    // Simple in-memory storage for core logic
    // In real service, this might delegate to a DB
    static generateLease(deviceId, roomId, durationSeconds = 300) {
        const now = Date.now();
        return {
            id: Math.random().toString(36).substring(7),
            deviceId,
            roomId,
            expiresAt: now + (durationSeconds * 1000),
            status: 'active'
        };
    }
    static renewLease(lease, durationSeconds = 300) {
        if (lease.status !== 'active') {
            throw new Error('Cannot renew inactive lease');
        }
        const now = Date.now();
        // Use the greater of (current expiry, now) + duration? 
        // Usually renew implies extending from NOW.
        lease.expiresAt = now + (durationSeconds * 1000);
        return lease;
    }
    static revokeLease(lease) {
        lease.status = 'revoked';
        return lease;
    }
    static isValide(lease) {
        if (lease.status !== 'active')
            return false;
        return Date.now() < lease.expiresAt;
    }
}
exports.LeaseManager = LeaseManager;
//# sourceMappingURL=lease.js.map