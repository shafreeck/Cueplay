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
    children?: React.ReactNode;
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
        onError, onWaiting, onStalled, onLoadStart, onPlay, onPause, onDebug, children,
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

        // Native Source Management for Player A
        useEffect(() => {
            const video = videoRefA.current;
            const sourceUrl = stateA.src;

            if (!video) return;

            if (!sourceUrl) {
                video.removeAttribute('src');
                video.load();
                return;
            }

            console.log(`[Seamless] Player A Source: ${sourceUrl.slice(0, 50)}... (Native Only)`);
            video.src = sourceUrl;

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
                video.removeAttribute('src');
                video.load();
                return;
            }

            console.log(`[Seamless] Player B Source: ${sourceUrl.slice(0, 50)}... (Native Only)`);
            video.src = sourceUrl;

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
            // Filter out autoplay/preload/controls/src AND custom player props from spread props to handle manually
            ...Object.fromEntries(Object.entries(props).filter(([k]) => ![
                'autoPlay', 'preload', 'src', 'controls',
                'onSubtitleChange', 'onDebug', 'onManualTracksDetected', 'manualTrackId'
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
            if (!props.onSubtitleChange) return;
            const activeVideo = getActiveRef().current;
            if (!activeVideo) return;

            const updateSubtitle = () => {
                const tracks = activeVideo.textTracks;
                if (!tracks) return;

                let hasActiveCue = false;
                let hasEnabledTrack = false;

                // console.log(`[Seamless] Checking subtitles. Tracks found: ${tracks.length}`);

                // DIAGNOSTIC LOG (Throttled)
                if (Math.random() < 0.05) {
                    const vTracks = (activeVideo as any).videoTracks?.length ?? 'n/a';
                    const aTracks = (activeVideo as any).audioTracks?.length ?? 'n/a';
                    const trackLangs = Array.from(tracks).map(t => `${t.kind}:${t.language || 'unknown'}(${t.mode})`).join(', ');
                    onDebug?.(`[Sub] Check: ${tracks.length} tracks. V:${vTracks} A:${aTracks}. Details: [${trackLangs}]. RS:${activeVideo.readyState}`);
                }

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
                    // FALLBACK: If native tracks didn't find anything, try Manual Extractor
                    const activeExtractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;
                    if (activeExtractor && activeExtractor.hasSubtitles()) {
                        const manualCue = activeExtractor.getActiveCue(activeVideo.currentTime);
                        if (manualCue) {
                            props.onSubtitleChange?.(manualCue);
                            hasActiveCue = true;
                        }
                    }
                }

                if (!hasActiveCue) {
                    props.onSubtitleChange?.('');
                }
            };

            // AUTO-INIT MANUAL EXTRACTOR if native tracks are empty
            const checkInitManual = async () => {
                const tracks = activeVideo.textTracks;
                if (tracks && tracks.length === 0 && (activeVideo as any).readyState >= 1) {
                    const currentSrc = activeVideo.src;
                    if (!currentSrc) return;

                    const currentExtractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;

                    // If already initialized for this URL, skip
                    if (currentExtractor && (currentExtractor as any).url === currentSrc) return;

                    onDebug?.(`[Sub] Native tracks empty. Initializing Manual Extractor...`);

                    const extractor = new SubtitleExtractor(currentSrc, {
                        onLog: (msg) => onDebug?.(msg),
                        onTracksDetected: (tracks) => {
                            props.onManualTracksDetected?.(tracks);
                        }
                    });

                    if (activePlayerIdRef.current === 'A') extractorARef.current = extractor;
                    else extractorBRef.current = extractor;

                    await extractor.initialize(activeVideo.currentTime);

                    if (extractor.hasSubtitles()) {
                        onDebug?.(`[Sub] Manual Extractor ready with tracks!`);
                    } else {
                        onDebug?.(`[Sub] Manual Extractor found no tracks.`);
                    }
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

            // Check for manual init on metadata load or readyState change
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
                // Clear subtitle on swap/cleanup
                props.onSubtitleChange?.('');

                // Final cleanup of background extractors
                const eA = extractorARef.current as any;
                const eB = extractorBRef.current as any;
                if (eA && typeof eA.stop === 'function') eA.stop();
                if (eB && typeof eB.stop === 'function') eB.stop();
            };
        }, [activePlayerId, props.onSubtitleChange]); // Re-bind when active player changes!

        useEffect(() => {
            if (props.manualTrackId !== undefined) {
                const extractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;
                const activeVideo = activePlayerIdRef.current === 'A' ? videoRefA.current : videoRefB.current;
                if (extractor && activeVideo) {
                    extractor.setTrack(props.manualTrackId, activeVideo.currentTime);
                }
            }
        }, [props.manualTrackId]);

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
                    crossOrigin="anonymous"
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
                    crossOrigin="anonymous"
                    {...(commonProps as any)}
                />
                {children}
            </div>
        );
    }
);

SeamlessVideoPlayer.displayName = 'SeamlessVideoPlayer';
