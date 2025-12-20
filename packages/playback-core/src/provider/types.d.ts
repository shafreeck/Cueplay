export interface PlayableSource {
    id: string;
    url: string;
    type: 'hls' | 'mp4' | 'dash';
    headers?: Record<string, string>;
    expiresAt?: number;
    meta?: any;
}
export interface PlayableProvider {
    /**
     * Resolve a file ID to a playable source
     */
    resolvePlayableSource(fileId: string, context?: any): Promise<PlayableSource>;
    /**
     * Refresh an expired source
     */
    refreshPlayableSource(source: PlayableSource, context?: any): Promise<PlayableSource>;
}
//# sourceMappingURL=types.d.ts.map