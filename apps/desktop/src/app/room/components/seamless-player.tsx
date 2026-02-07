import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';
import { SubtitleExtractor, SubtitleTrackInfo } from '@/utils/subtitle-extractor';

export interface SeamlessVideoPlayerProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    nextSrc?: string;
    nextStartTime?: number;
    isPreloadEnabled?: boolean;
    onSeamlessStart?: () => void;
    onSubtitleChange?: (text: string) => void;
    onManualTracksDetected?: (tracks: SubtitleTrackInfo[]) => void;
    manualTrackId?: number;
    onDebug?: (msg: string) => void;
    onPlayError?: (err: any) => void;
    children?: React.ReactNode;
    isPlaying: boolean;
}

interface PlayerState {
    id: 'A' | 'B';
    src: string | undefined;
    startTime?: number;
    isActive: boolean;
}

export const SeamlessVideoPlayer = forwardRef<HTMLVideoElement, SeamlessVideoPlayerProps>(
    ({ className, src, nextSrc, nextStartTime, isPreloadEnabled = false, onSeamlessStart,
        onTimeUpdate, onEnded, onCanPlay, onLoadedMetadata,
        onError, onWaiting, onStalled, onLoadStart, onPlay, onPause, onDebug, onSubtitleChange,
        onManualTracksDetected, manualTrackId, isPlaying, children,
        ...props }, ref) => {
        const videoRefA = useRef<HTMLVideoElement>(null);
        const videoRefB = useRef<HTMLVideoElement>(null);
        const hlsRefA = useRef<Hls | null>(null);
        const hlsRefB = useRef<Hls | null>(null);

        // Subtitle Extractor Refs
        const extractorARef = useRef<SubtitleExtractor | null>(null);
        const extractorBRef = useRef<SubtitleExtractor | null>(null);

        // Track which player is currently "Active" (visible and playing)
        const [activePlayerId, setActivePlayerId] = useState<'A' | 'B'>('A');

        // Critical: Use a Ref for the ID as well, so the Proxy can read the LATEST ID synchronously
        const activePlayerIdRef = useRef<'A' | 'B'>('A');

        // Temp Hide Controls (Fix "Flash" issue): Force hide controls internally during the swap frame
        const [tempHideControls, setTempHideControls] = useState(false);

        // Track internal src state for each player
        // CRITICAL: Initialize with undefined, NOT src prop. The sync effect will handle loading.
        // This prevents stale sources from being loaded on hot reload/state persistence.
        const [stateA, setStateA] = useState<PlayerState>({ id: 'A', src: undefined, isActive: true });
        const [stateB, setStateB] = useState<PlayerState>({ id: 'B', src: undefined, isActive: false });

        // Helper to get refs
        const getActiveRef = () => activePlayerIdRef.current === 'A' ? videoRefA : videoRefB;
        const getInactiveRef = () => activePlayerIdRef.current === 'A' ? videoRefB : videoRefA;

        // Sync Source Logic
        useEffect(() => {
            const activeRef = getActiveRef();
            const inactiveRef = getInactiveRef();

            // 1. Check if the requested `src` matches what's already in the INACTIVE player (Preload Hit)
            if (activePlayerId === 'A') {
                if (src && src === stateB.src && src !== stateA.src) {
                    // HIT! Swap immediately
                    console.log("[Seamless] HIT! Swapping from A to B (Preloaded)");

                    // Notify parent to hide controls temporarily for smooth transition
                    onSeamlessStart?.();
                    setTempHideControls(true); // Internal override (Sync)

                    // Optimistic Play: Start playing B immediately before state update commits
                    // CRITICAL: ONLY play if the parent actually wants us to be playing.
                    if (isPlaying) {
                        videoRefB.current?.play().catch((e) => {
                            if (props.onPlayError) props.onPlayError(e);
                        });
                    }

                    setActivePlayerId('B');
                    activePlayerIdRef.current = 'B'; // Sync Ref immediately

                    setStateB(prev => ({ ...prev, isActive: true }));
                    // Don't clear A immediately, keeps memory warm and prevents layout thrashing
                    setStateA(prev => ({ ...prev, isActive: false }));
                    return;
                }
            } else {
                if (src && src === stateA.src && src !== stateB.src) {
                    // HIT! Swap immediately
                    const rs = videoRefA.current?.readyState;
                    console.log(`[Seamless] HIT! Swapping from B to A (Preloaded). ReadyState: ${rs}`);

                    // Notify parent to hide controls temporarily for smooth transition
                    onSeamlessStart?.();
                    setTempHideControls(true); // Internal override (Sync)

                    // Optimistic Play
                    // CRITICAL: Respect parent isPlaying state
                    if (isPlaying) {
                        videoRefA.current?.play().catch((e) => {
                            if (props.onPlayError) props.onPlayError(e);
                        });
                    }

                    setActivePlayerId('A');
                    activePlayerIdRef.current = 'A'; // Sync Ref immediately

                    setStateA(prev => ({ ...prev, isActive: true }));
                    // Don't clear B immediately
                    setStateB(prev => ({ ...prev, isActive: false }));
                    return;
                }
            }

            // 2. Normal Case: `src` changed and it's NOT in the inactive player.
            // We must load it in the ACTIVE player (traditional behavior) causes buffering.
            // OR if it's the very first load.
            const newSrc = src || undefined;

            // If src is being cleared, clear BOTH players to prevent stale source requests
            if (!newSrc) {
                if (stateA.src) setStateA(prev => ({ ...prev, src: undefined }));
                if (stateB.src) setStateB(prev => ({ ...prev, src: undefined }));
                return;
            }

            if (activePlayerId === 'A') {
                if (newSrc !== stateA.src) {
                    console.log("[Seamless] MISS! Loading new src on A:", newSrc);
                    setStateA(prev => ({ ...prev, src: newSrc as string | undefined }));
                }
            } else {
                if (newSrc !== stateB.src) {
                    console.log("[Seamless] MISS! Loading new src on B:", newSrc);
                    setStateB(prev => ({ ...prev, src: newSrc as string | undefined }));
                }
            }
        }, [src, activePlayerId]);

        // Native Source Management for Player A
        useEffect(() => {
            const video = videoRefA.current;
            const sourceUrl = stateA.src;

            if (!video) return;

            if (!sourceUrl) {
                if (hlsRefA.current) {
                    hlsRefA.current.destroy();
                    hlsRefA.current = null;
                }
                video.removeAttribute('src');
                video.load();
                return;
            }

            const isHls = sourceUrl.toLowerCase().includes('.m3u8');

            if (isHls && Hls.isSupported()) {
                if (hlsRefA.current) {
                    hlsRefA.current.destroy();
                }
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 60,
                });
                hlsRefA.current = hls;
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        console.error("[HLS.js] Fatal Error on Player A:", data);
                        // Trigger native error for parent to catch and fallback
                        video.dispatchEvent(new Event('error'));
                    }
                });
                console.log('[DEBUG] Player A loading HLS source:', sourceUrl.slice(0, 80));
                console.trace('[DEBUG] Player A loadSource caller');
                hls.loadSource(sourceUrl);
                hls.attachMedia(video);
                console.log(`[Seamless] Player A Source: ${sourceUrl.slice(0, 50)}... (HLS.js)`);
            } else {
                if (hlsRefA.current) {
                    hlsRefA.current.destroy();
                    hlsRefA.current = null;
                }
                console.log(`[Seamless] Player A Source: ${sourceUrl.slice(0, 50)}... (Native)`);
                video.src = sourceUrl;
            }

            // Clear extractor on source change
            if (extractorARef.current) {
                if (typeof (extractorARef.current as any).stop === 'function') {
                    extractorARef.current.stop();
                }
                extractorARef.current = null;
            }
        }, [stateA.src]);

        // Native Source Management for Player B
        useEffect(() => {
            const video = videoRefB.current;
            const sourceUrl = stateB.src;

            if (!video) return;

            if (!sourceUrl) {
                if (hlsRefB.current) {
                    hlsRefB.current.destroy();
                    hlsRefB.current = null;
                }
                video.removeAttribute('src');
                video.load();
                return;
            }

            const isHls = sourceUrl.toLowerCase().includes('.m3u8');

            if (isHls && Hls.isSupported()) {
                if (hlsRefB.current) {
                    hlsRefB.current.destroy();
                }
                const hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 60,
                });
                hlsRefB.current = hls;
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        console.error("[HLS.js] Fatal Error on Player B:", data);
                        video.dispatchEvent(new Event('error'));
                    }
                });
                hls.loadSource(sourceUrl);
                hls.attachMedia(video);
                console.log(`[Seamless] Player B Source: ${sourceUrl.slice(0, 50)}... (HLS.js)`);
            } else {
                if (hlsRefB.current) {
                    hlsRefB.current.destroy();
                    hlsRefB.current = null;
                }
                console.log(`[Seamless] Player B Source: ${sourceUrl.slice(0, 50)}... (Native)`);
                video.src = sourceUrl;
            }

            // Clear extractor on source change
            if (extractorBRef.current) {
                if (typeof (extractorBRef.current as any).stop === 'function') {
                    extractorBRef.current.stop();
                }
                extractorBRef.current = null;
            }
        }, [stateB.src]);

        // Preload Logic
        useEffect(() => {
            if (!isPreloadEnabled || !nextSrc) return;
            const targetSrc = nextSrc || undefined;

            // Load nextSrc into Inactive Player
            if (activePlayerId === 'A') {
                if (stateB.src !== targetSrc) {
                    setStateB(prev => ({ ...prev, src: targetSrc, startTime: nextStartTime }));
                }
            } else {
                if (stateA.src !== targetSrc) {
                    setStateA(prev => ({ ...prev, src: targetSrc, startTime: nextStartTime }));
                }
            }
        }, [nextSrc, nextStartTime, isPreloadEnabled, activePlayerId]);


        // single authoritative playback control
        useEffect(() => {
            const activeRef = getActiveRef();
            const inactiveRef = getInactiveRef();

            // 1. Manage Active Player
            if (activeRef.current) {
                if (isPlaying) {
                    if (activeRef.current.src && activeRef.current.readyState >= 1) {
                        const playPromise = activeRef.current.play();
                        if (playPromise !== undefined) {
                            playPromise.catch((e) => {
                                console.warn("[Seamless] Play failed:", e);
                                onDebug?.(`Play failed: ${e.message}`);
                                // Propagate to parent for Toast
                                if (props.onPlayError) props.onPlayError(e);
                            });
                        }
                    }
                } else {
                    activeRef.current.pause();
                }
            }

            // 2. STOPS Inactive Player (Dual Playback prevention)
            if (inactiveRef.current) {
                inactiveRef.current.pause();
                const inactiveId = activePlayerId === 'A' ? 'B' : 'A';
                if (inactiveId === 'A' && hlsRefA.current) {
                    hlsRefA.current.stopLoad();
                } else if (inactiveId === 'B' && hlsRefB.current) {
                    hlsRefB.current.stopLoad();
                }
            }
        }, [activePlayerId, isPlaying, stateA.src, stateB.src]); // Include sources to trigger on load

        // Reset Temp Hide when parent props update
        useEffect(() => {
            if (!props.controls && tempHideControls) {
                // If parent has acknowledged hide, we can unmask (though prop is false anyway)
                setTempHideControls(false);
            } else if (props.controls && tempHideControls) {
                // Failsafe: if parent implies controls should be ON, but we are hiding?
                // Parent logic sets false on start. So props.controls should be false eventually.
                // If props.controls stays true (e.g. parent failed), timeout resets.
                const t = setTimeout(() => setTempHideControls(false), 500);
                return () => clearTimeout(t);
            }
        }, [props.controls, tempHideControls]);



        // Proxy Ref Implementation
        const listenersRef = useRef<Map<string, Set<EventListenerOrEventListenerObject>>>(new Map());

        useEffect(() => {
            const activeVideo = getActiveRef().current;
            if (!activeVideo) return;

            // When active player changes, migrate and PING
            for (const [type, listeners] of listenersRef.current.entries()) {
                for (const listener of listeners) {
                    activeVideo.addEventListener(type, listener);

                    // Force a state sync for crucial playback listeners
                    if (['timeupdate', 'play', 'pause', 'loadedmetadata', 'waiting'].includes(type)) {
                        try {
                            // Logic: If the active video is actually playing, ping 'play'. 
                            // If it's paused, ping 'pause'.
                            const actualType = activeVideo.paused ? 'pause' : 'play';

                            // We only ping if the listener is interested in this specific state 
                            // OR if it's the catch-all 'timeupdate'
                            if (type === 'timeupdate' || type === actualType || type === 'loadedmetadata') {
                                const ev = new Event(type);
                                if (typeof listener === 'function') {
                                    listener(ev as any);
                                } else if (listener && typeof (listener as any).handleEvent === 'function') {
                                    (listener as any).handleEvent(ev as any);
                                }
                            }
                        } catch (e) {
                            console.warn(`[Seamless] Failed to ping listener ${type}:`, e);
                        }
                    }
                }
            }
        }, [activePlayerId]);

        useImperativeHandle(ref, () => {
            return new Proxy({} as HTMLVideoElement, {
                get: (_, prop) => {
                    const activeVideo = getActiveRef().current;
                    if (!activeVideo) {
                        if (['removeEventListener', 'addEventListener', 'pause', 'play'].includes(prop as string)) {
                            return () => { };
                        }
                        return undefined;
                    }

                    if (prop === 'addEventListener') {
                        return (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
                            if (!listenersRef.current.has(type)) listenersRef.current.set(type, new Set());
                            listenersRef.current.get(type)!.add(listener);
                            activeVideo.addEventListener(type, listener, options);
                        };
                    }

                    if (prop === 'removeEventListener') {
                        return (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
                            listenersRef.current.get(type)?.delete(listener);
                            activeVideo.removeEventListener(type, listener, options);
                        };
                    }

                    const value = activeVideo[prop as keyof HTMLVideoElement];
                    if (typeof value === 'function') {
                        return value.bind(activeVideo);
                    }
                    return value;
                },
                set: (_, prop, value) => {
                    const activeVideo = getActiveRef().current;
                    if (!activeVideo) return false;
                    (activeVideo as any)[prop] = value;
                    return true;
                }
            });
        });

        const activeRef = getActiveRef();

        const commonProps = {
            playsInline: true,
            'webkit-playsinline': 'true',
            preload: 'auto',
            controls: props.controls && !tempHideControls, // Override logic
            // Filter out autoplay/preload/controls/src AND custom player props from spread props to handle manually
            ...Object.fromEntries(Object.entries(props).filter(([k]) => ![
                'autoPlay', 'preload', 'src', 'controls', 'isPlaying',
                'onSubtitleChange', 'onDebug', 'onManualTracksDetected', 'manualTrackId', 'onPlayError'
            ].includes(k)))
        };

        // Event Wrappers
        // We only want to emit events from the ACTIVE player to the parent
        const createEventHandler = (paramRef: React.RefObject<HTMLVideoElement | null>, originalHandler?: React.ReactEventHandler<HTMLVideoElement>) => {
            return (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
                if (paramRef.current === getActiveRef().current) {
                    originalHandler?.(e);
                }
            };
        };

        // Subtitle Extraction Logic (Integrated)
        useEffect(() => {
            if (!onSubtitleChange) return;
            const activeVideo = getActiveRef().current;
            if (!activeVideo) return;

            const updateSubtitle = () => {
                const tracks = activeVideo.textTracks;
                if (!tracks) return;

                let hasActiveCue = false;
                let hasEnabledTrack = false;

                for (let i = 0; i < tracks.length; i++) {
                    const track = tracks[i];
                    if (track.mode === 'showing') {
                        track.mode = 'hidden';
                        hasEnabledTrack = true;
                    } else if (track.mode === 'hidden') {
                        hasEnabledTrack = true;
                    }

                    if (track.mode === 'hidden') {
                        if (track.activeCues && track.activeCues.length > 0) {
                            const activeCue = track.activeCues[0] as VTTCue;
                            onSubtitleChange?.(activeCue.text || '');
                            hasActiveCue = true;
                        }
                    }
                }

                if (!hasEnabledTrack && tracks.length > 0) {
                    tracks[0].mode = 'hidden';
                }

                if (!hasActiveCue) {
                    const activeExtractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;
                    if (activeExtractor && activeExtractor.hasSubtitles()) {
                        const manualCue = activeExtractor.getActiveCue(activeVideo.currentTime);
                        if (manualCue) {
                            onSubtitleChange?.(manualCue);
                            hasActiveCue = true;
                        }
                    }

                    if (!hasActiveCue) {
                        onSubtitleChange?.('');
                    }
                }
            };

            const checkInitManual = async () => {
                const tracks = activeVideo.textTracks;
                if (tracks && tracks.length === 0 && (activeVideo as any).readyState >= 1) {
                    const currentSrc = activeVideo.src;
                    if (!currentSrc) return;
                    const currentExtractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;
                    if (currentExtractor && (currentExtractor as any).url === currentSrc) return;

                    const extractor = new SubtitleExtractor(currentSrc, {
                        onLog: (msg) => onDebug?.(msg),
                        onTracksDetected: (tracks) => {
                            onManualTracksDetected?.(tracks);
                        }
                    });

                    if (activePlayerIdRef.current === 'A') extractorARef.current = extractor;
                    else extractorBRef.current = extractor;

                    await extractor.initialize(activeVideo.currentTime);
                }
            };

            const onAddTrack = () => updateSubtitle();
            updateSubtitle();

            activeVideo.addEventListener('timeupdate', updateSubtitle);
            if (activeVideo.textTracks) {
                activeVideo.textTracks.addEventListener('change', updateSubtitle);
                activeVideo.textTracks.addEventListener('addtrack', onAddTrack);
            }
            activeVideo.addEventListener('loadedmetadata', checkInitManual);
            const checkInterval = setInterval(checkInitManual, 2000);

            return () => {
                activeVideo.removeEventListener('timeupdate', updateSubtitle);
                activeVideo.removeEventListener('loadedmetadata', checkInitManual);
                clearInterval(checkInterval);
                if (activeVideo.textTracks) {
                    activeVideo.textTracks.removeEventListener('change', updateSubtitle);
                    activeVideo.textTracks.removeEventListener('addtrack', onAddTrack);
                }
                onSubtitleChange?.('');
            };
        }, [activePlayerId, onSubtitleChange, onManualTracksDetected]);

        useEffect(() => {
            if (manualTrackId !== undefined) {
                const extractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;
                const activeVideo = activePlayerIdRef.current === 'A' ? videoRefA.current : videoRefB.current;
                if (extractor && activeVideo) {
                    extractor.setTrack(manualTrackId, activeVideo.currentTime);
                }
            }
        }, [manualTrackId]);

        return (
            <div className={cn("relative w-full h-full bg-black overflow-hidden", className)}>
                {/* Player A */}
                <video
                    ref={videoRefA}
                    // src={stateA.src} -- Controlled by HLS management effect
                    // autoPlay handled by authoritative effect
                    className={cn(
                        "absolute inset-0 w-full h-full object-contain bg-black transition-none",
                        activePlayerId === 'A' ? "z-10" : "z-0"
                    )}
                    onTimeUpdate={createEventHandler(videoRefA, onTimeUpdate)}
                    onEnded={createEventHandler(videoRefA, onEnded)}
                    onCanPlay={(e) => {
                        // Auto-play if isPlaying is true when video becomes ready
                        if (isPlaying && activePlayerId === 'A' && e.currentTarget.paused) {
                            e.currentTarget.play().catch((err) => {
                                if (props.onPlayError) props.onPlayError(err);
                            });
                        }
                        createEventHandler(videoRefA, onCanPlay)(e);
                    }}
                    onLoadedMetadata={(e) => {
                        // Internal seek logic for preloaded video
                        if (stateA.startTime && stateA.startTime > 0) {
                            console.log(`[Seamless] Seeking A to ${stateA.startTime}`);
                            e.currentTarget.currentTime = stateA.startTime;
                        }
                        // Forward to parent
                        createEventHandler(videoRefA, onLoadedMetadata)(e);
                    }}
                    onError={createEventHandler(videoRefA, onError)}
                    onWaiting={createEventHandler(videoRefA, onWaiting)}
                    onStalled={createEventHandler(videoRefA, onStalled)}
                    onLoadStart={createEventHandler(videoRefA, onLoadStart)}
                    onPlay={createEventHandler(videoRefA, onPlay)}
                    onPause={createEventHandler(videoRefA, onPause)}
                    crossOrigin="anonymous"
                    {...(commonProps as any)}
                />

                {/* Player B */}
                <video
                    ref={videoRefB}
                    // src={stateB.src} -- Controlled by HLS management effect
                    // autoPlay handled by authoritative effect
                    className={cn(
                        "absolute inset-0 w-full h-full object-contain bg-black transition-none",
                        activePlayerId === 'B' ? "z-10" : "z-0"
                    )}
                    onTimeUpdate={createEventHandler(videoRefB, onTimeUpdate)}
                    onEnded={createEventHandler(videoRefB, onEnded)}
                    onCanPlay={(e) => {
                        // Auto-play if isPlaying is true when video becomes ready
                        if (isPlaying && activePlayerId === 'B' && e.currentTarget.paused) {
                            e.currentTarget.play().catch((err) => {
                                if (props.onPlayError) props.onPlayError(err);
                            });
                        }
                        createEventHandler(videoRefB, onCanPlay)(e);
                    }}
                    onLoadedMetadata={(e) => {
                        // Internal seek logic for preloaded video
                        if (stateB.startTime && stateB.startTime > 0) {
                            console.log(`[Seamless] Seeking B to ${stateB.startTime}`);
                            e.currentTarget.currentTime = stateB.startTime;
                        }
                        // Forward to parent
                        createEventHandler(videoRefB, onLoadedMetadata)(e);
                    }}
                    onError={createEventHandler(videoRefB, onError)}
                    onWaiting={createEventHandler(videoRefB, onWaiting)}
                    onStalled={createEventHandler(videoRefB, onStalled)}
                    onLoadStart={createEventHandler(videoRefB, onLoadStart)}
                    onPlay={createEventHandler(videoRefB, onPlay)}
                    onPause={createEventHandler(videoRefB, onPause)}
                    crossOrigin="anonymous"
                    {...(commonProps as any)}
                />

                {children}
            </div>
        );
    }
);

SeamlessVideoPlayer.displayName = 'SeamlessVideoPlayer';
