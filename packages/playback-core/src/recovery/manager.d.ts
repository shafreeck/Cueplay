import { PlayableProvider, PlayableSource } from '../provider/types';
export declare class RecoveryManager {
    private provider;
    constructor(provider: PlayableProvider);
    recoverFromError(error: any, currentSource: PlayableSource, context: any): Promise<PlayableSource | null>;
    private isTokenError;
}
//# sourceMappingURL=manager.d.ts.map