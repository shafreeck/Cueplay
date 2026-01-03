// @ts-ignore
import * as MP4Box from 'mp4box';

export interface SubtitleCue {
    startTime: number;
    endTime: number;
    text: string;
}

export interface SubtitleTrackInfo {
    id: number;
    language: string;
    name: string;
    codec: string;
    nb_samples: number;
}

export class SubtitleExtractor {
    private mp4box: any;
    public url: string;
    private cookie?: string;
    private detectedTracks: SubtitleTrackInfo[] = [];
    private cues: Map<number, SubtitleCue[]> = new Map(); // TrackID -> Cues
    private isMOOVReady = false;
    private onTracksDetected?: (tracks: SubtitleTrackInfo[]) => void;
    private onLog?: (msg: string) => void;
    private activeTrackId: number | null = null;

    private abortController: AbortController | null = null;
    private isStopped = false;
    private loadedTracks: Set<number> = new Set();
    private processingTrackId: number | null = null;

    constructor(url: string, options?: {
        cookie?: string;
        onLog?: (msg: string) => void;
        onTracksDetected?: (tracks: SubtitleTrackInfo[]) => void;
    }) {
        this.url = url;
        this.cookie = options?.cookie;
        this.onLog = options?.onLog;
        this.onTracksDetected = options?.onTracksDetected;
        this.mp4box = MP4Box.createFile();

        this.mp4box.onError = (e: any) => {
            if (this.isStopped) return;
            this.log(`[Extractor] Error: ${e}`);
        };

        this.mp4box.onReady = (info: any) => {
            if (this.isMOOVReady || this.isStopped) return;

            this.detectedTracks = info.tracks
                .filter((t: any) => {
                    const h = (t.handler || t.type || '').toLowerCase();
                    const codec = (t.codec || '').toLowerCase();
                    return h === 'sbtl' || h === 'subt' || h === 'text' || h === 'subtitles' ||
                        codec.includes('tx3g') || codec.includes('text') || codec.includes('wvtt');
                })
                .map((t: any) => ({
                    id: t.id,
                    language: t.language,
                    name: t.name || `Track ${t.id}`,
                    codec: t.codec,
                    nb_samples: t.nb_samples
                }));

            this.onTracksDetected?.(this.detectedTracks);

            if (this.activeTrackId === null && this.detectedTracks.length > 0) {
                let best = this.detectedTracks.find(t => {
                    const lang = (t.language || '').toLowerCase();
                    return lang === 'chi' || lang === 'zho' || lang === 'zh';
                }) || this.detectedTracks.find(t => (t.language || '').toLowerCase() === 'eng')
                    || this.detectedTracks[0];

                this.activeTrackId = best.id;
            }

            this.isMOOVReady = true;
        };
    }

    private log(msg: string) {
        if (this.isStopped) return;
        if (this.onLog) this.onLog(msg);
        else console.log(msg);
    }

