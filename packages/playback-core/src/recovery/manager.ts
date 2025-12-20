import { PlayableProvider, PlayableSource } from '../provider/types';

export class RecoveryManager {
    constructor(private provider: PlayableProvider) { }

    async recoverFromError(error: any, currentSource: PlayableSource, context: any): Promise<PlayableSource | null> {
        // Check if error is related to token expiration (403, 410, or specific provider codes)
        const isTokenError = this.isTokenError(error);

        if (isTokenError) {
            console.log('Token expired, refreshing source...');
            try {
                const newSource = await this.provider.refreshPlayableSource(currentSource, context);
                return newSource;
            } catch (e) {
                console.error('Failed to refresh source:', e);
                throw e;
            }
        }

        return null; // Cannot recover
    }

    private isTokenError(error: any): boolean {
        // This logic would need to be specific to the error format (HTTP status, HLS.js error details, etc.)
        if (typeof error === 'number') {
            return error === 403 || error === 410;
        }
        if (error && error.status) {
            return error.status === 403 || error.status === 410;
        }
        return false;
    }
}
