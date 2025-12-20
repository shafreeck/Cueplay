import { PlaybackState } from './leader';
import { SyncClock } from './clock';

export interface AdjustmentAction {
    type: 'seek' | 'set_rate' | 'nothing';
    value?: number;
    reason?: string;
}

export class FollowerAdjuster {
    // Thresholds
    private static MAX_DRIFT_MS = 500; // 0.5s tolerance
    private static CATCHUP_RATE = 1.1; // 10% faster to catch up

    determineAction(localState: PlaybackState, leaderState: PlaybackState, receivedAt: number): AdjustmentAction {
        // 1. If status is different, immediate action
        if (localState.status !== leaderState.status) {
            // If leader is paused, we pause.
            // If leader is buffering, we might pause or wait.
            // For Phase 2, strictly follow leader status.
            // But we need to sync time too.
            const estimatedLeaderTime = SyncClock.estimateLeaderTime(leaderState.time, receivedAt);
            return { type: 'seek', value: estimatedLeaderTime, reason: `Status mismatch: ${localState.status} != ${leaderState.status}` };
        }

        // 2. If both Paused, just strict seek if drift is huge
        if (leaderState.status === 'paused') {
            const drift = Math.abs(localState.time - leaderState.time);
            if (drift > 0.1) { // 100ms strict for pause
                return { type: 'seek', value: leaderState.time, reason: 'Paused drift fix' };
            }
            return { type: 'nothing' };
        }

        // 3. Both Playing: Calculate Drift
        const estimatedLeaderTime = SyncClock.estimateLeaderTime(leaderState.time, receivedAt);
        const drift = SyncClock.calculateDrift(localState.time, estimatedLeaderTime); // local - leader

        // If behind by > 2s or ahead by > 2s, hard seek
        if (Math.abs(drift) > 2.0) {
            return { type: 'seek', value: estimatedLeaderTime, reason: 'Hard drift (>2s)' };
        }

        // If behind by > 500ms, speed up (not implemented fully in phase 2, so maybe small seek)
        // For simple phase 2, let's just seek if > 500ms
        if (Math.abs(drift) > (FollowerAdjuster.MAX_DRIFT_MS / 1000)) {
            return { type: 'seek', value: estimatedLeaderTime, reason: 'Soft drift (>500ms)' };
        }

        return { type: 'nothing' };
    }
}