    stop() {
        this.log(`[Extractor] Stopping background tasks...`);
        this.isStopped = true;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    async setTrack(trackId: number, currentTime: number = 0) {
        if (this.isStopped) return;
        if (!this.detectedTracks.find(t => t.id === trackId)) return;

        const isNewTrack = this.activeTrackId !== trackId;
        this.activeTrackId = trackId;

        if (isNewTrack) {
            this.log(`[Extractor] Track Switch -> T${trackId}`);
            if (this.isMOOVReady) {
                await this.extractActiveTrack(currentTime);
            }
        }
    }

    async initialize(currentTime: number = 0) {
        if (this.isStopped) return;
        if (this.isMOOVReady && this.activeTrackId !== null && this.loadedTracks.has(this.activeTrackId)) return;

        try {
            const headRes = await fetch(this.url, { method: 'HEAD' });
            const totalSize = parseInt(headRes.headers.get('content-length') || '0');

            const firstChunk = await fetch(this.url, { headers: { 'Range': 'bytes=0-5242879' } });
            if (firstChunk.ok || firstChunk.status === 206) {
                const buffer = await firstChunk.arrayBuffer();
                (buffer as any).fileStart = 0;
                this.mp4box.appendBuffer(buffer);
            }

            let retry = 0;
            while (!this.isMOOVReady && retry < 25 && !this.isStopped) {
                await new Promise(r => setTimeout(r, 200));
                retry++;
                if (retry % 5 === 0) this.mp4box.flush();
            }

            if (!this.isMOOVReady && totalSize > 5242880 && !this.isStopped) {
                const tailStart = totalSize - 5242880;
                const lastChunk = await fetch(this.url, { headers: { 'Range': `bytes=${tailStart}-${totalSize - 1}` } });
                if (lastChunk.ok || lastChunk.status === 206) {
                    const buffer = await lastChunk.arrayBuffer();
                    (buffer as any).fileStart = tailStart;
                    this.mp4box.appendBuffer(buffer);
                }

                retry = 0;
                while (!this.isMOOVReady && retry < 25 && !this.isStopped) {
                    await new Promise(r => setTimeout(r, 200));
                    retry++;
                    this.mp4box.flush();
                }
            }

            if (this.isMOOVReady && !this.isStopped) {
                await this.extractActiveTrack(currentTime);
            }
        } catch (e: any) {
            if (!this.isStopped) this.log(`[Extractor] Init Error: ${e.message}`);
        }
    }

    private async extractActiveTrack(currentTime: number) {
        if (this.activeTrackId === null || this.isStopped) return;
        if (this.loadedTracks.has(this.activeTrackId)) return;

        // Cancel previous track's requests if different
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        const tId = this.activeTrackId;
        const track = this.mp4box.getTrackById(tId);
        if (!track || !track.samples || track.samples.length === 0) return;

        this.log(`[Extractor] T${tId} loading samples...`);
        const trackCues: SubtitleCue[] = this.cues.get(tId) || [];
        this.cues.set(tId, trackCues);

        const sortedSamples = [...track.samples].sort((a, b) => a.offset - b.offset);
        const clusters: any[][] = [];
        let currentCluster: any[] = [];
        for (const s of sortedSamples) {
            const last = currentCluster[currentCluster.length - 1];
            const gap = last ? (s.offset - (last.offset + last.size)) : 0;
            const clusterSize = last ? (last.offset + last.size - currentCluster[0].offset) : 0;
            if (currentCluster.length > 0 && gap < 64000 && clusterSize < 512000) {
                currentCluster.push(s);
            } else {
                if (currentCluster.length > 0) clusters.push(currentCluster);
                currentCluster = [s];
            }
        }
        if (currentCluster.length > 0) clusters.push(currentCluster);

        // Priority sort
        const priorityQueue = clusters.map(c => {
            const clusterStartTime = c[0].cts / c[0].timescale;
            const dist = Math.abs(clusterStartTime - currentTime);
            const weight = (clusterStartTime >= currentTime && clusterStartTime < currentTime + 300) ? 0 : dist;
            return { cluster: c, weight };
        }).sort((a, b) => a.weight - b.weight);

        const sortedClusters = priorityQueue.map(p => p.cluster);
        const concurrency = 8;
        const queue = [...sortedClusters];

        const processBatch = async () => {
            while (queue.length > 0 && !this.isStopped && !signal.aborted) {
                const batch = queue.splice(0, concurrency);
                await Promise.all(batch.map(c => this.fetchCluster(c, trackCues, signal)));
            }
            if (!this.isStopped && !signal.aborted && queue.length === 0) {
                this.loadedTracks.add(tId);
                this.log(`[Extractor] T${tId} fully loaded.`);
            }
        };

        processBatch();
    }

    private async fetchCluster(cluster: any[], targetCues: SubtitleCue[], signal: AbortSignal) {
        const start = cluster[0].offset;
        const end = cluster[cluster.length - 1].offset + cluster[cluster.length - 1].size;

        try {
            const res = await fetch(this.url, {
                headers: { 'Range': `bytes=${start}-${end - 1}` },
                signal
            });
            if (!res.ok && res.status !== 206) return;

            const buffer = await res.arrayBuffer();
            for (const s of cluster) {
                if (signal.aborted) break;
                const relOffset = s.offset - start;
                if (s.size > 2) {
                    try {
                        const startTime = s.cts / s.timescale;
                        const duration = s.duration || s.delta || 0;
                        const endTime = (s.cts + duration) / s.timescale;

                        const view = new DataView(buffer, relOffset, 2);
                        const textLen = view.getUint16(0);

                        if (textLen > 0 && textLen <= s.size - 2) {
                            const textData = new Uint8Array(buffer, relOffset + 2, textLen);
                            let text = new TextDecoder('utf-8').decode(textData);
                            // eslint-disable-next-line no-control-regex
                            text = text.replace(/[^\x20-\x7E\s\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, ' ').trim();
                            if (text) {
                                if (!targetCues.some(c => c.startTime === startTime && c.text === text)) {
                                    targetCues.push({ startTime, endTime, text });
                                }
                            }
                        }
                    } catch (e) { /* ignore */ }
                }
            }
        } catch (err) { /* ignore */ }
    }

    getActiveCue(time: number): string {
        if (this.activeTrackId === null || this.isStopped) return '';
        const trackCues = this.cues.get(this.activeTrackId);
        if (!trackCues) return '';
        const cue = trackCues.find(c => time >= c.startTime && time <= (c.endTime + 0.1));
        return cue ? cue.text : '';
    }

    getTracks(): SubtitleTrackInfo[] {
        return this.detectedTracks;
    }

    hasSubtitles(): boolean {
        if (this.activeTrackId === null || this.isStopped) return false;
        return (this.cues.get(this.activeTrackId)?.length || 0) > 0;
    }
}
