export interface PlaybackState {
    status: 'playing' | 'paused' | 'buffering';
    time: number;
    rate: number;
    updatedAt: number; // Wall clock time when this state was captured
}

export class LeaderBroadcaster {
    private lastState: PlaybackState | null = null;
    private broadcastIntervalMs: number = 2000;
    private lastBroadcastTime: number = 0;

    constructor(config?: { broadcastIntervalMs?: number }) {
        if (config?.broadcastIntervalMs) {
            this.broadcastIntervalMs = config.broadcastIntervalMs;
        }
    }

    /**
     * Determine if we should broadcast the current state.
     * Returns true if state changed significantly (e.g. pause/play, seek) or interval elapsed.
     */
    shouldBroadcast(currentState: PlaybackState): boolean {
        const now = Date.now();

        if (!this.lastState) {
            this.lastState = currentState;
            this.lastBroadcastTime = now;
            return true;
        }

        // Status changed (e.g. paused -> playing)
        if (this.lastState.status !== currentState.status) {
            this.updateLastState(currentState, now);
            return true;
        }

        // Rate changed
        if (this.lastState.rate !== currentState.rate) {
            this.updateLastState(currentState, now);
            return true;
        }

        // Significant seek (detected by logic external to this usually, but strict check here)
        // If playing, expected time is lastTime + elapsed * rate. If diff is large, it's a seek.
        if (currentState.status === 'playing') {
            const elapsed = (currentState.updatedAt - this.lastState.updatedAt) / 1000;
            const expectedTime = this.lastState.time + (elapsed * this.lastState.rate);
            if (Math.abs(currentState.time - expectedTime) > 0.5) { // 500ms threshold
                this.updateLastState(currentState, now);
                return true;
            }
        }

        // Periodic sync
        if (now - this.lastBroadcastTime > this.broadcastIntervalMs) {
            this.updateLastState(currentState, now);
            return true;
        }

        return false;
    }

    private updateLastState(state: PlaybackState, now: number) {
        this.lastState = state;
        this.lastBroadcastTime = now;
    }
}
