/**
 * Handles time synchronization calculations.
 * In Phase 2, we assume a relatively simple leader-follower model.
 * More complex NTP-like sync can be added later if needed.
 */
export class SyncClock {
    /**
     * Calculate the estimated current time of the leader.
     * @param leaderTime The time reported by the leader
     * @param receivedAt The local timestamp when the message was received
     * @param latency Estimated one-way network latency (default 0)
     */
    static estimateLeaderTime(leaderTime: number, receivedAt: number, latency: number = 0): number {
        const now = Date.now();
        const timeSinceReceipt = now - receivedAt;
        // Leader is at: reported_time + time_since_packet_arrived + partial_latency_compensation
        return leaderTime + timeSinceReceipt + latency;
    }

    /**
     * Calculate the difference between local playback time and target time.
     * Positive means we are ahead, negative means we are behind.
     */
    static calculateDrift(localTime: number, targetTime: number): number {
        return localTime - targetTime;
    }
}
