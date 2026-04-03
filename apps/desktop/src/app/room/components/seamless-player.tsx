import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';
import { SubtitleExtractor, SubtitleTrackInfo } from '@/utils/subtitle-extractor';
import { useTranslation } from 'react-i18next';

export interface SeamlessVideoPlayerProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    nextSrc?: string;
    nextStartTime?: number;
    isPreloadEnabled?: boolean;
    onSeamlessStart?: () => void;
    onSubtitleChange?: (text: string) => void;
    onTracksChanged?: (tracks: (SubtitleTrackInfo & { type: 'native' | 'manual' })[]) => void;
    activeTrackId?: string; // Format: "type-id" e.g., "native-0", "manual-1", "off"
    onDebug?: (msg: string) => void;
    onPlayError?: (err: any) => void;
    children?: React.ReactNode;
    isPlaying: boolean;
    currentSubtitle?: string;
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
        onTracksChanged, activeTrackId, isPlaying, children, currentSubtitle,
        ...props }, ref) => {
        const videoRefA = useRef<HTMLVideoElement>(null);
        const videoRefB = useRef<HTMLVideoElement>(null);
        const hlsRefA = useRef<Hls | null>(null);
        const hlsRefB = useRef<Hls | null>(null);

        const extractorARef = useRef<SubtitleExtractor | null>(null);
        const extractorBRef = useRef<SubtitleExtractor | null>(null);

        const [activePlayerId, setActivePlayerId] = useState<'A' | 'B'>('A');
        const activePlayerIdRef = useRef<'A' | 'B'>('A');
        const [tempHideControls, setTempHideControls] = useState(false);

        const [stateA, setStateA] = useState<PlayerState>({ id: 'A', src: undefined, isActive: true });
        const [stateB, setStateB] = useState<PlayerState>({ id: 'B', src: undefined, isActive: false });
        const { t } = useTranslation('common');

        const getLanguageName = (code?: string) => {
            if (!code) return '';
            const c = code.toLowerCase();
            const map: Record<string, string> = {
                'zh': '中文', 'chi': '中文', 'zho': '中文', 'chs': '简体中文', 'cht': '繁体中文',
                'en': '英语', 'eng': '英语',
                'ja': '日语', 'jpn': '日语',
                'ko': '韩语', 'kor': '韩语',
                'fr': '法语', 'fre': '法语', 'fra': '法语',
                'de': '德语', 'ger': '德语', 'deu': '德语',
                'es': '西班牙语', 'spa': '西班牙语',
                'ru': '俄语', 'rus': '俄语',
                'it': '意大利语', 'ita': '意大利语',
                'pt': '葡萄语', 'por': '葡萄语',
                'no': '挪威语', 'nor': '挪威语',
                'da': '丹麦语', 'dan': '丹麦语',
                'nl': '荷兰语', 'dut': '荷兰语', 'nld': '荷兰语',
                'sv': '瑞典语', 'swe': '瑞典语',
            };
            return map[c] || c.toUpperCase();
        };

        const getTrackName = (track: { label?: string, language?: string }, index: number, isManual = false) => {
            const langName = getLanguageName(track.language);
            const nativeSub = t('native_sub');
            const manualSub = t('manual_sub');
            const subShort = t('sub_short');

            const prefix = isManual 
                ? (manualSub !== 'manual_sub' ? manualSub : '外挂') 
                : (nativeSub !== 'native_sub' ? nativeSub : '内置');
            
            const trackLabel = subShort !== 'sub_short' ? subShort : '轨道';
            
            if (track.label && !track.label.toLowerCase().includes('track')) return track.label;
            
            if (langName) {
                return `${langName} (${prefix} ${index + 1})`;
            }
            return `${prefix}${trackLabel} ${index + 1}`;
        };

        const getActiveRef = () => activePlayerIdRef.current === 'A' ? videoRefA : videoRefB;
        const getInactiveRef = () => activePlayerIdRef.current === 'A' ? videoRefB : videoRefA;

        useEffect(() => {
            const activeRef = getActiveRef();
            const inactiveRef = getInactiveRef();

            if (activePlayerId === 'A') {
                if (src && src === stateB.src && src !== stateA.src) {
                    onSeamlessStart?.();
                    setTempHideControls(true);
                    if (isPlaying) {
                        videoRefB.current?.play().catch((e) => {
                            if (props.onPlayError) props.onPlayError(e);
                        });
                    }
                    setActivePlayerId('B');
                    activePlayerIdRef.current = 'B';
                    setStateB(prev => ({ ...prev, isActive: true }));
                    setStateA(prev => ({ ...prev, isActive: false }));
                    return;
                }
            } else {
                if (src && src === stateA.src && src !== stateB.src) {
                    onSeamlessStart?.();
                    setTempHideControls(true);
                    if (isPlaying) {
                        videoRefA.current?.play().catch((e) => {
                            if (props.onPlayError) props.onPlayError(e);
                        });
                    }
                    setActivePlayerId('A');
                    activePlayerIdRef.current = 'A';
                    setStateA(prev => ({ ...prev, isActive: true }));
                    setStateB(prev => ({ ...prev, isActive: false }));
                    return;
                }
            }

            const newSrc = src || undefined;
            if (!newSrc) {
                if (stateA.src) setStateA(prev => ({ ...prev, src: undefined }));
                if (stateB.src) setStateB(prev => ({ ...prev, src: undefined }));
                return;
            }

            if (activePlayerId === 'A') {
                if (newSrc !== stateA.src) {
                    setStateA(prev => ({ ...prev, src: newSrc as string | undefined }));
                }
            } else {
                if (newSrc !== stateB.src) {
                    setStateB(prev => ({ ...prev, src: newSrc as string | undefined }));
                }
            }
        }, [src, activePlayerId]);

        useEffect(() => {
            const video = videoRefA.current;
            const sourceUrl = stateA.src;
            if (!video) return;
            if (!sourceUrl) {
                if (hlsRefA.current) { hlsRefA.current.destroy(); hlsRefA.current = null; }
                video.removeAttribute('src');
                video.load();
                return;
            }
            const isHls = sourceUrl.toLowerCase().includes('.m3u8');
            if (isHls && Hls.isSupported()) {
                if (hlsRefA.current) hlsRefA.current.destroy();
                const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 60 });
                hlsRefA.current = hls;
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) video.dispatchEvent(new Event('error'));
                });
                hls.loadSource(sourceUrl);
                hls.attachMedia(video);
            } else {
                if (hlsRefA.current) { hlsRefA.current.destroy(); hlsRefA.current = null; }
                video.src = sourceUrl;
            }
            if (extractorARef.current) {
                if (typeof (extractorARef.current as any).stop === 'function') extractorARef.current.stop();
                extractorARef.current = null;
            }
        }, [stateA.src]);

        useEffect(() => {
            const video = videoRefB.current;
            const sourceUrl = stateB.src;
            if (!video) return;
            if (!sourceUrl) {
                if (hlsRefB.current) { hlsRefB.current.destroy(); hlsRefB.current = null; }
                video.removeAttribute('src');
                video.load();
                return;
            }
            const isHls = sourceUrl.toLowerCase().includes('.m3u8');
            if (isHls && Hls.isSupported()) {
                if (hlsRefB.current) hlsRefB.current.destroy();
                const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 60 });
                hlsRefB.current = hls;
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) video.dispatchEvent(new Event('error'));
                });
                hls.loadSource(sourceUrl);
                hls.attachMedia(video);
            } else {
                if (hlsRefB.current) { hlsRefB.current.destroy(); hlsRefB.current = null; }
                video.src = sourceUrl;
            }
            if (extractorBRef.current) {
                if (typeof (extractorBRef.current as any).stop === 'function') extractorBRef.current.stop();
                extractorBRef.current = null;
            }
        }, [stateB.src]);

        useEffect(() => {
            if (!isPreloadEnabled || !nextSrc) return;
            const targetSrc = nextSrc || undefined;
            if (activePlayerId === 'A') {
                if (stateB.src !== targetSrc) setStateB(prev => ({ ...prev, src: targetSrc, startTime: nextStartTime }));
            } else {
                if (stateA.src !== targetSrc) setStateA(prev => ({ ...prev, src: targetSrc, startTime: nextStartTime }));
            }
        }, [nextSrc, nextStartTime, isPreloadEnabled, activePlayerId]);

        useEffect(() => {
            const activeRef = getActiveRef();
            const inactiveRef = getInactiveRef();
            if (activeRef.current) {
                if (isPlaying) {
                    if (activeRef.current.src && activeRef.current.readyState >= 1) {
                        activeRef.current.play().catch(() => { });
                    }
                } else {
                    activeRef.current.pause();
                }
            }
            if (inactiveRef.current) {
                inactiveRef.current.pause();
                const inactiveId = activePlayerId === 'A' ? 'B' : 'A';
                if (inactiveId === 'A' && hlsRefA.current) hlsRefA.current.stopLoad();
                else if (inactiveId === 'B' && hlsRefB.current) hlsRefB.current.stopLoad();
            }
        }, [activePlayerId, isPlaying, stateA.src, stateB.src]);

        useEffect(() => {
            if (!props.controls && tempHideControls) setTempHideControls(false);
            else if (props.controls && tempHideControls) {
                const t = setTimeout(() => setTempHideControls(false), 500);
                return () => clearTimeout(t);
            }
        }, [props.controls, tempHideControls]);

        const listenersRef = useRef<Map<string, Set<EventListenerOrEventListenerObject>>>(new Map());
        useEffect(() => {
            const activeVideo = getActiveRef().current;
            if (!activeVideo) return;
            for (const [type, listeners] of listenersRef.current.entries()) {
                for (const listener of listeners) {
                    activeVideo.addEventListener(type, listener);
                }
            }
        }, [activePlayerId]);

        useImperativeHandle(ref, () => {
            return new Proxy({} as HTMLVideoElement, {
                get: (_, prop) => {
                    const activeVideo = getActiveRef().current;
                    if (!activeVideo) {
                        if (['removeEventListener', 'addEventListener', 'pause', 'play'].includes(prop as string)) return () => { };
                        return undefined;
                    }
                    if (prop === 'addEventListener') {
                        return (type: string, listener: EventListenerOrEventListenerObject, options?: any) => {
                            if (!listenersRef.current.has(type)) listenersRef.current.set(type, new Set());
                            listenersRef.current.get(type)!.add(listener);
                            activeVideo.addEventListener(type, listener, options);
                        };
                    }
                    if (prop === 'removeEventListener') {
                        return (type: string, listener: EventListenerOrEventListenerObject, options?: any) => {
                            listenersRef.current.get(type)?.delete(listener);
                            activeVideo.removeEventListener(type, listener, options);
                        };
                    }
                    const value = activeVideo[prop as keyof HTMLVideoElement];
                    return typeof value === 'function' ? value.bind(activeVideo) : value;
                },
                set: (_, prop, value) => {
                    const activeVideo = getActiveRef().current;
                    if (!activeVideo) return false;
                    (activeVideo as any)[prop] = value;
                    return true;
                }
            });
        });

        const commonProps = {
            playsInline: true,
            'webkit-playsinline': 'true',
            preload: 'auto',
            controls: props.controls && !tempHideControls,
            ...Object.fromEntries(Object.entries(props).filter(([k]) => ![
                'autoPlay', 'preload', 'src', 'controls', 'isPlaying',
                'onSubtitleChange', 'onDebug', 'onTracksChanged', 'activeTrackId', 'onPlayError', 'currentSubtitle'
            ].includes(k)))
        };

        const createEventHandler = (paramRef: React.RefObject<HTMLVideoElement | null>, originalHandler?: React.ReactEventHandler<HTMLVideoElement>) => {
            return (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
                if (paramRef.current === getActiveRef().current) originalHandler?.(e);
            };
        };

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
                    if (tracks[i].mode === 'showing') { tracks[i].mode = 'hidden'; hasEnabledTrack = true; }
                    else if (tracks[i].mode === 'hidden') hasEnabledTrack = true;
                    if (tracks[i].mode === 'hidden' && tracks[i].activeCues && tracks[i].activeCues!.length > 0) {
                        onSubtitleChange?.((tracks[i].activeCues![0] as VTTCue).text || '');
                        hasActiveCue = true;
                    }
                }
                if (!hasEnabledTrack && tracks.length > 0) tracks[0].mode = 'hidden';
                if (!hasActiveCue) {
                    const activeExtractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;
                    if (activeExtractor && activeExtractor.hasSubtitles()) {
                        const manualCue = activeExtractor.getActiveCue(activeVideo.currentTime);
                        if (manualCue) { onSubtitleChange?.(manualCue); hasActiveCue = true; }
                    }
                    if (!hasActiveCue) onSubtitleChange?.('');
                }
            };

            const checkInitManual = async () => {
                const tracks = activeVideo.textTracks;
                if (!tracks || (activeVideo as any).readyState < 1) return;

                let hasValidSubtitle = false;
                for (let i = 0; i < tracks.length; i++) {
                    if (tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') {
                        hasValidSubtitle = true;
                        break;
                    }
                }

                if (!hasValidSubtitle) {
                    const currentSrc = activeVideo.src;
                    if (!currentSrc) return;
                    const currentExtractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;
                    if (currentExtractor && (currentExtractor as any).url === currentSrc) return;
                    const extractor = new SubtitleExtractor(currentSrc, {
                        onLog: (msg) => onDebug?.(msg),
                        onTracksDetected: (manualTracks) => {
                                // Merge with native tracks
                                const nativeTracks = Array.from(activeVideo.textTracks || []).map((t, i) => ({
                                    id: i,
                                    language: t.language,
                                    name: getTrackName(t, i, false),
                                    codec: '',
                                    nb_samples: 0,
                                    type: 'native' as const
                                }));
                                onTracksChanged?.([
                                    ...nativeTracks,
                                    ...manualTracks.map((t, i) => ({ ...t, name: getTrackName(t, i, true), type: 'manual' as const }))
                                ]);
                        }
                    });
                    if (activePlayerIdRef.current === 'A') extractorARef.current = extractor;
                    else extractorBRef.current = extractor;
                    await extractor.initialize(activeVideo.currentTime);
                } else {
                    // Only native tracks found
                    const nativeTracks = Array.from(activeVideo.textTracks || []).map((t, i) => ({
                        id: i,
                        language: t.language,
                        name: getTrackName(t, i, false),
                        codec: '',
                        nb_samples: 0,
                        type: 'native' as const
                    }));
                    onTracksChanged?.(nativeTracks);
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
            const checkInterval = setInterval(checkInitManual, 3000);

            return () => {
                activeVideo.removeEventListener('timeupdate', updateSubtitle);
                activeVideo.removeEventListener('loadedmetadata', checkInitManual);
                clearInterval(checkInterval);
                if (activeVideo.textTracks) {
                    activeVideo.textTracks.removeEventListener('change', updateSubtitle);
                    activeVideo.textTracks.removeEventListener('addtrack', onAddTrack);
                }
            };
        }, [activePlayerId, onSubtitleChange]);

        useEffect(() => {
            if (!activeTrackId) return;

            const activeVideo = getActiveRef().current;
            if (!activeVideo) return;

            const [type, idStr] = activeTrackId.split('-');
            const id = parseInt(idStr);

            if (type === 'native') {
                const tracks = activeVideo.textTracks;
                if (!tracks) return;
                for (let i = 0; i < tracks.length; i++) {
                    tracks[i].mode = (i === id) ? 'hidden' : 'disabled';
                }
                // When native track is selected, disable manual extractor
                const extractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;
                if (extractor) extractor.setTrack(-1); // Assuming -1 or non-existent ID disables it
            } else if (type === 'manual') {
                // Disable all native tracks
                const tracks = activeVideo.textTracks;
                if (tracks) {
                    for (let i = 0; i < tracks.length; i++) tracks[i].mode = 'disabled';
                }
                const extractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;
                if (extractor) extractor.setTrack(id, activeVideo.currentTime);
            } else if (activeTrackId === 'off') {
                const tracks = activeVideo.textTracks;
                if (tracks) {
                    for (let i = 0; i < tracks.length; i++) tracks[i].mode = 'disabled';
                }
                const extractor = activePlayerIdRef.current === 'A' ? extractorARef.current : extractorBRef.current;
                if (extractor) extractor.setTrack(-1);
            }
        }, [activeTrackId, activePlayerId]);

        return (
            <div className={cn("relative w-full h-full bg-black overflow-hidden", className)}>
                <video
                    ref={videoRefA}
                    className={cn("absolute inset-0 w-full h-full object-contain bg-black transition-none", activePlayerId === 'A' ? "z-10" : "z-0")}
                    onTimeUpdate={createEventHandler(videoRefA, onTimeUpdate)}
                    onEnded={createEventHandler(videoRefA, onEnded)}
                    onCanPlay={(e) => {
                        if (isPlaying && activePlayerId === 'A' && e.currentTarget.paused) e.currentTarget.play().catch(() => { });
                        createEventHandler(videoRefA, onCanPlay)(e);
                    }}
                    onLoadedMetadata={(e) => {
                        if (stateA.startTime && stateA.startTime > 0) e.currentTarget.currentTime = stateA.startTime;
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
                <video
                    ref={videoRefB}
                    className={cn("absolute inset-0 w-full h-full object-contain bg-black transition-none", activePlayerId === 'B' ? "z-10" : "z-0")}
                    onTimeUpdate={createEventHandler(videoRefB, onTimeUpdate)}
                    onEnded={createEventHandler(videoRefB, onEnded)}
                    onCanPlay={(e) => {
                        if (isPlaying && activePlayerId === 'B' && e.currentTarget.paused) e.currentTarget.play().catch(() => { });
                        createEventHandler(videoRefB, onCanPlay)(e);
                    }}
                    onLoadedMetadata={(e) => {
                        if (stateB.startTime && stateB.startTime > 0) e.currentTarget.currentTime = stateB.startTime;
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
