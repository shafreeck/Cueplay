export interface PlayableSource {
    id: string; // usually fileId
    url: string; // The playback URL (HLS/mp4)
    type: 'hls' | 'mp4' | 'dash';
    headers?: Record<string, string>; // Headers required for playback (e.g. Cookie, User-Agent)
    expiresAt?: number; // Timestamp when the URL might expire
    meta?: any; // any extra provider-specific metadata
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
