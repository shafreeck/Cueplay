"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryManager = void 0;
class RecoveryManager {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async recoverFromError(error, currentSource, context) {
        // Check if error is related to token expiration (403, 410, or specific provider codes)
        const isTokenError = this.isTokenError(error);
        if (isTokenError) {
            console.log('Token expired, refreshing source...');
            try {
                const newSource = await this.provider.refreshPlayableSource(currentSource, context);
                return newSource;
            }
            catch (e) {
                console.error('Failed to refresh source:', e);
                throw e;
            }
        }
        return null; // Cannot recover
    }
    isTokenError(error) {
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
exports.RecoveryManager = RecoveryManager;
//# sourceMappingURL=manager.js.map