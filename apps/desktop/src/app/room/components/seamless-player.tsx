import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';

export interface SeamlessVideoPlayerProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    nextSrc?: string;
    nextStartTime?: number;
    isPreloadEnabled?: boolean;
    onSeamlessStart?: () => void;
    onSubtitleChange?: (text: string) => void;
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
        onError, onWaiting, onStalled, onLoadStart, onPlay, onPause,
        ...props }, ref) => {
        const videoRefA = useRef<HTMLVideoElement>(null);
        const videoRefB = useRef<HTMLVideoElement>(null);
        const hlsRefA = useRef<Hls | null>(null);
        const hlsRefB = useRef<Hls | null>(null);

        // Track which player is currently "Active" (visible and playing)
        const [activePlayerId, setActivePlayerId] = useState<'A' | 'B'>('A');

        // Critical: Use a Ref for the ID as well, so the Proxy can read the LATEST ID synchronously
        const activePlayerIdRef = useRef<'A' | 'B'>('A');

        // Temp Hide Controls (Fix "Flash" issue): Force hide controls internally during the swap frame
        const [tempHideControls, setTempHideControls] = useState(false);

        // Track internal src state for each player

        // Track internal src state for each player
        const [stateA, setStateA] = useState<PlayerState>({ id: 'A', src: (src as string) || undefined, isActive: true });
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
                    // This reduces the "gap" between visibility 100% and playback start.
                    videoRefB.current?.play().catch(() => { });

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
                    videoRefA.current?.play().catch(() => { });

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

        // HLS Management for Player A
        useEffect(() => {
            const video = videoRefA.current;
            const sourceUrl = stateA.src;

            if (!video) return;

            // Cleanup previous HLS instance
            if (hlsRefA.current) {
                hlsRefA.current.destroy();
                hlsRefA.current = null;
            }

            if (!sourceUrl) {
                video.removeAttribute('src');
                video.load();
                return;
            }

            // Robust HLS detection: Check both raw and decoded URL for .m3u8
            // This handles cases where the URL is wrapped in a proxy (e.g., ip/proxy?url=encoded_native)
            const isHls = sourceUrl.includes('.m3u8') || decodeURIComponent(sourceUrl).includes('.m3u8');

            console.log(`[Seamless] Player A Source: ${sourceUrl.slice(0, 50)}... | isHls: ${isHls}`);

            // Strategy: Universal hls.js first (Windows, macOS, Android). Fallback to native (iOS) only if not supported.
            if (isHls && Hls.isSupported()) {
                console.log("[Seamless] Player A using hls.js (Universal) for:", sourceUrl);
                // Add visual log for user
                if (process.env.NODE_ENV === 'development') {
                    console.log("%c[Seamless] Enforcing hls.js", "color: yellow; font-weight: bold;");
                }

                const hls = new Hls({
                    enableWorker: false,
                    lowLatencyMode: true,
                    debug: true,
                    manifestLoadingTimeOut: 10000,
                    manifestLoadingMaxRetry: 2, // Retry less to fail fast for MP4s
                    levelLoadingTimeOut: 10000,
                    fragLoadingTimeOut: 10000,
                    xhrSetup: function (xhr, url) {
                        // Some proxies might require specific headers or handling?
                        // For now just standard.
                    },
                });
                hlsRefA.current = hls;

                hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    console.log(`[Seamless] Custom HLS Manifest Parsed. Levels: ${data.levels.length}, Tracks: ${hls.subtitleTracks.length}`);
                    if (hls.subtitleTracks.length > 0) {
                        console.log("[Seamless] Subtitle tracks found:", hls.subtitleTracks);
                    } else {
                        console.warn("[Seamless] NO SUBTITLE TRACKS FOUND IN MANIFEST");
                    }
                });

                hls.on(Hls.Events.SUBTITLE_TRACK_LOADED, (event, data) => {
                    console.log(`[Seamless] Subtitle track loaded:`, data);
                });

                hls.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        console.warn(`[Seamless] HLS Fatal Error: ${data.type}`, data);
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                // Fallback for MP4s misidentified as HLS (Manifest timeout/error)
                                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                                    data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
                                    data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                    console.log(`[Seamless] Manifest load failed (${data.details}), fallback to native.`);
                                    hls.destroy();
                                    video.src = sourceUrl;
                                } else {
                                    console.log("[Seamless] fatal network error encountered, try to recover");
                                    hls.startLoad();
                                }
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.log("[Seamless] fatal media error encountered, try to recover");
                                hls.recoverMediaError();
                                break;
                            default:
                                console.log("[Seamless] fatal error, cannot recover. Fallback to native.");
                                hls.destroy();
                                video.src = sourceUrl;
                                break;
                        }
                    }
                });

                hls.loadSource(sourceUrl);
                hls.attachMedia(video);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Fallback for iOS (or if hls.js is manually disabled/not supported)
                console.log("[Seamless] Player A using native playback (iOS/Fallback) for:", sourceUrl);
                video.src = sourceUrl;
            } else {
                // Standard Playback (MP4, etc.)
                console.log("[Seamless] Player A using standard playback for:", sourceUrl);
                video.src = sourceUrl;
            }

            return () => {
                if (hlsRefA.current) {
                    hlsRefA.current.destroy();
                    hlsRefA.current = null;
                }
            };
        }, [stateA.src]);

        // HLS Management for Player B
        useEffect(() => {
            const video = videoRefB.current;
            const sourceUrl = stateB.src;

            if (!video) return;

            // Cleanup previous HLS instance
            if (hlsRefB.current) {
                hlsRefB.current.destroy();
                hlsRefB.current = null;
            }

            if (!sourceUrl) {
                video.removeAttribute('src');
                video.load();
                return;
            }

            // Robust HLS detection
            const isHls = sourceUrl.includes('.m3u8') || decodeURIComponent(sourceUrl).includes('.m3u8');
            console.log(`[Seamless] Player B Source: ${sourceUrl.slice(0, 50)}... | isHls: ${isHls}`);

            // Strategy: Universal hls.js first (Windows, macOS, Android). Fallback to native (iOS) only if not supported.
            if (isHls && Hls.isSupported()) {
                console.log("[Seamless] Player B using hls.js (Universal) for:", sourceUrl);
                if (process.env.NODE_ENV === 'development') {
                    console.log("%c[Seamless] Player B: Enforcing hls.js", "color: yellow; font-weight: bold;");
                }

                const hls = new Hls({
                    enableWorker: false,
                    lowLatencyMode: true,
                    debug: true,
                    manifestLoadingTimeOut: 10000,
                    manifestLoadingMaxRetry: 2,
                    levelLoadingTimeOut: 10000,
                    fragLoadingTimeOut: 10000,
                });
                hlsRefB.current = hls;

                hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    console.log(`[Seamless] Player B Manifest Parsed. Levels: ${data.levels.length}, Tracks: ${hls.subtitleTracks.length}`);
                    if (hls.subtitleTracks.length > 0) {
                        console.log("[Seamless] Player B Subtitle tracks found:", hls.subtitleTracks);
                    } else {
                        console.warn("[Seamless] Player B NO SUBTITLE TRACKS FOUND");
                    }
                });

                hls.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        console.warn(`[Seamless] Player B HLS Fatal Error: ${data.type}`, data);
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                // Fallback logic
                                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                                    data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
                                    data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                    console.log(`[Seamless] Player B Manifest load failed (${data.details}), fallback to native.`);
                                    hls.destroy();
                                    video.src = sourceUrl;
                                } else {
                                    console.log("[Seamless] fatal network error encountered, try to recover");
                                    hls.startLoad();
                                }
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.log("[Seamless] fatal media error encountered, try to recover");
                                hls.recoverMediaError();
                                break;
                            default:
                                console.log("[Seamless] fatal error, cannot recover. Fallback to native.");
                                hls.destroy();
                                video.src = sourceUrl;
                                break;
                        }
                    }
                });

                hls.loadSource(sourceUrl);
                hls.attachMedia(video);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Fallback for iOS
                console.log("[Seamless] Player B using native playback (iOS/Fallback) for:", sourceUrl);
                video.src = sourceUrl;
            } else {
                // Standard Playback
                console.log("[Seamless] Player B using standard playback for:", sourceUrl);
                video.src = sourceUrl;
            }

            return () => {
                if (hlsRefB.current) {
                    hlsRefB.current.destroy();
                    hlsRefB.current = null;
                }
            };
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


        // Handle Auto-Play on Swap
        useEffect(() => {
            const activeRef = getActiveRef();
            if (activeRef.current) {
                const playPromise = activeRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        // console.warn("[Seamless] Autoplay prevented:", error);
                    });
                }
            }
            // Pause inactive
            const inactiveRef = getInactiveRef();
            if (inactiveRef.current) {
                inactiveRef.current.pause();
                // REMOVED: inactiveRef.current.currentTime = 0; 
                // Resetting time here causes the "fading out" video to jump to start, creating a visual glitch.
                // The time will be reset automatically when src changes later.
            }
            // The time will be reset automatically when src changes later.
        }, [activePlayerId]);

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
        useImperativeHandle(ref, () => {
            // We return a proxy that redirects calls to the currently active video element
            return new Proxy({} as HTMLVideoElement, {
                get: (_, prop) => {
                    const activeVideo = getActiveRef().current;
                    if (!activeVideo) {
                        // Safety fallback for cleanup calls (like removeEventListener) when component is unmounting
                        if (['removeEventListener', 'addEventListener', 'pause', 'play'].includes(prop as string)) {
                            return () => { };
                        }
                        return undefined;
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
            // Filter out autoplay/preload/controls/src from spread props to handle manually
            ...Object.fromEntries(Object.entries(props).filter(([k]) => !['autoPlay', 'preload', 'src', 'controls'].includes(k)))
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
            if (!props.onSubtitleChange) return;
            const activeVideo = getActiveRef().current;
            if (!activeVideo) return;

            const updateSubtitle = () => {
                const tracks = activeVideo.textTracks;
                if (!tracks) return;

                let hasActiveCue = false;
                let hasEnabledTrack = false;

                for (let i = 0; i < tracks.length; i++) {
                    const track = tracks[i];
                    // Hijack logic: If showing, force hidden
                    if (track.mode === 'showing') {
                        track.mode = 'hidden';
                        hasEnabledTrack = true;
                    } else if (track.mode === 'hidden') {
                        hasEnabledTrack = true;
                    }

                    if (track.mode === 'hidden') {
                        if (track.activeCues && track.activeCues.length > 0) {
                            const activeCue = track.activeCues[0] as VTTCue;
                            props.onSubtitleChange?.(activeCue.text || '');
                            hasActiveCue = true;
                        }
                    }
                }

                // Force enable first track if none are enabled
                if (!hasEnabledTrack && tracks.length > 0) {
                    console.log("[Seamless] Auto-enabling first subtitle track");
                    tracks[0].mode = 'hidden';
                }

                if (!hasActiveCue) {
                    props.onSubtitleChange?.('');
                }
            };

            const onAddTrack = () => {
                console.log("[Seamless] Track added to active player");
                updateSubtitle();
            };

            // Initial check
            updateSubtitle();

            // Listeners
            activeVideo.addEventListener('timeupdate', updateSubtitle);
            // Also listen to track events
            if (activeVideo.textTracks) {
                activeVideo.textTracks.addEventListener('change', updateSubtitle);
                activeVideo.textTracks.addEventListener('addtrack', onAddTrack);
            }

            return () => {
                activeVideo.removeEventListener('timeupdate', updateSubtitle);
                if (activeVideo.textTracks) {
                    activeVideo.textTracks.removeEventListener('change', updateSubtitle);
                    activeVideo.textTracks.removeEventListener('addtrack', onAddTrack);
                }
                // Clear subtitle on swap/cleanup
                props.onSubtitleChange?.('');
            };
        }, [activePlayerId, props.onSubtitleChange]); // Re-bind when active player changes!

        return (
            <div className={cn("relative w-full h-full bg-black overflow-hidden", className)}>
                {/* Player A */}
                <video
                    ref={videoRefA}
                    // src={stateA.src} -- Controlled by HLS management effect
                    autoPlay={activePlayerId === 'A'} // Only autoplay if active
                    className={cn(
                        "absolute inset-0 w-full h-full object-contain bg-black transition-none",
                        activePlayerId === 'A' ? "z-10" : "z-0"
                    )}
                    onTimeUpdate={createEventHandler(videoRefA, onTimeUpdate)}
                    onEnded={createEventHandler(videoRefA, onEnded)}
                    onCanPlay={createEventHandler(videoRefA, onCanPlay)}
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
                    {...(commonProps as any)}
                />

                {/* Player B */}
                <video
                    ref={videoRefB}
                    // src={stateB.src} -- Controlled by HLS management effect
                    autoPlay={activePlayerId === 'B'} // Only autoplay if active
                    className={cn(
                        "absolute inset-0 w-full h-full object-contain bg-black transition-none",
                        activePlayerId === 'B' ? "z-10" : "z-0"
                    )}
                    onTimeUpdate={createEventHandler(videoRefB, onTimeUpdate)}
                    onEnded={createEventHandler(videoRefB, onEnded)}
                    onCanPlay={createEventHandler(videoRefB, onCanPlay)}
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
                    {...(commonProps as any)}
                />
            </div>
        );
    }
);

SeamlessVideoPlayer.displayName = 'SeamlessVideoPlayer';
