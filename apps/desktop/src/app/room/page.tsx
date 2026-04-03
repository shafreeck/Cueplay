'use client';

import React, { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from 'react-i18next';
import { ApiClient, DriveFile } from '@/api/client';
import { WS_BASE, getProxyBase, resetProxyCache } from '@/api/config';
import { SubtitleTrackInfo } from '@/utils/subtitle-extractor';
import { LanguageToggle } from '@/components/language-toggle';
import { QuarkLoginDialog } from '@/components/quark-login-dialog';
import { ResourceLibrary } from '@/components/resource-library';
import { RoomHistory } from '@/utils/history';
import { Trash2, PlayCircle, Music, Plus, Settings, Copy, Cast, Crown, Eye, EyeOff, MessageSquare, Send, GripVertical, Link2, Unlink, ArrowLeft, FolderSearch, QrCode, ChevronDown, ChevronRight, ChevronLeft, Folder, Loader2, List, Users, MoreVertical, ArrowRight as ArrowRightIcon, Maximize, Minimize, Lock, Check, SlidersHorizontal, Menu, X, Unplug, PanelRightClose, PanelRightOpen, Play, Pause, RotateCcw, RotateCw, Palette, Type } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { PlaylistItem, ChatMessage } from './types';
import { PlaylistItemRenderer } from './components/playlist-item';
import { ChatMessageItem } from './components/chat-message-item';
import { MemberItem } from './components/member-item';
import { SeamlessVideoPlayer } from './components/seamless-player';
import { DanmakuOverlay } from './components/danmaku-overlay';

interface SortableItemProps {
    item: PlaylistItem;
    index: number;
    playingItemId: string | null;
    onPlay: (fileId: string, id: string) => void;
    onRemove: (id: string) => void;
}

function SortablePlaylistItem({ item, index, playingItemId, onPlay, onRemove }: SortableItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const { isMobile } = useIsMobile();
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        // eslint-disable-next-line
        <div ref={setNodeRef} style={style} className={`${isDragging ? 'opacity-50' : ''}`}>
            <PlaylistItemRenderer
                item={item}
                index={index}
                playingItemId={playingItemId}
                onPlay={onPlay}
                onRemove={onRemove}
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded(!isExpanded)}
                dragHandleProps={{ ...attributes, ...listeners }}
                isMobile={isMobile}
            />
        </div>
    );
}

// Mobile Wrapper for Playlist Items
function MobilePlaylistItemWrapper({ item, index, playingItemId, onPlay, onRemove, level = 0 }: {
    item: PlaylistItem,
    index: number,
    playingItemId: string | null,
    onPlay: (fid: string, id: string) => void,
    onRemove: (id: string) => void,
    level?: number
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <PlaylistItemRenderer
            item={item}
            index={index}
            playingItemId={playingItemId}
            onPlay={onPlay}
            onRemove={onRemove}
            isExpanded={expanded}
            onToggleExpand={() => setExpanded(!expanded)}
            isMobile={true}
            level={level}
        />
    );
}

import { useIsMobile } from '@/hooks/use-mobile';




function RoomContent() {
    const [currentVideoMeta, setCurrentVideoMeta] = useState<any>(null);
    const searchParams = useSearchParams();
    const router = useRouter();
    const roomId = searchParams.get('id');
    const { toast } = useToast();
    const { t, i18n } = useTranslation('common');

    // Redirect if no ID
    useEffect(() => {
        if (!roomId) {
            router.push('/');
        }
    }, [roomId, router]);


    const [logs, setLogs] = useState<string[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [ownerId, setOwnerId] = useState<string>('');
    const [controllerId, setControllerId] = useState<string | null>(null);

    const [subtitleTracks, setSubtitleTracks] = useState<(SubtitleTrackInfo & { type: 'native' | 'manual' })[]>([]);
    const [activeTrackId, setActiveTrackId] = useState<string>('off');

    const handleTracksChanged = useCallback((tracks: (SubtitleTrackInfo & { type: 'native' | 'manual' })[]) => {
        setSubtitleTracks(tracks);

        const savedLabel = localStorage.getItem('cueplay_preferred_subtitle');
        const appLang = i18n.language;

        let targetTrack: any = null;

        if (savedLabel && savedLabel !== 'off') {
            targetTrack = tracks.find(t => t.name === savedLabel);
        } else if (savedLabel === 'off') {
            setActiveTrackId('off');
            return;
        }

        if (!targetTrack && tracks.length > 0) {
            if (appLang === 'zh') {
                targetTrack = tracks.find(t =>
                    t.name.includes('中') ||
                    t.name.toLowerCase().includes('cn') ||
                    t.name.toLowerCase().includes('chinese') ||
                    t.language.toLowerCase().startsWith('zh')
                );
            } else if (appLang === 'en') {
                targetTrack = tracks.find(t =>
                    t.name.toLowerCase().includes('en') ||
                    t.name.toLowerCase().includes('english') ||
                    t.language.toLowerCase().startsWith('en')
                );
            }
        }

        if (targetTrack) {
            setActiveTrackId(`${targetTrack.type}-${targetTrack.id}`);
        }
    }, [i18n.language]);

    const handleTrackSelect = (trackId: string) => {
        setActiveTrackId(trackId);
        if (trackId === 'off') {
            localStorage.setItem('cueplay_preferred_subtitle', 'off');
        } else {
            const track = subtitleTracks.find(t => `${t.type}-${t.id}` === trackId);
            if (track) {
                localStorage.setItem('cueplay_preferred_subtitle', track.name);
            }
        }
    };
    const controllerIdRef = useRef<string | null>(null);
    const [videoSrc, setVideoSrc] = useState<string>('');
    const videoSrcRef = useRef(videoSrc);
    useEffect(() => { videoSrcRef.current = videoSrc; }, [videoSrc]);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isControllerPaused, setIsControllerPaused] = useState(false);

    // Clear controller paused state when local playback starts
    useEffect(() => {
        if (isPlaying) {
            setIsControllerPaused(false);
        }
    }, [isPlaying]);

    const [rawUrl, setRawUrl] = useState<string>('');
    const [resolutions, setResolutions] = useState<Array<{ id: string, name: string, url: string }>>([]);
    const [currentResolution, setCurrentResolution] = useState<string>('Original');
    const [duration, setDuration] = useState<number>(3600);
    const [fileId, setFileId] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [currentSubtitle, setCurrentSubtitle] = useState('');

    useEffect(() => {
        if (currentSubtitle) {
            console.log(`[UI] Subtitle updated: "${currentSubtitle}"`);
            // We can also log to the on-screen debug log
            // addLog(`[Subtitle] ${currentSubtitle}`);
        }
    }, [currentSubtitle]);
    const lastSubtitleChangeTime = useRef<number>(0);
    const MAX_SUBTITLE_DURATION = 8; // Maximum subtitle display duration in seconds
    const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
    const playlistRef = useRef(playlist);
    useEffect(() => { playlistRef.current = playlist; }, [playlist]);
    const [playingItemId, setPlayingItemId] = useState<string | null>(null);
    const playingItemIdRef = useRef<string | null>(null);
    useEffect(() => { playingItemIdRef.current = playingItemId; }, [playingItemId]);

    const fileIdRef = useRef(fileId);
    useEffect(() => { fileIdRef.current = fileId; }, [fileId]);


    // Swipe Gesture Refs
    const touchStartYRef = useRef<number | null>(null);

    // Seamless Switching State
    const isSeamlessSwitchingRef = useRef(false);
    const [nextVideoSrc, setNextVideoSrc] = useState<string>('');
    const [nextVideoId, setNextVideoId] = useState<string | null>(null);
    const [nextVideoStartTime, setNextVideoStartTime] = useState<number>(0);
    const [enablePreload, setEnablePreload] = useState(true);

    // Initialize Preload Setting
    useEffect(() => {
        const stored = localStorage.getItem('cueplay_preload');
        if (stored !== null) setEnablePreload(stored === 'true');
    }, []);

    const togglePreload = (enabled: boolean) => {
        setEnablePreload(enabled);
        localStorage.setItem('cueplay_preload', String(enabled));
    };

    const [roomCookie, setRoomCookie] = useState(''); // Shared room cookie
    const [hasGlobalCookie, setHasGlobalCookie] = useState(false);

    // Subtitle Custom Styles
    const [subtitleStyle, setSubtitleStyle] = useState({
        fontSize: 20,
        bottomOffset: 20,
        bgOpacity: 0,
        textColor: '#ffffff',
        fontWeight: 'bold',
        showBorder: false
    });

    useEffect(() => {
        const stored = localStorage.getItem('cueplay_subtitle_style');
        if (stored) {
            try {
                setSubtitleStyle(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse subtitle style", e);
            }
        }
    }, []);

    const updateSubtitleStyle = (newStyle: Partial<typeof subtitleStyle>) => {
        setSubtitleStyle(prev => {
            const updated = { ...prev, ...newStyle };
            localStorage.setItem('cueplay_subtitle_style', JSON.stringify(updated));
            return updated;
        });
    };

    const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            let id = localStorage.getItem('cueplay_userid');
            if (!id) {
                id = 'user_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('cueplay_userid', id);
            }
            return id;
        }
        return null; // Server-side
    });

    // Fallback: Ensure ID is set if hydration missed it
    useEffect(() => {
        if (!currentUserId && typeof window !== 'undefined') {
            let id = localStorage.getItem('cueplay_userid');
            if (!id) {
                id = 'user_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('cueplay_userid', id);
            }
            setCurrentUserId(id);
        }
    }, [currentUserId]);

    const [userCookie, setUserCookie] = useState('');
    const [globalAuthRequired, setGlobalAuthRequired] = useState(false);

    useEffect(() => {
        if (currentUserId) {
            ApiClient.getUserCookie(currentUserId).then(c => setUserCookie(c || '')).catch(() => { });
        }
        ApiClient.getGlobalAuthRequired().then(setGlobalAuthRequired).catch(() => { });
    }, [currentUserId]);

    // Permissions (Moved here for scope visibility)
    const canControl = !!currentUserId && controllerId === currentUserId;
    const isOwner = currentUserId && ownerId && currentUserId === ownerId;
    const [nickname, setNickname] = useState('');
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [showQuarkLogin, setShowQuarkLogin] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);

    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [isRoomLoading, setIsRoomLoading] = useState(true);
    const [roomTitle, setRoomTitle] = useState('');
    const [roomDescription, setRoomDescription] = useState('');
    const [isLocked, setIsLocked] = useState(false);
    const lastSyncedMetadata = useRef({ title: '', description: '', isLocked: false });
    const metadataInitialized = useRef(false);
    const retryCount = useRef(0); // Auto-retry counter
    const { isMobile, isLandscapeMobile } = useIsMobile();

    // UI State for Mobile/Responsive Layout
    const [activeTab, setActiveTab] = useState('playlist');
    const [isInputFocused, setIsInputFocused] = useState(false);
    const lastTapRef = useRef<number>(0);

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isSynced, setIsSynced] = useState(true);
    const [chatInput, setChatInput] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isImmersiveMode, setIsImmersiveMode] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const showControlsRef = useRef(showControls);
    useEffect(() => { showControlsRef.current = showControls; }, [showControls]);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const chatListRef = useRef<HTMLDivElement>(null);

    const socketRef = useRef<WebSocket | null>(null);
    const [reconnectTrigger, setReconnectTrigger] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isRemoteUpdate = useRef(false);
    const isLoadingSource = useRef(false);
    const lastTimeRef = useRef(0);
    const isSyncedRef = useRef(isSynced);
    const lastMinAgeRef = useRef<number>(Number.MAX_SAFE_INTEGER);
    const lastResumedItemIdRef = useRef<string | null>(null);
    const isBuffering = useRef(false);
    const lastVideoCookieRef = useRef<string>('');
    const lastVideoHeadersRef = useRef<Record<string, string>>({});
    const pendingSeekTimeRef = useRef<number | null>(null);
    const isResolvingRef = useRef<string | null>(null);

    // Danmaku Ref
    const danmakuRef = useRef<import('./components/danmaku-overlay').DanmakuOverlayHandle>(null);
    const [isDanmakuEnabled, setIsDanmakuEnabled] = useState(true);

    // Sync Ref with State
    useEffect(() => {
        isSyncedRef.current = isSynced;
        // Reset min age on sync toggle to recalibrate
        if (isSynced) lastMinAgeRef.current = Number.MAX_SAFE_INTEGER;
    }, [isSynced]);




    const styles = `
    .pb-safe {
        padding-bottom: env(safe-area-inset-bottom, 20px);
    }
    .pt-safe {
        padding-top: env(safe-area-inset-top, 0px);
    }
    `;

    const addLog = (msg: string) => setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);



    // Helper to find item in nested playlist
    const findPlaylistItem = useCallback((list: PlaylistItem[], id: string): PlaylistItem | null => {
        for (const item of list) {
            if (item.id === id) return item;
            if (item.children) {
                const found = findPlaylistItem(item.children, id);
                if (found) return found;
            }
        }
        return null;
    }, []);

    // Check proxy health
    useEffect(() => {
        const checkProxy = async () => {
            try {
                const proxyBase = await getProxyBase();
                if (!proxyBase) return;
                const resp = await fetch(`${proxyBase}/ping`);
                const text = await resp.text();
                addLog(`[Proxy] Health check: ${text} (Base: ${proxyBase})`);
            } catch (e: any) {
                addLog(`[Proxy] Health check failed: ${e.message}`);
            }
        };
        checkProxy();
    }, []);

    // Resume progress when playlist is loaded/updated or video source changes
    useEffect(() => {
        if (!playingItemId || !playlist.length || !videoRef.current || !videoSrc) return;
        if (lastResumedItemIdRef.current === playingItemId) return;

        const item = findPlaylistItem(playlist, playingItemId);

        // OPTIMISTIC RESUME (Yield on Sync):
        // We always try to resume local progress initially.
        // If a Controller is active and sending updates, the check inside verifySeek (isRemoteUpdate)
        // will identify the conflict and ABORT this resume attempt to yield to the controller.
        addLog(`[Resume Check] Attempting Optimistic Resume (Item: ${playingItemId})`);

        const video = videoRef.current;
        if (!item) return;
        // Cleanup flag
        let isCancelled = false;

        if (item.progress !== undefined) {
            const doResume = () => {
                if (isCancelled) return;
                if (lastResumedItemIdRef.current === playingItemId) return;

                const timeLeft = (item.duration || duration) - item.progress!;
                // User Feedback: specific threshold of 5s to prevent "finished" videos from resuming at the end
                if (timeLeft < 5) {
                    addLog(`[Resume] Ignored: Video near end (${timeLeft.toFixed(1)}s left). Starting from 0.`);
                    lastResumedItemIdRef.current = playingItemId;
                    return;
                }

                addLog(`[Resume] Attempting seek to ${item.progress!.toFixed(1)}s (Duration: ${item.duration})`);
                video.currentTime = item.progress!;

                // Seek confirmation loop (Retry with Yield)
                let attempts = 0;
                const verifySeek = () => {
                    if (isCancelled) return;

                    // YIELD TO SYNC:
                    // If a remote sync update occurred while we were trying to resume,
                    // we assume the Controller has taken over. Abort Resume to prevent fighting.
                    if (isRemoteUpdate.current) {
                        addLog(`[Resume] Aborted: Sync detected.`);
                        lastResumedItemIdRef.current = playingItemId;
                        return;
                    }

                    attempts++;
                    const drift = Math.abs(video.currentTime - (item.progress || 0));
                    if (drift < 2) {
                        addLog(`[Resume] Confirmed at ${video.currentTime.toFixed(1)}s`);
                        lastResumedItemIdRef.current = playingItemId;
                    } else if (attempts < 5) {
                        addLog(`[Resume] Retry ${attempts}... (Current: ${video.currentTime.toFixed(1)}s, Target: ${item.progress}s)`);
                        video.currentTime = item.progress!;
                        setTimeout(verifySeek, 800);
                    } else {
                        addLog(`[Resume] Failed after max retries.`);
                        lastResumedItemIdRef.current = playingItemId; // Give up
                    }
                };
                setTimeout(verifySeek, 800);
            };

            if (video.readyState >= 2) { // HAVE_CURRENT_DATA
                doResume();
            } else {
                const onReady = () => {
                    video.removeEventListener('canplay', onReady);
                    video.removeEventListener('loadedmetadata', onReady);
                    doResume();
                };
                video.addEventListener('canplay', onReady);
                video.addEventListener('loadedmetadata', onReady);
            }
        } else {
            addLog(`[Resume] Starting fresh (no saved progress)`);
            lastResumedItemIdRef.current = playingItemId;
        }

        return () => {
            isCancelled = true;
        };
    }, [playlist, playingItemId, videoSrc, findPlaylistItem]);


    // Load/Save Nickname
    useEffect(() => {
        const storedName = localStorage.getItem('cueplay_nickname');
        if (storedName) setNickname(storedName);
    }, []);


    const saveNickname = (val: string) => {
        setNickname(val);
        localStorage.setItem('cueplay_nickname', val);
    };

    // Debounced update for room metadata
    const updateRoomMetadata = useCallback(async (title: string, desc: string) => {
        if (!roomId || !currentUserId) return;

        // Dirty checking
        if (title === lastSyncedMetadata.current.title && desc === lastSyncedMetadata.current.description) {
            return;
        }

        try {
            await ApiClient.updateRoom(roomId, currentUserId, { title, description: desc });
            lastSyncedMetadata.current = { title, description: desc, isLocked: lastSyncedMetadata.current.isLocked };
            toast({ description: t('room_settings_saved'), duration: 1500 });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: t('failed_save_settings') });
        }
    }, [roomId, currentUserId]);

    const updateRoomCookie = (val: string) => {
        setRoomCookie(val);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'SET_ROOM_COOKIE',
                payload: { cookie: val }
            }));
        }
    };

    // Chat Scrolling
    useEffect(() => {
        if (chatListRef.current) {
            chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
        }
    }, [messages]);

    const sendChatMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || !socketRef.current) return;

        const payload = {
            id: Math.random().toString(36).slice(2),
            senderId: currentUserId!,
            senderName: nickname || currentUserId?.slice(0, 8),
            content: chatInput.trim(),
            timestamp: Date.now()
        };

        socketRef.current.send(JSON.stringify({ type: 'CHAT_MESSAGE', payload }));
        setMessages(prev => [...prev, payload]);
        setChatInput('');
        if (isDanmakuEnabled) {
            danmakuRef.current?.add(payload.content);
        }
    };

    useEffect(() => {
        // Listen for incoming messages to trigger Danmaku (Assume there's a listener somewhere or add it)
        // Looking at the code, I need to find where incoming messages are handled.
        // I can't find the socket listener in the initial read (lines 1-800).
        // I will add a separate effect to hook into messages update if I can't find the socket handler.
        // For now, let's just use the `messages` array update, BUT that might re-trigger old messages if not careful.
        // Better: Hook into the socket handler.
        // Wait, I haven't seen the socket handler code yet (it was likely further down).
        // I will read the rest of the file to find the socket handler.
    }, []);

    useEffect(() => {
        addLog(`Fullscreen Enabled: ${document.fullscreenEnabled}`);
    }, []);

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;

        if (!document.fullscreenElement) {
            container.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        const handleKeyPress = (e: KeyboardEvent) => {
            // Check if user is typing in an input or textarea
            const target = e.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            // F key to toggle fullscreen
            if (e.key === 'f' || e.key === 'F') {
                if (!isTyping && !document.fullscreenElement && videoSrc) {
                    e.preventDefault();
                    toggleFullscreen();
                }
            }

            // Space key to toggle play/pause
            if (e.key === ' ') {
                if (!isTyping && videoRef.current && videoSrc) {
                    e.preventDefault();
                    if (videoRef.current.paused) {
                        videoRef.current.play().catch(() => { });
                    } else {
                        videoRef.current.pause();
                    }
                }
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('keydown', handleKeyPress);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('keydown', handleKeyPress);
        };
    }, [videoSrc]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        // Prevent accidental text selection or other default behaviors
        e.preventDefault();
        toggleFullscreen();
    };

    // Simplified auto-hide logic:
    // 1. Hide after 3s when hovered/interacting
    // 2. Hide immediately when mouse leaves
    // 3. Mobile: Tap to toggle visibility
    // Central Gatekeeper for Control Visibility
    // Central Gatekeeper for Control Visibility
    const resetTimer = useCallback((reason: string = 'Unknown') => {
        // Explicit Seamless Suppression:
        // If we are in seamless switching mode, we block ALL auto-wakeups (playing, mousemove, etc.)
        // UNLESS the user explicitly breaks the spell (handled by clearing the ref in interaction handlers).
        if (isSeamlessSwitchingRef.current) {
            // console.log(`[Controls] Suppressed (Seamless Mode). Reason: ${reason}`);
            return;
        }

        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

        const video = videoRef.current;
        // Only auto-hide if playing AND not buffering
        if (video && !video.paused && !isBuffering.current) {
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    }, []);

    const handleContainerClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        // User Interaction explicitly breaks Seamless Mode
        isSeamlessSwitchingRef.current = false;

        // If clicking on a control element, just reset the timer and don't toggle
        const target = e.target as HTMLElement;
        if (target.closest('button, [role="button"], a, input, select, textarea')) {
            resetTimer('Click (Controls)');
            return;
        }

        if (isMobile) {
            if (showControls) {
                setShowControls(false);
                if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            } else {
                resetTimer('Mobile Toggle');
            }
        } else {
            resetTimer('Click (Container)');
        }
    }, [isMobile, showControls, resetTimer]);

    // Sync visibility with playback events and buffering state
    useEffect(() => {
        const video = videoRef.current;
        const container = containerRef.current;

        // Generic interaction (Keyboard) sets controls to visible AND breaks Seamless Mode
        const handleInteraction = (e: Event) => {
            // Filter out navigation keys in Immersive Mode to allow seamless switching
            if (isImmersiveMode) {
                const k = (e as KeyboardEvent).key;
                if (k === 'ArrowUp' || k === 'ArrowDown') return;
            }

            isSeamlessSwitchingRef.current = false;
            resetTimer('Interaction (Key)');
        };

        // MouseMove: Ignore synthetic events (0 movement) caused by layout shifts (e.g. video swap)
        const handleMouseMove = (e: MouseEvent) => {
            if (Math.abs(e.movementX) <= 1 && Math.abs(e.movementY) <= 1) return;
            resetTimer('Interaction (Mouse)');
        };

        // Consolidated video event handler to prevent race conditions
        const handleVideoEvent = (e: Event) => {
            const type = e.type;
            console.log(`[Video Event] ${type}. showControls=${showControls}`);

            // Synchronously update buffering state first
            if (type === 'waiting' || type === 'loadstart') {
                isBuffering.current = true;
                addLog(`[Buffer] ${type}...`);
            } else if (type === 'playing') {
                if (isBuffering.current) {
                    isBuffering.current = false;
                    addLog('[Buffer] Resumed playing');
                }
            } else if (type === 'pause') {
                isBuffering.current = false;
            }

            // Then check visibility logic based on new state
            // Persistence: Only wake up controls for USER events (pause) or if already visible
            if (type === 'pause') {
                resetTimer(`Event: ${type}`);
            } else {
                // For playing/waiting/loadstart, we only Reset (Keep Alive) if ALREADY visible
                if (showControls) {
                    resetTimer(`Event: ${type}`);
                }
                // If hidden, we STAY hidden (Persistence).
            }
        };

        // Bind keydown to window for general interaction reset (hiding controls)
        window.addEventListener('keydown', handleInteraction);

        // Auto-focus container when entering Immersive Mode
        if (isImmersiveMode && container) {
            container.focus();
        }

        if (container) {
            // Use mousemove for Rule 1 (3s hide after move)
            container.addEventListener('mousemove', handleMouseMove);
        }

        // Sync with video state
        if (video) {
            video.addEventListener('play', handleVideoEvent);
            video.addEventListener('pause', handleVideoEvent);
            video.addEventListener('playing', handleVideoEvent);
            video.addEventListener('waiting', handleVideoEvent);
            video.addEventListener('loadstart', handleVideoEvent);
        }

        // Initial setup: Restore persistence
        // Only wake up if already visible
        if (showControls) resetTimer('Initial (Persisted)');

        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            if (container) {
                container.removeEventListener('mousemove', handleMouseMove);
            }
            window.removeEventListener('keydown', handleInteraction);
            if (video) {
                video.removeEventListener('play', handleVideoEvent);
                video.removeEventListener('pause', handleVideoEvent);
                video.removeEventListener('playing', handleVideoEvent);
                video.removeEventListener('waiting', handleVideoEvent);
                video.removeEventListener('loadstart', handleVideoEvent);
            }
        };
    }, [resetTimer, videoSrc, isImmersiveMode, showControls]); // Re-bind when video source changes

    // Subtitle logic moved to SeamlessVideoPlayer via onSubtitleChange prop
    useEffect(() => {
        // Just handle fullscreen changes strictly related to UI mode (if any)
        const handleFullscreenChange = () => {
            // Optional logic
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [videoSrc]);



    const handleMouseEnter = () => {
        resetTimer();
    };

    const handleMouseLeave = () => {
        if (!isMobile) {
            setShowControls(false);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        }
    };

    const resolveAndPlayWithoutSync = async (fid: string, itemId?: string, explicitDriveId?: string) => {
        if (itemId) {
            lastResumedItemIdRef.current = null; // Prepare for resume
            updatePlayingItemId(itemId);
        }
        updateFileId(fid);

        try {
            // Fix: Use playlistRef.current to avoid stale state
            const item = itemId ? findPlaylistItem(playlistRef.current, itemId) : null;
            const driveId = explicitDriveId || item?.driveId;
            console.log(`[DEBUG] resolveAndPlayWithoutSync: fid=${fid}, itemId=${itemId}, explicitDriveId=${explicitDriveId}, item?.driveId=${item?.driveId}, FINAL driveId=${driveId}`);

            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
            const { source, cookie } = await ApiClient.resolveVideo(fid, roomId || '', authCode, driveId);
            lastVideoCookieRef.current = cookie;
            lastVideoHeadersRef.current = source.headers || {};
            addLog(`[ResolveSync] Source: ${JSON.stringify(source, null, 2)}`);
            setRawUrl(source.url);

            // Authoritative state update
            // Inject driveId into meta so it propagates through all heartbeats/broadcasts

            // Fallback metadata from playlist item if API result is sparse
            setCurrentVideoMeta({
                title: source.meta?.title || item?.title,
                duration: source.meta?.duration || item?.duration,
                ...source.meta,
                driveId,
                type: source.type
            });

            if (source.resolutions && Array.isArray(source.resolutions)) {
                setResolutions(source.resolutions);
                const match = source.resolutions.find((r: any) => r.url === source.url);
                setCurrentResolution(match ? match.id : 'Original');
            } else {
                setResolutions([]);
                setCurrentResolution('Original');
            }

            if (source.meta?.duration) {
                setDuration(source.meta.duration);
            }

            let finalUrl = source.url;
            if (cookie && cookie.trim()) {
                const proxyBase = await getProxyBase();
                const ua = source.headers?.['User-Agent'] || '';
                const referer = source.headers?.Referer || '';
                const extraParams = Object.entries(source.headers || {})
                    .filter(([k]) => k.toLowerCase().startsWith('x-u-'))
                    .map(([k, v]) => `&${k}=${encodeURIComponent(String(v))}`)
                    .join('');

                let proxiedUrl = `${proxyBase}/api/stream/proxy?url=${encodeURIComponent(source.url)}${extraParams}&cookie=${encodeURIComponent(cookie)}&ua=${encodeURIComponent(ua)}&referer=${encodeURIComponent(referer)}`;

                const isFinalAudio = source.type === 'audio';
                proxiedUrl += `&hint=${isFinalAudio ? 'audio' : 'video'}`;

                const title = source.meta?.title || item?.title || source.meta?.file_name;
                if (title) {
                    proxiedUrl += `&filename=${encodeURIComponent(title)}`;
                }

                finalUrl = proxiedUrl;
            } else {
                console.warn("No cookie returned from API for this video.");
            }

            // If the source is different or it's a new play, set it
            addLog(`[Sync] Final URL: ${finalUrl} (ProxyBase: ${await getProxyBase()})`);
            console.log('[DEBUG] setVideoSrc called from resolveAndPlayWithoutSync:', finalUrl.slice(0, 80));
            console.log('[DEBUG] Full proxiedUrl:', finalUrl);
            console.log('[DEBUG] source.url:', source.url);
            console.log('[DEBUG] source.type:', source.type);
            console.log('[DEBUG] source.headers:', JSON.stringify(source.headers));
            isResolvingRef.current = null; // Resolution finished
            setVideoSrc(finalUrl);
            if (itemId) {
                addLog(`Resolving synced video: ${fid} (item: ${itemId})`);
            }
        } catch (e: any) {
            console.warn("resolveAndPlayWithoutSync error:", e);
            addLog(`[Sync] Error: ${e.message}`);
            isResolvingRef.current = null; // CRITICAL: Reset lock on error so subsequent heartbeats can retry
        }
    }

    const updatePlayingItemId = (id: string | null) => {
        setPlayingItemId(id);
        playingItemIdRef.current = id;
    };

    const updateFileId = (id: string) => {
        setFileId(id);
        fileIdRef.current = id;
    };

    const resolveAndPlayMetadataOnly = async (fid: string, itemId?: string) => {
        if (itemId) updatePlayingItemId(itemId);
        updateFileId(fid);
        try {
            const item = itemId ? findPlaylistItem(playlistRef.current, itemId) : null;
            const driveId = item?.driveId;

            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
            const { source } = await ApiClient.resolveVideo(fid, roomId || '', authCode, driveId);

            // Authorized metadata update
            setCurrentVideoMeta(source.meta);

            // Update metadata UI states
            setRawUrl(source.url);
            if (source.resolutions && Array.isArray(source.resolutions)) {
                setResolutions(source.resolutions);
                const match = source.resolutions.find((r: any) => r.url === source.url);
                setCurrentResolution(match ? match.id : 'Original');
            } else {
                setResolutions([]);
                setCurrentResolution('Original');
            }
            if (source.meta?.duration) {
                setDuration(source.meta.duration);
            }
        } catch (e: any) {
            console.warn("Background metadata resolve failed", e);
            // Suppress background toast to avoid spam. Main resolution will show toast if needed.
        }
    }

    // Helper to flatten playlist for finding next item
    const getAllItems = useCallback((list: PlaylistItem[]): PlaylistItem[] => {
        let items: PlaylistItem[] = [];
        list.forEach(item => {
            items.push(item);
            if (item.children) {
                items = items.concat(getAllItems(item.children));
            }
        });
        return items;
    }, []);

    const resolveNextVideo = useCallback(async (currentId: string) => {
        if (!enablePreload) {
            setNextVideoSrc('');
            return;
        }

        const allItems = getAllItems(playlistRef.current);
        const currentIndex = allItems.findIndex(i => i.id === currentId);
        if (currentIndex === -1 || currentIndex === allItems.length - 1) {
            setNextVideoSrc('');
            return;
        }

        const nextItem = allItems[currentIndex + 1];
        if (nextItem.type !== 'file') return;

        let fid = nextItem.fileId || nextItem.id;
        // If it's a file type but id format is raw, extract it (same logic as resolveAndPlay)
        const urlMatch = fid.match(/video\/([a-zA-Z0-9]+)/);
        if (urlMatch) fid = urlMatch[1];

        try {
            console.log(`[Preload] Resolving next: ${nextItem.title || nextItem.fileId}, ID: ${fid}, Room: ${roomId}`);
            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
            const { source, cookie } = await ApiClient.resolveVideo(fid, roomId || '', authCode, nextItem.driveId);
            let nextUrl = source.url;
            if (cookie && cookie.trim()) {
                const proxyBase = await getProxyBase();
                const ua = source.headers?.['User-Agent'] || '';
                const referer = source.headers?.Referer || '';
                const extraParams = Object.entries(source.headers || {})
                    .filter(([k]) => k.toLowerCase().startsWith('x-u-'))
                    .map(([k, v]) => `&${k}=${encodeURIComponent(String(v))}`)
                    .join('');

                let proxiedUrl = `${proxyBase}/api/stream/proxy?url=${encodeURIComponent(source.url)}${extraParams}&cookie=${encodeURIComponent(cookie)}&ua=${encodeURIComponent(ua)}&referer=${encodeURIComponent(referer)}`;
                proxiedUrl += `&hint=${source.type === 'audio' ? 'audio' : 'video'}`;
                if (source.meta?.file_name || source.meta?.title) {
                    proxiedUrl += `&filename=${encodeURIComponent(source.meta.file_name || source.meta.title)}`;
                }
                nextUrl = proxiedUrl;
            }
            setNextVideoSrc(nextUrl);
            setNextVideoId(fid); // Store the ID we resolved for
            setNextVideoStartTime(nextItem.progress || 0); // Store progress for preload seeking
        } catch (e: any) {
            console.warn("[Preload] Failed:", e);
            if (e.message.includes('No authorization cookie')) {
                // Optional: Don't toast on preload failure to avoid spam? 
                // Actually, if preload fails due to auth, main playback will fail too. 
                // Better to warn early OR just let main playback handle it.
                // Let's suppress toast for preload to avoid double toasts.
                console.log("Preload auth failed, will be handled by main playback.");
            }
        }
    }, [roomId, enablePreload, getAllItems]);

    const resolveAndPlay = async (targetFileId: string, itemId?: string, explicitDriveId?: string) => {
        // Permission Check: Viewers in Sync Mode cannot change video
        if (!canControl && isSynced) {
            toast({
                title: t('view_only_title'),
                description: t('view_only_desc'),
                variant: "destructive"
            });
            return;
        }

        if (!targetFileId) return;
        let fid = targetFileId;
        const urlMatch = targetFileId.match(/video\/([a-zA-Z0-9]+)/);
        if (urlMatch) fid = urlMatch[1];

        updateFileId(fid); // Sync internal state
        retryCount.current = 0; // Reset retry counter for new video
        lastResumedItemIdRef.current = null; // Prepare for resume
        updatePlayingItemId(itemId || null); // Track playlist item
        // setVideoSrc(''); // REMOVED: Do not clear source to allow seamless transition

        // Update lastPlayedId for parent folder if applicable
        if (itemId) {
            setPlaylist(prev => prev.map(item => {
                if (item.children?.some(c => c.id === itemId)) {
                    const newPlaylist = prev.map(p => p.id === item.id ? { ...p, lastPlayedId: itemId } : p);
                    // Sync with server
                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                        socketRef.current.send(JSON.stringify({
                            type: 'PLAYLIST_UPDATE',
                            payload: { playlist: newPlaylist }
                        }));
                    }
                    return { ...item, lastPlayedId: itemId };
                }
                return item;
            }));
        }


        // SEAMLESS SWITCH CHECK:
        // If the requested video ID matches what we've already preloaded, use the CACHED URL.
        // This ensures strict string equality for the SeamlessVideoPlayer to trigger the swap.
        if (fid === nextVideoId && nextVideoSrc) {
            addLog(`[Seamless] Hit! Reusing preloaded URL for ${fid}`);
            setVideoSrc(nextVideoSrc);

            // Still resolve resolutions/meta in background to be safe/complete?
            // For now, we trust the preload. But we might miss out on resolution list updates if we skip standard resolve.
            // Let's do the standard resolve in background just to update metadata state, but not `videoSrc`.
            resolveAndPlayMetadataOnly(fid, itemId);

            // Trigger preload for *new* next item
            if (itemId) {
                resolveNextVideo(itemId);
            }
            return;
        }

        addLog(`Resolving video ${fid}...`);
        try {
            // Find item to get driveId
            const item = findPlaylistItem(playlist, itemId || '');
            const driveId = explicitDriveId || item?.driveId;

            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
            const { source, cookie } = await ApiClient.resolveVideo(fid, roomId || '', authCode, driveId);
            lastVideoCookieRef.current = cookie;
            lastVideoHeadersRef.current = source.headers || {};
            addLog(`[Resolve] Source: ${JSON.stringify(source, null, 2)}`);
            console.log("Resolve result (Full):", { source, cookieLen: cookie?.length });

            setRawUrl(source.url); // Use raw URL for sharing

            // CRITICAL: Ensure driveId is in the meta so it is broadcasted in heartbeats for newcomers
            const authoritativeMeta = { ...source.meta, driveId, type: source.type };
            setCurrentVideoMeta(authoritativeMeta);

            if (source.resolutions && Array.isArray(source.resolutions)) {
                setResolutions(source.resolutions);
                const match = source.resolutions.find((r: any) => r.url === source.url);
                setCurrentResolution(match ? match.id : 'Original');
            } else {
                setResolutions([]);
                setCurrentResolution('Original');
            }

            if (source.meta?.duration) {
                setDuration(source.meta.duration);
            }

            // Sync with others (Only if Controller)
            if (canControl && socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    type: 'MEDIA_CHANGE',
                    payload: {
                        fileId: fid,
                        url: source.url,
                        provider: 'quark',
                        meta: authoritativeMeta, // Use enriched meta
                        playingItemId: itemId || null,
                        driveId: driveId
                    }
                }));
            }

            // Local playback
            let finalUrl = source.url;
            if (cookie && cookie.trim()) {
                const proxyBase = await getProxyBase();
                const ua = source.headers?.['User-Agent'] || '';
                const referer = source.headers?.Referer || '';
                const extraParams = Object.entries(source.headers || {})
                    .filter(([k]) => k.toLowerCase().startsWith('x-u-'))
                    .map(([k, v]) => `&${k}=${encodeURIComponent(String(v))}`)
                    .join('');

                let proxiedUrl = `${proxyBase}/api/stream/proxy?url=${encodeURIComponent(source.url)}${extraParams}&cookie=${encodeURIComponent(cookie)}&ua=${encodeURIComponent(ua)}&referer=${encodeURIComponent(referer)}`;
                const isFinalAudio = source.type === 'audio';
                proxiedUrl += `&hint=${isFinalAudio ? 'audio' : 'video'}`;

                const title = source.meta?.file_name || source.meta?.title;
                if (title) {
                    proxiedUrl += `&filename=${encodeURIComponent(title)}`;
                }

                finalUrl = proxiedUrl;
                addLog(`[Resolve] Final URL ready. Type: ${source.type}, Hint: ${isFinalAudio ? 'audio' : 'video'}`);
                console.log("[Resolve] Final URL:", finalUrl);
            } else {
                console.warn("No cookie available for proxy. Playback may fail.");
                addLog("Warning: No cookie available. Please set a Global Cookie in Admin or Room Cookie in Settings.");
                toast({
                    variant: "destructive",
                    title: t('missing_cookie_title'),
                    description: t('missing_cookie_desc'),
                });
            }

            setVideoSrc(finalUrl);

            // Trigger preload for next item
            if (itemId) {
                resolveNextVideo(itemId);
            }

            addLog(`Setting Video Src: ${finalUrl.slice(0, 50)}... (Proxy: ${finalUrl.includes('127.0.0.1')})`);
        } catch (e: any) {
            console.error("Resolve failed", e);
            addLog(`[Resolve Error] ${e.message}`);
            // Auto-retry on resolve failure
            if (retryCount.current < 3) {
                retryCount.current += 1;
                addLog(`[Resolve Retry] ${retryCount.current}/3 in 2s...`);
                setTimeout(() => {
                    const item = itemId ? findPlaylistItem(playlistRef.current, itemId) : null;
                    if (fid) resolveAndPlay(fid, itemId, explicitDriveId || item?.driveId);
                }, 2000);
            }
            if (e.message.includes('No authorization cookie') || e.message.includes('system_login_required')) {
                toast({
                    variant: "destructive",
                    title: t('error_quark_login_required'),
                    description: t('error_no_cookie_configured'),
                    action: <Button variant="outline" size="sm" onClick={() => setShowQuarkLogin(true)}>{t('login')}</Button>
                });
            } else {
                toast({
                    variant: "destructive",
                    title: t('invalid_video_title'),
                    description: e.message || t('unknown_error'),
                });
            }
        }
    }

    const [isResolving, setIsResolving] = useState(false);

    // Playlist Logic
    // Playlist Logic
    const addToPlaylist = async () => {
        if (!canControl) {
            toast({
                title: t('view_only_title'),
                description: t('view_only_desc'),
                variant: "destructive"
            });
            return;
        }
        if (!inputValue || isResolving) return;
        setIsResolving(true);
        let fid = inputValue;
        const urlMatch = inputValue.match(/video\/([a-zA-Z0-9]+)/);
        if (urlMatch) fid = urlMatch[1];

        try {
            // Resolve first to validate
            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
            const { source } = await ApiClient.resolveVideo(fid, roomId || '', authCode, undefined);
            const title = source.meta?.file_name || source.meta?.title || fid;

            const newItem = { id: Math.random().toString(36).slice(2), fileId: fid, title };
            const newPlaylist = [...playlist, newItem];
            setPlaylist(newPlaylist);

            if (socketRef.current?.readyState === WebSocket.OPEN) {
                const payload = { playlist: newPlaylist };
                addLog(`Sending Playlist Update (len: ${newPlaylist.length})`);
                socketRef.current.send(JSON.stringify({
                    type: 'PLAYLIST_UPDATE',
                    payload
                }));
            } else {
                addLog("WebSocket not open, playlist sync failed.");
            }

            toast({
                title: t('added_to_queue_title'),
                description: t('added_to_queue_desc', { title })
            });
            addLog(`Added to playlist: ${fid}`);
            setInputValue(''); // Clear input only on success
        } catch (e: any) {
            console.warn(e);
            if (e.message.includes('No authorization cookie') || e.message.includes('system_login_required')) {
                toast({
                    variant: "destructive",
                    title: t('error_quark_login_required'),
                    description: t('error_no_cookie_configured'),
                    action: <Button variant="outline" size="sm" onClick={() => setShowQuarkLogin(true)}>{t('login')}</Button>
                });
            } else {
                toast({
                    variant: "destructive",
                    title: t('invalid_video_title'),
                    description: `${t('resolve_failed') || 'Could not resolve video'}: ${e.message}`
                });
            }
        } finally {
            setIsResolving(false);
        }
    };

    const removeFromPlaylist = (id: string) => {
        if (!canControl) {
            toast({
                title: t('view_only_title'),
                description: t('view_only_desc'),
                variant: "destructive"
            });
            return;
        }

        const removeById = (list: PlaylistItem[]): PlaylistItem[] => {
            return list.reduce((acc: PlaylistItem[], item) => {
                if (item.id === id) return acc;
                if (item.children) {
                    const newChildren = removeById(item.children);
                    if (newChildren.length === 0 && item.type === 'folder') {
                        // If folder becomes empty, maybe remove it too? 
                        // For now let's keep it or remove it. Better to remove it if all episodes are gone.
                        return acc;
                    }
                    return [...acc, { ...item, children: newChildren }];
                }
                return [...acc, item];
            }, []);
        };

        const newPlaylist = removeById(playlist);
        setPlaylist(newPlaylist);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'PLAYLIST_UPDATE',
                payload: { playlist: newPlaylist }
            }));

            // If list became empty, clear current video properly
            if (newPlaylist.length === 0) {
                socketRef.current.send(JSON.stringify({
                    type: 'MEDIA_CHANGE',
                    payload: { fileId: '', url: '', provider: 'quark' }
                }));
                updateFileId('');
                setRawUrl('');
                setVideoSrc('');
            }
        }
    };

    const handleAddFileFromLibrary = async (file: DriveFile) => {
        if (!canControl) {
            toast({
                title: t('view_only_title'),
                description: t('view_only_desc'),
                variant: "destructive"
            });
            return;
        }
        setIsResolving(true);
        try {
            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
            const { source } = await ApiClient.resolveVideo(file.id, roomId || '', authCode, file.driveId);
            const title = source.meta?.file_name || source.meta?.title || file.name || file.id;

            const newItem: PlaylistItem = { id: Math.random().toString(36).slice(2), fileId: file.id, title, type: 'file', driveId: file.driveId };
            const newPlaylist = [...playlist, newItem];
            setPlaylist(newPlaylist);

            if (socketRef.current?.readyState === WebSocket.OPEN) {
                const payload = { playlist: newPlaylist };
                addLog(`Sending Playlist Update (len: ${newPlaylist.length})`);
                socketRef.current.send(JSON.stringify({
                    type: 'PLAYLIST_UPDATE',
                    payload
                }));
            }
            toast({
                title: t('added_to_queue_title'),
                description: t('added_to_queue_desc', { title })
            });
            addLog(`Added from library: ${file.id}`);

            // Auto play if empty
            if (playlist.length === 0) {
                // Pass driveId explicitly because playlist state might not be updated yet
                resolveAndPlay(file.id, newItem.id, file.driveId);
            }

        } catch (e: any) {
            console.warn(e);
            if (e.message.includes('No authorization cookie') || e.message.includes('system_login_required')) {
                toast({
                    variant: "destructive",
                    title: t('error_quark_login_required'),
                    description: t('error_no_cookie_configured'),
                    action: <Button variant="outline" size="sm" onClick={() => setShowQuarkLogin(true)}>{t('login')}</Button>
                });
            } else {
                toast({
                    variant: "destructive",
                    title: t('invalid_video_title'),
                    description: `${t('resolve_failed') || 'Could not resolve video'}: ${e.message}`
                });
            }
        } finally {
            setIsResolving(false);
        }
    };

    const handleAddSeriesFromLibrary = (folder: DriveFile, files: DriveFile[]) => {
        if (!canControl) {
            toast({
                title: t('view_only_title'),
                description: t('view_only_desc'),
                variant: "destructive"
            });
            return;
        }
        const children: PlaylistItem[] = files.map(f => ({
            id: Math.random().toString(36).slice(2),
            fileId: f.id,
            title: f.name,
            type: 'file',
            driveId: f.driveId
        }));

        const newItem: PlaylistItem = {
            id: Math.random().toString(36).slice(2),
            fileId: folder.id,
            title: folder.name,
            type: 'folder',
            children
        };

        const newPlaylist = [...playlist, newItem];
        setPlaylist(newPlaylist);

        if (socketRef.current?.readyState === WebSocket.OPEN) {
            const payload = { playlist: newPlaylist };
            addLog(`Sending Playlist Update (len: ${newPlaylist.length})`);
            socketRef.current.send(JSON.stringify({
                type: 'PLAYLIST_UPDATE',
                payload
            }));
        }

        // Auto play if empty
        if (playlist.length === 0 && children.length > 0) {
            resolveAndPlay(children[0].fileId, children[0].id, children[0].driveId);
        }
    };

    const playNext = () => {
        // Viewers in Sync Mode should not auto-advance; they wait for controller
        if (!canControl && isSynced) return;

        if (playlist.length === 0) return;

        const findNext = (list: PlaylistItem[]): PlaylistItem | null => {
            for (let i = 0; i < list.length; i++) {
                const item = list[i];
                if (item.id === playingItemId) {
                    // Found current item
                    if (i + 1 < list.length) {
                        const next = list[i + 1];
                        return next.type === 'folder' && next.children?.[0] ? next.children[0] : next;
                    }
                    return null;
                }
                if (item.children) {
                    const nextInFolder = findNext(item.children);
                    if (nextInFolder === null) {
                        // Was last child of this folder
                        const isLastChild = item.children[item.children.length - 1].id === playingItemId;
                        if (isLastChild && i + 1 < list.length) {
                            const next = list[i + 1];
                            return next.type === 'folder' && next.children?.[0] ? next.children[0] : next;
                        }
                    } else {
                        return nextInFolder;
                    }
                }
            }
            return null;
        };

        const nextItem = findNext(playlist);
        if (nextItem) {
            addLog(`Auto-playing next: ${nextItem.title || nextItem.fileId}`);
            resolveAndPlay(nextItem.fileId, nextItem.id, nextItem.driveId);
        } else {
            addLog("Playlist ended.");
        }
    };


    const playPrevious = () => {
        // Viewers in Sync Mode check
        if (!canControl && isSynced) return;
        if (playlist.length === 0) return;

        const allItems = getAllItems(playlist);
        const currentIndex = allItems.findIndex(i => i.id === playingItemId);

        if (currentIndex > 0) {
            const prevItem = allItems[currentIndex - 1];
            if (prevItem.type === 'file') {
                addLog(`Auto-playing previous: ${prevItem.title || prevItem.fileId}`);
                resolveAndPlay(prevItem.fileId, prevItem.id, prevItem.driveId);
            }
        }
    };

    // Auto-play when source changes (via unified control)
    // The PLAYER_STATE handler will correctly set isPlaying once videoSrc is present.

    const sendState = useCallback(() => {
        const ws = socketRef.current;
        if (isRemoteUpdate.current || isLoadingSource.current || !videoRef.current || !ws || ws.readyState !== WebSocket.OPEN) return;

        // Enforce View Only: Only controller can broadcast state
        // Fixed: Ensure controllerIdRef.current is TRUTHY and matches currentUserId
        const isMeController = !!controllerIdRef.current && controllerIdRef.current === currentUserId;
        if (!isMeController) {
            addLog(`Blocked Sync: Controller is ${controllerIdRef.current || 'Unknown'}`);

            // Rate limited toast
            const now = Date.now();
            if (now - lastTimeRef.current > 2000) {
                toast({
                    title: t('view_only_title'),
                    description: t('view_only_desc'),
                    variant: "destructive"
                });
                lastTimeRef.current = now;
            }
            return;
        }

        const video = videoRef.current;
        addLog(`Sending State: ${video.currentTime.toFixed(1)}s`);
        ws.send(JSON.stringify({
            type: 'PLAYER_STATE',
            payload: {
                state: video.paused ? 'paused' : 'playing',
                time: video.currentTime,
                playbackRate: video.playbackRate,
                sentAt: Date.now(),
                fileId: fileIdRef.current,
                playingItemId: playingItemIdRef.current || undefined,
                meta: currentVideoMeta
            }
        }));
    }, [currentUserId, t, toast]);

    // WebSocket Synchronization
    useEffect(() => {
        const wsUrl = `${WS_BASE}/ws`;
        let userId = localStorage.getItem('cueplay_userid') || `user_${Math.random().toString(36).substring(7)}`;
        localStorage.setItem('cueplay_userid', userId);
        setCurrentUserId(userId);

        // Get latest nickname for join
        const name = localStorage.getItem('cueplay_nickname') || '';

        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        let reconnectTimer: NodeJS.Timeout | null = null;
        const triggerReconnect = () => {
            if (reconnectTimer) return;
            addLog("[WS] Reconnecting in 3s...");
            reconnectTimer = setTimeout(() => {
                setReconnectTrigger(prev => prev + 1);
            }, 3000);
        };

        ws.onopen = () => {
            const payload = { roomId: roomId || '', userId, name };
            console.log(`[WS] JOIN_ROOM. My userId: ${userId}, Name: ${name}`);
            setIsSynced(true); // Reset sync on join
            // Clear stale sources to prevent 403 from expired cookies
            setVideoSrc('');
            setNextVideoSrc('');
            setIsPlaying(false); // Ensure not playing stale source
            ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload }));
        };

        ws.onclose = () => {
            addLog("[WS] Connection closed");
            triggerReconnect();
        };

        ws.onerror = (error) => {
            addLog("[WS] Connection error");
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'error') {
                const isRoomNotFound = data.payload.msg === 'Room not found';
                const isLoginRequired = data.payload.msg === 'system_login_required';

                toast({
                    variant: "destructive",
                    title: isLoginRequired ? t('error_quark_login_required') : t('error'),
                    description: isRoomNotFound ? t('room_not_found') : (isLoginRequired ? t('error_no_cookie_configured') : data.payload.msg),
                    action: isLoginRequired ? <Button variant="outline" size="sm" onClick={() => setShowQuarkLogin(true)}>{t('login')}</Button> : undefined
                });
                if (isRoomNotFound) {
                    router.push('/');
                }
                return;
            }
            if (data.type === 'MEDIA_CHANGE') {
                const { url, fileId: remoteFileId, provider, playingItemId: remotePlayingItemId, meta } = data.payload;

                // *** CONTROLLER GUARD ***
                // If I am the controller and I already have this item playing, ignore the echo.
                // This prevents AbortError caused by double resolution/setting video source.
                // Fixed: controllerIdRef.current MUST be truthy to avoid race condition during loading.
                const amIController = !!controllerIdRef.current && controllerIdRef.current === userId;
                if (amIController && remotePlayingItemId && remotePlayingItemId === playingItemIdRef.current) {
                    addLog(`[WS] MEDIA_CHANGE ignored (already playing ${remotePlayingItemId})`);
                    return;
                }
                updateFileId(remoteFileId || '');
                setRawUrl(url || '');
                lastResumedItemIdRef.current = null; // Prepare for resume
                updatePlayingItemId(remotePlayingItemId || null);

                // OPTIMISTIC COOKIE: If the server sent a cookie with the media change (Joiner case)
                // use it immediately to avoid 403 race condition.
                if (data.payload.quarkCookie) {
                    addLog("[WS] Using optimistic Room Cookie from MEDIA_CHANGE");
                    setRoomCookie(data.payload.quarkCookie);
                }

                // Sync playlist metadata if needed (but don't set placeholder)
                if (remoteFileId) {
                    const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
                    const item = remotePlayingItemId ? findPlaylistItem(playlistRef.current, remotePlayingItemId) : null;
                    const driveId = item?.driveId;

                    // Trigger resolution for self
                    // CRITICAL: Prioritize driveId
                    const targetDriveId = data.payload.driveId || data.payload.meta?.driveId || driveId;

                    addLog(`[WS] MEDIA_CHANGE starting resolution for ${remoteFileId} (Drive: ${targetDriveId})`);

                    // Lock resolution immediately to prevent heartbeats from double-triggering
                    isResolvingRef.current = remotePlayingItemId || remoteFileId || null;
                    resolveAndPlayWithoutSync(remoteFileId, remotePlayingItemId, targetDriveId);
                }
                setCurrentSubtitle('');

            } else if (data.type === 'ROOM_UPDATE') {
                const { members, ownerId, controllerId, quarkCookie, hasGlobalCookie } = data.payload;
                const isCurrentOwner = ownerId === userId;

                setMembers(members);
                setOwnerId(ownerId);
                setControllerId(controllerId);
                controllerIdRef.current = controllerId;
                console.log(`[WS] ROOM_UPDATE. Controller: ${controllerId}, Me: ${userId}, canControl: ${controllerId === userId}`);
                if (quarkCookie !== undefined) setRoomCookie(quarkCookie);
                if (hasGlobalCookie !== undefined) setHasGlobalCookie(hasGlobalCookie);

                // Update local state if we receive room metadata
                // Owners only update on the first match (initial load) to avoid being overwritten while typing
                const shouldUpdateMetadata = !isCurrentOwner || !metadataInitialized.current;

                if (shouldUpdateMetadata) {
                    if (data.payload.title !== undefined) {
                        const t = data.payload.title || '';
                        setRoomTitle(t);
                        lastSyncedMetadata.current.title = t;
                    }

                    if (data.payload.description !== undefined) {
                        const d = data.payload.description || '';
                        setRoomDescription(d);
                        lastSyncedMetadata.current.description = d;
                    }

                    if (data.payload.isLocked !== undefined) {
                        setIsLocked(data.payload.isLocked);
                        lastSyncedMetadata.current.isLocked = data.payload.isLocked;
                    }

                    if (data.payload.title !== undefined || data.payload.description !== undefined || data.payload.isLocked !== undefined) {
                        metadataInitialized.current = true;
                    }
                }

                setIsRoomLoading(false);




                // Add to visited history
                if (roomId && ownerId) {
                    RoomHistory.addVisitedRoom({
                        id: roomId,
                        ownerId: ownerId,
                        members: members || [],
                        title: data.payload.title !== undefined ? data.payload.title : lastSyncedMetadata.current.title,
                        description: data.payload.description !== undefined ? data.payload.description : lastSyncedMetadata.current.description
                    });
                }

                // NEW: Optimistic capture of current playing state if provided in ROOM_UPDATE (Initial Join)
                if (data.payload.playingItemId && !playingItemIdRef.current) {
                    const pid = data.payload.playingItemId;
                    const item = findPlaylistItem(playlistRef.current, pid);
                }
            } else if (data.type === 'PLAYER_STATE') {
                const video = videoRef.current;
                if (!video) return;

                // Independent Mode: Viewer disabled sync
                // Fixed: controllerIdRef.current MUST be truthy to avoid race condition during loading.
                // If it's null, we wait for ROOM_UPDATE before deciding if we are a controller.
                const amIController = !!controllerIdRef.current && controllerIdRef.current === userId;

                // CRITICAL FIX: If I am the controller, I am the source of truth.
                // I must NEVER listen to PLAYER_STATE from others, or I will sync to their (paused) state.
                if (amIController) return;

                if (!amIController && !isSyncedRef.current) return;

                const { state, time, playbackRate, sentAt, fileId: remoteFileId, playingItemId: newPlayingItemId, meta: remoteMeta } = data.payload;

                // Sync controller paused state
                if (state === 'paused') {
                    setIsControllerPaused(true);
                } else if (state === 'playing') {
                    setIsControllerPaused(false);
                }

                if (remoteMeta) {
                    setCurrentVideoMeta(remoteMeta);
                }

                // 1. Auto-Switch Video / Reload Sync
                // Switch if ID changed OR if we are supposed to be playing something but videoSrc is empty (Reload/Newcomer Case)
                const isDifferentFile = (remoteFileId && remoteFileId !== fileIdRef.current);
                const isDifferentItem = (newPlayingItemId && newPlayingItemId !== playingItemIdRef.current);
                // CRITICAL: Check both state and Ref to prevent loop during render-delay, 
                // and skip if we are already resolving this specific target.
                const isSourceMissing = !videoSrcRef.current && !isResolvingRef.current;
                const isNotResolvingThis = isResolvingRef.current !== (newPlayingItemId || remoteFileId);

                if ((isDifferentFile || isDifferentItem || isSourceMissing) && isNotResolvingThis) {
                    addLog(`[WS] PLAYER_STATE triggered resolution: ${newPlayingItemId || remoteFileId}`);
                    const targetFid = remoteFileId || remoteMeta?.fileId || newPlayingItemId;
                    if (targetFid) {
                        isResolvingRef.current = newPlayingItemId || remoteFileId || null;
                        // Store the seek time so once resolved, we jump to it
                        pendingSeekTimeRef.current = time;
                        resolveAndPlayWithoutSync(targetFid, newPlayingItemId, remoteMeta?.driveId);
                    }
                    return; // Wait for resolution
                }

                // Update local playlist progress based on controller's authoritative time
                // This keeps the progress bar in the playlist UI smooth for everyone
                // This keeps the progress bar in the playlist UI smooth for everyone
                // FIX: Only update playback progress from network if it's NOT the item we are currently playing.
                // For the current item, our local video 'timeupdate' will drive the UI smoothly.
                // Overwriting it with network state (1Hz) causes "Jumping/Back-and-Forth" artifacts.
                if (playingItemIdRef.current && newPlayingItemId !== playingItemIdRef.current) {
                    setPlaylist(prev => {
                        let updated = false;
                        const update = (list: any[]): any[] => {
                            return list.map(item => {
                                if (item.id === newPlayingItemId) {
                                    updated = true;
                                    return { ...item, progress: time, duration: video.duration || item.duration };
                                }
                                if (item.children) {
                                    const newChildren = update(item.children);
                                    if (updated) return { ...item, children: newChildren };
                                }
                                return item;
                            });
                        };
                        const newList = update(prev);
                        return updated ? newList : prev;
                    });
                }

                // *** CONTROLLER GUARD ***: Controller stops here after updating UI
                // Controller should NOT sync its own playback state from the network (prevent feedback loops)
                // but we ALLOWED playlist progress update above to keep UI fresh based on echo.
                if (amIController) return;

                // Latency Compensation
                let compensatedTime = time;
                if (sentAt) {
                    const now = Date.now();
                    const age = now - sentAt;

                    // Sanity Check: If age is negative (future) or > 60s (clock skew/lag), ignore compensation
                    // This prevents "Jumping" due to bad clocks.
                    if (age >= 0 && age < 60000) {
                        // Reset if too old (> 1 min relative to min) or first time
                        if (age < lastMinAgeRef.current || lastMinAgeRef.current === Number.MAX_SAFE_INTEGER) {
                            lastMinAgeRef.current = age;
                        }
                        // Relative latency: how much older this specific message is compared to the 'fastest' message seen
                        // Plus a small constant base latency guess (50ms) to jump slightly ahead of what we received
                        const relativeLatency = (age - lastMinAgeRef.current) / 1000;
                        compensatedTime = time + relativeLatency + 0.05;
                    }
                }

                const now = video.currentTime;
                const drift = now - compensatedTime;

                isRemoteUpdate.current = true;
                // Disable Resume for this item once synced
                lastResumedItemIdRef.current = newPlayingItemId || playingItemIdRef.current;

                // 1. Hard Sync: State Mismatch or Very Large Drift (> 3.0s)
                // We use a larger threshold (3s) to avoid frequent seeking, which causes buffering/stuttering.
                // Ignore mismatch if we are buffering (we might be "paused" waiting for data while controller is playing)
                const isStateMismatch = !isBuffering.current && ((state === 'playing' && video.paused) || (state === 'paused' && !video.paused));

                // 1. Hard Sync (Seek)
                if (Math.abs(drift) > 3.0 || isStateMismatch) {
                    if (Math.abs(drift) > 3.0) {
                        addLog(`[Sync] Hard Sync: Drift=${drift.toFixed(3)}s`);
                        // Only seek if drift is actually significant (avoid jitter)
                        if (Math.abs(drift) > 0.5) {
                            video.currentTime = compensatedTime;
                        }
                    }

                    if (isStateMismatch) {
                        addLog(`[Sync] State Sync -> ${state}`);
                        setIsPlaying(state === 'playing');
                    }

                    // Reset rate on hard sync
                    if (Math.abs(video.playbackRate - playbackRate) > 0.01) {
                        video.playbackRate = playbackRate;
                    }
                }
                // 2. Soft Sync: Drift Adjustment (Tiered)
                // 2. Soft Sync: Drift Adjustment (Tiered)
                else {
                    // Always keep React state in sync with controller
                    if (isPlaying !== (state === 'playing')) {
                        setIsPlaying(state === 'playing');
                    }

                    // Soft Sync ENABLED - Adjust rate to catch up or slow down
                    // This prevents the "Sawtooth" behaviour where we drift until 3s then hard seek (Jump).
                    const baseRate = playbackRate || 1.0;
                    let targetRate = baseRate;

                    if (drift < -0.5) { // Behind by > 0.5s -> Speed up
                        // Cap at 1.1x speed boost relative to base
                        targetRate = baseRate + 0.1;
                        addLog(`[Sync] Soft Sync (Catchup): ${drift.toFixed(2)}s -> ${targetRate.toFixed(2)}x`);
                    } else if (drift > 0.5) { // Ahead by > 0.5s -> Slow down
                        // Cap at 0.9x speed relative to base
                        targetRate = Math.max(0.25, baseRate - 0.1);
                        addLog(`[Sync] Soft Sync (Slowdown): ${drift.toFixed(2)}s -> ${targetRate.toFixed(2)}x`);
                    } else {
                        // Within 0.5s -> Normal
                        targetRate = baseRate;
                    }

                    // Only apply if different
                    if (Math.abs(video.playbackRate - targetRate) > 0.01) {
                        video.playbackRate = targetRate;
                    }
                }

                // Debounce the remote update flag
                setTimeout(() => { isRemoteUpdate.current = false; }, 500);
            } else if (data.type === 'PLAYLIST_UPDATE') {
                const { playlist: newPlaylist } = data.payload;
                addLog(`Received Playlist Update: ${newPlaylist ? newPlaylist.length : 'Invalid'} items (playing: ${playingItemId})`);
                if (newPlaylist) {
                    setPlaylist(newPlaylist);
                }
            } else if (data.type === 'CHAT_MESSAGE') {
                const message = data.payload;
                setMessages(prev => {
                    if (prev.some(m => m.id === message.id)) return prev;
                    if (isDanmakuEnabled) {
                        danmakuRef.current?.add(message.content);
                    }
                    return [...prev, message];
                });
            } else if (data.type === 'MEMBER_PROGRESS') {
                const { userId, time, playingItemId: memberPlayingItemId, duration, fileId: memberFileId, meta: memberMeta, driveId: memberDriveId } = data.payload;
                // Update members list progress
                setMembers(prev => prev.map(m => m.userId === userId ? { ...m, currentProgress: time } : m));

                // Authoritative Sync from Controller
                if (memberPlayingItemId && userId === controllerIdRef.current) {
                    if (memberMeta) {
                        setCurrentVideoMeta(memberMeta);
                    }

                    // Source Sync (Mismatch or Reload)
                    const shouldResolve = (memberPlayingItemId && memberPlayingItemId !== playingItemIdRef.current) || (memberPlayingItemId && !videoSrc);
                    if (shouldResolve) {
                        if (!isRemoteUpdate.current && !isLoadingSource.current) {
                            addLog(`[Sync] (Backup) Resolving source: ${memberPlayingItemId}`);
                            const targetFid = memberFileId || memberMeta?.fileId || memberPlayingItemId;
                            const targetDriveId = memberDriveId || memberMeta?.driveId || undefined;

                            // Lock resolution for backup path too
                            isResolvingRef.current = memberPlayingItemId || targetFid || null;
                            resolveAndPlayWithoutSync(targetFid, memberPlayingItemId, targetDriveId);
                            return;
                        }
                    }
                }

                setPlaylist(prev => {
                    let updated = false;
                    const update = (list: any[]): any[] => {
                        return list.map(item => {
                            if (item.id === memberPlayingItemId) {
                                updated = true;
                                return { ...item, progress: time, duration: duration || item.duration };
                            }
                            if (item.children) {
                                const newChildren = update(item.children);
                                if (updated) return { ...item, children: newChildren };
                            }
                            return item;
                        });
                    };
                    const newList = update(prev);
                    return updated ? newList : prev;
                });
            } else if (data.type === 'MEMBER_JOINED') {
                const { member } = data.payload;
                setMembers(prev => {
                    if (prev.some(m => m.userId === member.userId)) return prev;
                    return [...prev, member];
                });
                toast({
                    title: t('member_joined'),
                    description: `${member.name} ${t('joined_room')}`,
                });
            } else if (data.type === 'MEMBER_LEFT') {
                const { userId } = data.payload;
                setMembers(prev => {
                    const leavingMember = prev.find(m => m.userId === userId);
                    if (leavingMember) {
                        toast({
                            title: t('member_left'),
                            description: `${leavingMember.name} ${t('left_room')}`,
                        });
                    }
                    return prev.filter(m => m.userId !== userId);
                });
            }
        };

        return () => {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            ws.onclose = null; // Prevent reconnection on intentional close
            ws.close();
        };
    }, [roomId, reconnectTrigger]);



    // Bind Video Events (Only if authorized to control)
    useEffect(() => {
        if (!canControl) return;

        const video = videoRef.current;
        const syncEvents = ['play', 'pause', 'seeked', 'ratechange'];
        const handleSync = (e: Event) => {
            if (!isRemoteUpdate.current && !isLoadingSource.current) {
                // Persist playback rate if changed locally
                if (e.type === 'ratechange' && videoRef.current) {
                    setPlaybackRate(videoRef.current.playbackRate);
                    addLog(`[Rate] Saved local rate: ${videoRef.current.playbackRate}`);
                }
                sendState();
            }
        };
        if (video) syncEvents.forEach(e => video.addEventListener(e, handleSync));

        return () => {
            if (video) syncEvents.forEach(e => video.removeEventListener(e, handleSync));
        };
    }, [videoSrc, sendState, canControl]);

    // Report Progress (Heartbeat) - Runs for everyone
    // Report Progress (Heartbeat) - Runs for everyone
    useEffect(() => {
        let lastProgressSent = 0;
        const interval = setInterval(() => {
            const ws = socketRef.current;
            const video = videoRef.current;
            if (ws && ws.readyState === WebSocket.OPEN && video) {
                // Only report if we have loaded a video
                if (!video.duration) return;

                const now = Date.now();

                // 1. Progress for UI (Member List) - Throttle to every 3s to reduce server-wide broadcasts
                if (now - lastProgressSent > 3000) {
                    ws.send(JSON.stringify({
                        type: 'VIDEO_PROGRESS',
                        payload: {
                            time: video.currentTime,
                            sentAt: now,
                            fileId: fileIdRef.current,
                            playingItemId: playingItemIdRef.current || undefined,
                            duration: video.duration || undefined,
                            driveId: currentVideoMeta?.driveId // Include driveId in progress too
                        }
                    }));

                    lastProgressSent = now;
                }

                // Update local member progress every 1s (independent of network throttle)
                // This drives the "User Avatar" progress on the timeline
                setMembers(prev => prev.map(m => m.userId === currentUserId ? { ...m, currentProgress: video.currentTime } : m));

                // Update local playlist progress state smoothly for EVERYONE (Controller + Viewers)
                // This ensures the sidebar progress bar updates at 60fps matches the video.
                const currentPlayingId = playingItemIdRef.current;
                if (currentPlayingId) {
                    setPlaylist(prev => {
                        let updated = false;
                        const update = (list: any[]): any[] => {
                            return list.map(item => {
                                if (item.id === currentPlayingId) {
                                    // Optimization: Don't update if diff is < 0.5s to avoid React thrashing? 
                                    // No, we want smooth UI. But maybe throttle slightly? 
                                    // Actually, React batching usually handles this fine.
                                    updated = true;
                                    return { ...item, progress: video.currentTime, duration: video.duration };
                                }
                                if (item.children) {
                                    const newChildren = update(item.children);
                                    if (updated) return { ...item, children: newChildren };
                                }
                                return item;
                            });
                        };
                        const newList = update(prev);
                        // Only return new obj if actually changed to avoid re-renders if ID not found
                        return updated ? newList : prev;
                    });
                }


                // 2. If Controller, broadcast authoritative state for Active Sync
                // We do this every 1s to maintain tight sync.
                // Fixed: Ensure controllerIdRef.current is TRUTHY and matches currentUserId
                const isMeController = !!controllerIdRef.current && controllerIdRef.current === currentUserId;

                if (isMeController) {
                    // Update local member progress to fix "Red" color (self-sync status)
                    setMembers(prev => prev.map(m => m.userId === currentUserId ? { ...m, currentProgress: video.currentTime } : m));
                    ws.send(JSON.stringify({
                        type: 'PLAYER_STATE',
                        payload: {
                            state: video.paused ? 'paused' : 'playing',
                            time: video.currentTime,
                            playbackRate: video.playbackRate,
                            sentAt: now,
                            fileId: fileIdRef.current, // Include fileId in progress heartbeats too
                            meta: currentVideoMeta // Add meta to broadcaster state
                        }
                    }));
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [currentUserId, currentVideoMeta]);



    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        if (!canControl) return;
        const { active, over } = event;

        if (active.id !== over?.id) {
            setPlaylist((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over?.id);
                const newItems = arrayMove(items, oldIndex, newIndex);

                // Sync with server if we are connected
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({
                        type: 'PLAYLIST_UPDATE',
                        payload: { playlist: newItems }
                    }));
                }
                return newItems;
            });
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        // Record Touch Start Y for swipe detection
        if (e.touches && e.touches.length > 0) {
            touchStartYRef.current = e.touches[0].clientY;
        }

        // Rule: Any touch resets activity timer
        resetTimer();

        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // Double tap detected
            e.preventDefault();
            toggleFullscreen();
            lastTapRef.current = 0; // Reset
        } else {
            lastTapRef.current = now;
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartYRef.current === null) return;

        const touchEndY = e.changedTouches[0].clientY;
        const deltaY = touchEndY - touchStartYRef.current;
        touchStartYRef.current = null; // Reset

        // Verify we are in an appropriate mode for swipes (Mobile or Immersive)
        if (!isMobile && !isImmersiveMode) return;

        const SWIPE_THRESHOLD = 50;

        // Swipe Up -> Next Video
        if (deltaY < -SWIPE_THRESHOLD) {
            addLog("[Gesture] Swipe Up Detected -> Next");
            playNext();
        }
        // Swipe Down -> Previous Video
        else if (deltaY > SWIPE_THRESHOLD) {
            addLog("[Gesture] Swipe Down Detected -> Previous");
            playPrevious();
        }
    };




    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Only trigger switch in Immersive Mode
        if (!isImmersiveMode) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            addLog("[Keyboard] Arrow Down -> Next");
            playNext();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            addLog("[Keyboard] Arrow Up -> Previous");
            playPrevious();
        }
    };

    const changeResolution = async (res: { id: string, name: string, url: string }) => {
        if (res.id === currentResolution) return;

        const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
        pendingSeekTimeRef.current = currentTime;

        // Optimistic update
        setCurrentResolution(res.id);

        let finalUrl = res.url;
        try {
            if (lastVideoCookieRef.current && lastVideoCookieRef.current.trim()) {
                const proxyBase = await getProxyBase();
                const ua = lastVideoHeadersRef.current?.['User-Agent'] || '';
                const referer = lastVideoHeadersRef.current?.Referer || '';
                const extraParams = Object.entries(lastVideoHeadersRef.current || {})
                    .filter(([k]) => k.toLowerCase().startsWith('x-u-'))
                    .map(([k, v]) => `&${k}=${encodeURIComponent(String(v))}`)
                    .join('');

                let proxiedUrl = `${proxyBase}/api/stream/proxy?url=${encodeURIComponent(res.url)}${extraParams}&cookie=${encodeURIComponent(lastVideoCookieRef.current)}&ua=${encodeURIComponent(ua)}&referer=${encodeURIComponent(referer)}`;
                proxiedUrl += `&hint=video`;
                if (currentVideoMeta?.title || currentVideoMeta?.file_name) {
                    proxiedUrl += `&filename=${encodeURIComponent(currentVideoMeta.title || currentVideoMeta.file_name)}`;
                }
                finalUrl = proxiedUrl;
            }
        } catch (e) {
            console.error("Failed to get proxy base", e);
        }

        addLog(`[Resolution] Switching to ${res.name} (${currentTime.toFixed(1)}s)`);
        setVideoSrc(finalUrl);
    };

    const getResolutionLabel = useCallback((name: string) => {
        if (name === 'Original') return t('original_quality');
        const key = `res_${name.toLowerCase()}`;
        const translated = t(key);
        return translated === key ? name : translated;
    }, [t]);




    return (
        <div className="h-[100dvh] md:min-h-screen flex flex-col bg-black md:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] md:from-indigo-900/20 md:via-background md:to-background text-foreground overflow-hidden md:overflow-auto">
            <style>{styles}</style>



            {/* Header */}
            <header className={cn(
                "sticky top-0 md:top-8 z-50 px-0 md:px-4 mb-0 md:mb-6 transition-all duration-300 pt-safe md:pt-0 md:mt-8",
                ((isImmersiveMode || isFullscreen) || isLandscapeMobile) ? "-translate-y-24 opacity-0 pointer-events-none" : "translate-y-0 opacity-100 pointer-events-auto"
            )}>
                <div data-tauri-drag-region className="container mx-auto h-14 md:h-16 md:rounded-full flex items-center justify-between gap-2 md:gap-4 px-3 md:px-6 bg-black md:bg-black/40 backdrop-blur-2xl border-b md:border border-white/5 shadow-2xl pointer-events-auto select-none">
                    <div className="flex items-center gap-2 overflow-hidden shrink-0">
                        <Link href="/">
                            <Button variant="ghost" size="sm" className="h-8 w-auto px-2 md:px-3">
                                <ArrowLeft className="h-4 w-4 md:mr-1" />
                                <span className="hidden sm:inline">{t('rooms')}</span>
                            </Button>
                        </Link>
                        <h1
                            className="text-sm md:text-xl font-bold truncate cursor-pointer hover:text-primary transition-colors active:opacity-50"
                            onClick={() => {
                                navigator.clipboard.writeText(roomId || '');
                                toast({ description: t('room_id_copied') });
                            }}
                            title={t('click_to_copy')}
                        >
                            {isMobile ? roomId : t('room_title', { id: roomId })}
                        </h1>
                        <div
                            className={`flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-full text-xs font-bold border transition-all duration-300 outline-none focus:ring-2 focus:ring-primary/50 ${canControl
                                ? 'bg-primary/50 text-white border-primary/50 shadow-[0_0_15px_rgba(124,58,237,0.25)] cursor-default'
                                : 'bg-muted/50 text-muted-foreground border-white/10 hover:bg-muted hover:text-foreground cursor-pointer'
                                }`}
                            tabIndex={0}
                            role="button"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (canControl) return;

                                    if (isLocked && !isOwner) {
                                        toast({
                                            title: t('control_locked'),
                                            description: t('control_locked_desc'),
                                            variant: "destructive"
                                        });
                                        return;
                                    }

                                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                                        socketRef.current.send(JSON.stringify({ type: 'TAKE_CONTROL', payload: { roomId: roomId || '' } }));
                                        toast({ title: t('control_requested_title'), description: t('control_requested_desc') });
                                    }
                                }
                            }}
                            onClick={() => {
                                if (canControl) return;

                                if (isLocked && !isOwner) {
                                    toast({
                                        title: t('control_locked'),
                                        description: t('control_locked_desc'),
                                        variant: "destructive"
                                    });
                                    return;
                                }

                                if (socketRef.current?.readyState === WebSocket.OPEN) {
                                    socketRef.current.send(JSON.stringify({ type: 'TAKE_CONTROL', payload: { roomId: roomId || '' } }));
                                    toast({ title: t('control_requested_title'), description: t('control_requested_desc') });
                                }
                            }}
                            title={!canControl ? t('click_to_take_control') : t('you_have_control')}
                        >
                            {canControl ? (
                                <>
                                    <Cast className="h-3.5 w-3.5" />
                                    <span className="hidden md:inline">{t('controlling')}</span>
                                </>
                            ) : isLocked && !isOwner ? (
                                <>
                                    <Lock className="h-3.5 w-3.5" />
                                    <span className="hidden md:inline">{t('locked')}</span>
                                </>
                            ) : (
                                <>
                                    <Eye className="h-3.5 w-3.5" />
                                    <span className="hidden md:inline">{t('viewing')}</span>
                                </>
                            )}
                        </div>

                        {!canControl && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 transition-colors ${isSynced ? 'text-primary' : 'text-muted-foreground'}`}
                                onClick={() => {
                                    const newState = !isSynced;
                                    setIsSynced(newState);
                                    toast({
                                        title: newState ? t('sync_enabled_title') : t('sync_disabled_title'),
                                        description: newState ? t('sync_enabled_desc') : t('sync_disabled_desc')
                                    });
                                }}
                                title={isSynced ? t('unlink_play_independently') : t('link_sync_with_room')}
                            >
                                {isSynced ? <Link2 className="h-4 w-4" /> : <Unlink className="h-4 w-4" />}
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-1 max-w-2xl justify-end">
                        {/* Immersive Mode Toggle (Enter) */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsImmersiveMode(true)}
                            className="flex h-8 w-8 text-muted-foreground hover:text-foreground rounded-full hover:bg-white/10"
                            title={t('enter_immersive_mode')}
                        >
                            <Maximize className="w-5 h-5" />
                        </Button>
                        <div className="h-4 w-px bg-white/10 mx-1 md:mx-2" />

                        {/* Resource Library Trigger */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsLibraryOpen(true)}
                            className="flex h-8 w-8 text-muted-foreground hover:text-foreground rounded-full hover:bg-white/10"
                            title={t('resource_library')}
                        >
                            <FolderSearch className="w-5 h-5" />
                        </Button>
                        <div className="h-4 w-px bg-white/10 mx-1 md:mx-2" />

                        {isLandscapeMobile ? (
                            <div className="flex items-center gap-2">
                                <LanguageToggle />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setIsDrawerOpen(true);
                                        setActiveTab('settings');
                                    }}
                                >
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <LanguageToggle />
                                <div className="h-4 w-px bg-white/10 mx-1" />
                                <Popover onOpenChange={(open) => {
                                    if (!open && isOwner) {
                                        updateRoomMetadata(roomTitle, roomDescription);
                                    }
                                }}>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <Settings className="h-5 w-5" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                        <div className="grid gap-4">
                                            <div className="space-y-2">
                                                <h4 className="font-medium leading-none">{t('settings')}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    {t('configure_playback')}
                                                </p>
                                            </div>
                                            <div className="grid gap-2">
                                                <div className="space-y-4">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="room-title">{t('room_name')}</Label>
                                                        <Input
                                                            id="room-title"
                                                            value={roomTitle}
                                                            onChange={(e) => {
                                                                if (isOwner) setRoomTitle(e.target.value);
                                                            }}
                                                            placeholder={t('enter_room_name')}
                                                            className="h-8"
                                                            disabled={!isOwner}
                                                        />
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="room-desc">{t('room_description')}</Label>
                                                        <Input
                                                            id="room-desc"
                                                            value={roomDescription}
                                                            onChange={(e) => {
                                                                if (isOwner) setRoomDescription(e.target.value);
                                                            }}
                                                            placeholder={t('enter_room_description')}
                                                            className="h-8"
                                                            disabled={!isOwner}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                                        <div className="space-y-0.5">
                                                            <Label className="text-sm font-medium">
                                                                {t('lock_control')}
                                                            </Label>
                                                            <div className="text-[10px] text-muted-foreground">
                                                                {t('lock_control_desc')}
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            checked={isLocked}
                                                            onCheckedChange={(checked) => {
                                                                if (!isOwner) return;
                                                                setIsLocked(checked);
                                                                if (socketRef.current?.readyState === WebSocket.OPEN) {
                                                                    socketRef.current.send(JSON.stringify({
                                                                        type: 'UPDATE_ROOM',
                                                                        payload: { isLocked: checked }
                                                                    }));
                                                                }
                                                            }}
                                                            disabled={!isOwner}
                                                        />
                                                    </div>

                                                    <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                                        <div className="space-y-0.5">
                                                            <Label className="text-sm font-medium">
                                                                {t('smart_preload')}
                                                            </Label>
                                                            <div className="text-[10px] text-muted-foreground">
                                                                {t('smart_preload_desc')}
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            checked={enablePreload}
                                                            onCheckedChange={togglePreload}
                                                        />
                                                    </div>
                                                </div>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" className="w-full mt-2">{t('view_debug_logs')}</Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl h-[500px] flex flex-col">
                                                        <DialogHeader>
                                                            <DialogTitle>{t('view_debug_logs')}</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 font-mono text-xs rounded-md border">
                                                            {logs.map((log, i) => (
                                                                <div key={i} className="text-emerald-400 border-b border-white/5 pb-1 mb-1">
                                                                    {log}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            <main className={cn(
                "flex-1 grid gap-6 p-4 md:p-6 min-h-0 overflow-hidden relative",
                (isImmersiveMode || isLandscapeMobile) ? "md:grid-cols-1 md:max-w-none md:p-0 items-center justify-center" : (isSidebarOpen ? "md:grid-cols-4" : "md:grid-cols-1")
            )}>
                {/* Video Section */}
                <div className={cn(
                    "space-y-4 shrink-0 z-10 w-full transition-all duration-300 ease-in-out",
                    isImmersiveMode || !isSidebarOpen ? "md:col-span-1 group/video" : "md:col-span-3 group/video"
                )}>
                    <div
                        ref={containerRef}
                        className={cn(
                            "bg-black overflow-hidden shadow-xl group transition-all duration-500 ease-in-out touch-manipulation",
                            (isImmersiveMode || isLandscapeMobile)
                                ? "fixed inset-0 z-10 w-screen h-screen rounded-none outline-none"
                                : "relative w-full aspect-video md:rounded-xl md:shadow-2xl md:border border-white/10 ring-0 md:ring-1 ring-white/5 outline-none"
                        )}
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setShowControls(true)}
                        onTouchStart={handleTouchStart}
                        onMouseLeave={handleMouseLeave}
                        onDoubleClick={handleDoubleClick}
                        onClick={handleContainerClick}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* Landscape Mobile Top Overlay */}
                        {isLandscapeMobile && (
                            <div className={cn(
                                "absolute top-0 left-0 right-0 px-8 pt-4 pt-safe flex items-start justify-between z-[60] bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 pointer-events-none",
                                showControls ? "opacity-100" : "opacity-0"
                            )}>
                                <div className="flex items-center gap-3 pointer-events-auto">
                                    <Link href="/">
                                        <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-white/10 rounded-full">
                                            <ArrowLeft className="h-6 w-6" />
                                        </Button>
                                    </Link>
                                    <h1 className="text-sm font-medium text-white shadow-black drop-shadow-md truncate max-w-[200px]" onClick={() => {
                                        navigator.clipboard.writeText(roomId || '');
                                        toast({ description: t('room_id_copied') });
                                    }}>
                                        {roomTitle || t('room_title', { id: roomId })}
                                    </h1>
                                </div>

                                <div className="flex items-center gap-2 pointer-events-auto">

                                    {/* Controller Paused Indicator */}
                                    {isControllerPaused && !isPlaying && (
                                        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                            <Pause className="w-4 h-4 text-white/70 fill-white/70" />
                                            <span className="text-sm font-medium text-white/90">Host paused</span>
                                        </div>
                                    )}

                                    {/* Meta/Controls Container (Bottom) */}
                                    <div
                                        className={`flex items-center justify-center h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 outline-none focus:ring-2 focus:ring-primary/50 ${canControl
                                            ? 'text-primary border-primary/50 shadow-[0_0_10px_rgba(124,58,237,0.3)]'
                                            : 'text-white/70'
                                            }`}
                                        tabIndex={0}
                                        role="button"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (canControl) return;
                                                if (socketRef.current?.readyState === WebSocket.OPEN) {
                                                    socketRef.current.send(JSON.stringify({ type: 'TAKE_CONTROL', payload: { roomId: roomId || '' } }));
                                                    toast({ title: t('control_requested_title'), description: t('control_requested_desc') });
                                                }
                                            }
                                        }}
                                        onClick={(e) => {
                                            if (canControl) return;
                                            if (socketRef.current?.readyState === WebSocket.OPEN) {
                                                socketRef.current.send(JSON.stringify({ type: 'TAKE_CONTROL', payload: { roomId: roomId || '' } }));
                                                toast({ title: t('control_requested_title'), description: t('control_requested_desc') });
                                            }
                                        }}
                                        onFocus={() => setShowControls(true)}
                                    >
                                        {canControl ? <Cast className="h-5 w-5" /> : (isLocked ? <Lock className="h-5 w-5" /> : <Eye className="h-5 w-5" />)}
                                    </div>

                                    {/* Resource Library Trigger */}
                                    <div
                                        className="flex items-center justify-center h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-primary hover:border-primary/50 hover:shadow-[0_0_10px_rgba(124,58,237,0.3)] transition-all cursor-pointer outline-none focus:ring-2 focus:ring-primary/50"
                                        onClick={() => setIsLibraryOpen(true)}
                                        tabIndex={0}
                                        role="button"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') setIsLibraryOpen(true);
                                        }}
                                        onFocus={() => setShowControls(true)}
                                        title={t('resource_library')}
                                    >
                                        <FolderSearch className="h-5 w-5" />
                                    </div>

                                    {/* Settings / Menu */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            setIsDrawerOpen(true);
                                            setActiveTab('settings');
                                        }}
                                        className="h-10 w-10 text-white hover:bg-white/10 rounded-full bg-black/40 backdrop-blur-md border border-white/10"
                                    >
                                        <Settings className="h-6 w-6" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Exit Immersive Mode / Sidebar Trigger Floating Buttons */}
                        <div className={cn(
                            "fixed pt-safe right-8 z-20 flex flex-col gap-3 transition-all duration-500",
                            isLandscapeMobile ? "top-20" : "top-14",
                            (isImmersiveMode || isLandscapeMobile) && showControls ? "translate-y-0 opacity-100" : "-translate-y-24 opacity-0 pointer-events-none"
                        )}>
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={() => {
                                    if (isImmersiveMode) setIsImmersiveMode(false);
                                }}
                                className={cn(
                                    "h-10 w-10 rounded-full shadow-2xl bg-black/50 backdrop-blur-xl border border-white/10 hover:bg-black/70 text-white",
                                    isLandscapeMobile && !isImmersiveMode ? "hidden" : ""
                                )}
                                title={t('exit_immersive_mode')}
                            >
                                <Minimize className="w-5 h-5" />
                            </Button>

                            {/* Open Sidebar/Drawer in Landscape Mobile - REMOVED per user feedback (only use header button) */}
                        </div>
                        {videoSrc ? (
                            <div className="contents">
                                <SeamlessVideoPlayer
                                    ref={videoRef}
                                    controls={showControls}
                                    onSeamlessStart={() => {
                                        console.log("[Player] Seamless start. Hiding controls and locking.");
                                        isSeamlessSwitchingRef.current = true;
                                        setShowControls(false);
                                    }}
                                    children={
                                        <>
                                            {/* Controller Paused Overlay for Video */}
                                            {isControllerPaused && !isPlaying && (
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                                                    <div className="bg-zinc-900/90 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 flex items-center gap-3 shadow-2xl animate-in fade-in zoom-in duration-300">
                                                        <Pause className="w-5 h-5 text-amber-500 fill-amber-500" />
                                                        <span className="text-base font-bold text-white tracking-wide">{t('host_paused')}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    }
                                    onTimeUpdate={() => {
                                        // Optional: any top-level time sync logic
                                    }}
                                    onEnded={() => {
                                        console.log("Video ended, auto-advancing...");
                                        playNext();
                                    }}
                                    onPlay={() => {
                                        setIsRoomLoading(false);
                                        setIsPlaying(true);
                                    }}
                                    onPlayError={(e) => {
                                        if (e.name === 'AbortError') return;
                                        toast({
                                            title: t('playback_error'),
                                            description: e.message || t('operation_not_allowed'),
                                            variant: "destructive",
                                        });
                                    }}
                                    onPause={() => setIsPlaying(false)}
                                    className="w-full h-full object-contain"
                                    src={videoSrc}
                                    isPlaying={isPlaying}
                                    nextSrc={nextVideoSrc}
                                    isPreloadEnabled={enablePreload}
                                    onLoadStart={() => addLog(`[Video Event] LoadStart: ${videoSrc.slice(0, 50)}...`)}
                                    onLoadedMetadata={() => {
                                        addLog(`[Video Event] LoadedMetadata: Duration ${videoRef.current?.duration}`);
                                        if (videoRef.current && pendingSeekTimeRef.current !== null) {
                                            addLog(`[Resolution] Restoring time to ${pendingSeekTimeRef.current.toFixed(1)}s`);
                                            videoRef.current.currentTime = pendingSeekTimeRef.current;
                                            pendingSeekTimeRef.current = null;
                                            // Note: isPlaying will be set by the next PLAYER_STATE heartbeat
                                        }
                                    }}
                                    onCanPlay={() => {
                                        addLog(`[Video Event] CanPlay`);
                                        retryCount.current = 0;
                                        if (videoRef.current) {
                                            if (Math.abs(videoRef.current.playbackRate - playbackRate) > 0.01) {
                                                videoRef.current.playbackRate = playbackRate;
                                            }
                                        }
                                    }}
                                    onStalled={() => addLog(`[Video Event] Stalled`)}
                                    onWaiting={() => addLog(`[Video Event] Waiting`)}
                                    onError={(e) => {
                                        const target = e.currentTarget as HTMLVideoElement;
                                        if (!target.error) return; // Ignore null errors

                                        const code = target.error?.code;
                                        const msg = target.error?.message;
                                        if (code === 20) return; // Cancelled

                                        addLog(`[Video Error] Code: ${code}, Msg: ${msg}, URL: ${videoSrc.slice(0, 50)}...`);
                                        // Silent log for debug
                                        console.log("[Video Info] Non-fatal or preload error ignored in UI", { code, msg });

                                        // Auth Expiry Detection
                                        // If it's a quark link and playback fails with 403 or specific error message.
                                        const isQuark = (videoSrc && videoSrc.includes('quark.cn')) || (videoSrc && videoSrc.includes('ApiClient'));
                                        const isForbidden = (target.error as any).code === 403 || code === 403 || (msg && (msg.includes('403') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('expired')));

                                        if (isQuark && isForbidden) {
                                            const now = Date.now();
                                            if (now - lastTimeRef.current > 30000) {
                                                addLog("[Auth] Quark session potentially expired.");
                                                toast({
                                                    variant: "destructive",
                                                    title: t('error_quark_login_required'),
                                                    description: t('error_no_cookie_configured'),
                                                    action: isOwner ? <Button variant="outline" size="sm" onClick={() => setShowQuarkLogin(true)}>{t('login')}</Button> : undefined
                                                });
                                                lastTimeRef.current = now;
                                            }
                                        }
                                    }}
                                    onDebug={(msg) => addLog(msg)}
                                    onTracksChanged={handleTracksChanged}
                                    activeTrackId={activeTrackId}
                                    currentSubtitle={currentSubtitle}
                                    onSubtitleChange={setCurrentSubtitle}
                                />
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                                {isRoomLoading ? (
                                    <div className="flex flex-col items-center gap-3 animate-fade-in">
                                        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
                                        <p className="text-sm font-medium animate-pulse">{t('connecting_room')}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center animate-pulse">
                                            ▶
                                        </div>
                                        <p className="text-sm font-medium">{t('enter_quark_link')}</p>
                                    </>
                                )}
                            </div>
                        )}


                        {currentSubtitle && (
                            <div
                                className="absolute left-1/2 -translate-x-1/2 z-[100] pointer-events-none w-fit max-w-[90%] transition-all duration-300 ease-out"
                                style={{ bottom: `${subtitleStyle.bottomOffset}px` }}
                            >
                                <div
                                    className={cn(
                                        "text-white px-8 py-3 rounded-2xl text-center break-words leading-snug select-none transition-all duration-300",
                                        subtitleStyle.bgOpacity > 0 ? "backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]" : "shadow-none",
                                        subtitleStyle.showBorder ? "border border-white/20" : "border-none"
                                    )}
                                    style={{
                                        fontSize: `${subtitleStyle.fontSize}px`,
                                        backgroundColor: `rgba(0, 0, 0, ${subtitleStyle.bgOpacity})`,
                                        color: subtitleStyle.textColor,
                                        fontWeight: subtitleStyle.fontWeight
                                    }}
                                >
                                    {currentSubtitle.split('\n').map((line, i) => (
                                        <div key={i} className="whitespace-pre-wrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{line}</div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Right Side Control Satellite Pills */}

                        {/* Always show if controls are needed, Danmaku is always available */}
                        {(true) && (
                            <div className={cn(
                                "absolute right-6 top-1/2 -translate-y-1/2 z-[30] transition-all duration-300 flex flex-col items-center gap-3",
                                showControls ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-4 pointer-events-none"
                            )}>



                                {/* Group 1: Resolution (Always visible if exists) */}
                                {resolutions.length > 0 && (
                                    <div className="flex flex-col gap-1 p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-2">
                                        {resolutions.map((res) => (
                                            <button
                                                key={res.id}
                                                className={cn(
                                                    "w-12 py-1.5 text-[10px] font-bold rounded-xl transition-all duration-200 active:scale-90 outline-none focus:ring-2 focus:ring-primary/50",
                                                    currentResolution === res.id
                                                        ? "bg-white/20 text-white shadow-sm"
                                                        : "text-zinc-500 hover:text-white hover:bg-white/10"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    changeResolution(res);
                                                }}
                                                onFocus={() => setShowControls(true)}
                                            >
                                                {getResolutionLabel(res.name)}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Group 2.5: Subtitle Style Settings */}
                                <div className="p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button
                                                className={cn(
                                                    "w-12 py-1.5 text-[10px] font-bold rounded-xl transition-all duration-200 active:scale-90 flex items-center justify-center outline-none focus:ring-2 focus:ring-primary/50",
                                                    "text-zinc-500 hover:text-white hover:bg-white/10"
                                                )}
                                                onFocus={() => setShowControls(true)}
                                                title={t('subtitle_settings') || 'Subtitle Style'}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {t('subtitle_style_short') || 'SUB'}
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent side="left" align="center" sideOffset={16} className="w-80 bg-black/85 backdrop-blur-2xl border-white/10 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-[110]">
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                                    <h4 className="text-sm font-bold text-white uppercase tracking-widest">
                                                        {t('subtitle_style') || 'Subtitle Style'}
                                                    </h4>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-zinc-500 font-medium">{t('font_bold') || 'Bold'}</span>
                                                            <Switch
                                                                checked={subtitleStyle.fontWeight === 'bold'}
                                                                onCheckedChange={(val) => updateSubtitleStyle({ fontWeight: val ? 'bold' : 'normal' })}
                                                                className="scale-75"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-zinc-500 font-medium">{t('show_border') || 'Border'}</span>
                                                            <Switch
                                                                checked={subtitleStyle.showBorder}
                                                                onCheckedChange={(val) => updateSubtitleStyle({ showBorder: val })}
                                                                className="scale-75"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Subtitle Tracks */}
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-xs text-zinc-400 uppercase tracking-widest font-bold">{t('subtitle_track') || '字幕轨道'}</Label>
                                                    </div>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-between bg-white/5 border border-white/10 h-10 px-3 hover:bg-white/10 hover:border-white/20 transition-all group rounded-xl"
                                                            >
                                                                <span className="truncate text-xs text-zinc-300">
                                                                    {activeTrackId === 'off' ? (t('off') || '关闭') : (subtitleTracks.find(t => `${t.type}-${t.id}` === activeTrackId)?.name || (t('off') || '关闭'))}
                                                                </span>
                                                                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent className="w-[calc(var(--radix-dropdown-menu-trigger-width))] bg-zinc-900/95 border-white/10 backdrop-blur-xl rounded-xl p-1 z-[120]">
                                                            <DropdownMenuItem
                                                                className={cn(
                                                                    "text-xs focus:bg-white/10 focus:text-white rounded-lg transition-colors cursor-pointer",
                                                                    activeTrackId === 'off' ? "bg-white/5 text-white font-medium" : "text-zinc-400"
                                                                )}
                                                                onClick={() => handleTrackSelect('off')}
                                                            >
                                                                {t('off') || '关闭'}
                                                            </DropdownMenuItem>
                                                            {subtitleTracks.map((track) => {
                                                                const id = `${track.type}-${track.id}`;
                                                                return (
                                                                    <DropdownMenuItem
                                                                        key={id}
                                                                        className={cn(
                                                                            "text-xs focus:bg-white/10 focus:text-white rounded-lg transition-colors cursor-pointer group",
                                                                            activeTrackId === id ? "bg-white/5 text-white font-medium" : "text-zinc-400"
                                                                        )}
                                                                        onClick={() => handleTrackSelect(id)}
                                                                    >
                                                                        <div className="flex items-center justify-between w-full">
                                                                            <span className="truncate flex-1">{track.name}</span>
                                                                            {track.language && (
                                                                                <span className="ml-2 px-1 py-0.5 text-[8px] rounded-md bg-white/5 text-zinc-500 font-mono uppercase group-hover:bg-white/10 group-hover:text-zinc-300 transition-colors">
                                                                                    {track.language}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </DropdownMenuItem>
                                                                );
                                                            })}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>

                                                {/* Font Size */}
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-xs text-zinc-400">{t('font_size') || 'Size'}</Label>
                                                        <span className="text-xs font-mono text-primary">{subtitleStyle.fontSize}px</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="16"
                                                        max="72"
                                                        step="1"
                                                        value={subtitleStyle.fontSize}
                                                        onChange={(e) => updateSubtitleStyle({ fontSize: parseInt(e.target.value) })}
                                                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary hover:bg-white/20 transition-colors"
                                                    />
                                                </div>

                                                {/* Bottom Offset */}
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-xs text-zinc-400">{t('position') || 'Position'}</Label>
                                                        <span className="text-xs font-mono text-primary">{subtitleStyle.bottomOffset}px</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="20"
                                                        max="360"
                                                        step="4"
                                                        value={subtitleStyle.bottomOffset}
                                                        onChange={(e) => updateSubtitleStyle({ bottomOffset: parseInt(e.target.value) })}
                                                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary hover:bg-white/20 transition-colors"
                                                    />
                                                </div>

                                                {/* Background Opacity */}
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-xs text-zinc-400">{t('bg_opacity') || 'Opacity'}</Label>
                                                        <span className="text-xs font-mono text-primary">{Math.round(subtitleStyle.bgOpacity * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.05"
                                                        value={subtitleStyle.bgOpacity}
                                                        onChange={(e) => updateSubtitleStyle({ bgOpacity: parseFloat(e.target.value) })}
                                                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary hover:bg-white/20 transition-colors"
                                                    />
                                                </div>

                                                {/* Text Color */}
                                                <div className="space-y-3">
                                                    <Label className="text-xs text-zinc-400 block">{t('text_color') || 'Color'}</Label>
                                                    <div className="flex gap-3 pt-1">
                                                        {[
                                                            { label: 'White', color: '#ffffff' },
                                                            { label: 'Yellow', color: '#facc15' },
                                                            { label: 'Orange', color: '#fb923c' },
                                                            { label: 'Green', color: '#4ade80' },
                                                            { label: 'Cyan', color: '#22d3ee' },
                                                            { label: 'Lavender', color: '#e9d5ff' }
                                                        ].map((c) => (
                                                            <button
                                                                key={c.color}
                                                                onClick={() => updateSubtitleStyle({ textColor: c.color })}
                                                                className={cn(
                                                                    "w-10 h-10 rounded-full border-2 transition-all hover:scale-110 active:scale-95 flex items-center justify-center",
                                                                    subtitleStyle.textColor === c.color ? "border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]" : "border-white/5"
                                                                )}
                                                                style={{ backgroundColor: c.color }}
                                                                title={c.label}
                                                            >
                                                                {subtitleStyle.textColor === c.color && <Check className="w-4 h-4 text-black" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>


                                {/* Group 3: Danmaku Toggle */}
                                <div className="flex flex-col gap-1 p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-2">
                                    <button
                                        className={cn(
                                            "w-12 py-1.5 text-[10px] font-bold rounded-xl transition-all duration-200 active:scale-90 flex items-center justify-center outline-none focus:ring-2 focus:ring-primary/50",
                                            isDanmakuEnabled
                                                ? "bg-white/20 text-white shadow-sm"
                                                : "text-zinc-500 hover:text-white hover:bg-white/10"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsDanmakuEnabled(!isDanmakuEnabled);
                                            toast({ description: !isDanmakuEnabled ? t('danmaku_on') : t('danmaku_off'), duration: 1000 });
                                        }}
                                        onFocus={() => setShowControls(true)}
                                        title={isDanmakuEnabled ? t('hide_danmaku') : t('show_danmaku')}
                                        >
                                            {t('danmaku_short')}
                                        </button>
                                    </div>
                                </div>
                        )}

                        {/* Sidebar Toggle Button (When Closed) */}
                        {!isImmersiveMode && !isLandscapeMobile && !isSidebarOpen && (
                            <div className={cn(
                                "absolute top-4 right-4 z-[100] transition-all duration-300",
                                showControls ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-4 pointer-events-none"
                            )}>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-8 w-8 rounded-full shadow-lg border border-white/10 bg-black/50 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setIsSidebarOpen(true);
                                    }}
                                    title={t('show_sidebar')}
                                >
                                    <PanelRightOpen className="h-4 w-4 text-white/90" />
                                </Button>
                            </div>
                        )}
                    </div>


                </div>

                {/* Sidebar / Mobile Content Area */}
                <aside className={cn(
                    "flex-1 flex flex-col min-h-0 overflow-hidden md:overflow-visible w-full transition-all duration-300 ease-in-out",
                    // Desktop Logic
                    "md:block md:space-y-6",
                    (!isImmersiveMode && !isFullscreen && !isLandscapeMobile && isSidebarOpen) ? "opacity-100 translate-x-0" : "hidden md:hidden opacity-0 translate-x-10"
                )}>
                    <Card className="flex-1 flex flex-col md:h-[calc(100vh-12rem)] shadow-none md:shadow-2xl overflow-hidden bg-transparent md:glass border-0 md:border-white/5 rounded-none md:rounded-xl">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 relative">
                            <CardHeader className="hidden md:block py-4 pl-2 pr-4 border-b border-white/5 bg-transparent">
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground rounded-full hover:bg-white/10"
                                        onClick={() => setIsSidebarOpen(false)}
                                        title={t('hide_sidebar')}
                                    >
                                        <PanelRightClose className="h-5 w-5" />
                                    </Button>
                                    <TabsList className="grid w-full grid-cols-3 bg-black/30 h-10 p-1 rounded-full border border-white/10">
                                        <TabsTrigger
                                            value="playlist"
                                            className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300 text-xs font-medium"
                                        >
                                            {t('playlist')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="chat"
                                            className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300 text-xs font-medium"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>{t('chat')}</span>
                                            </div>
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="members"
                                            className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300 text-xs font-medium"
                                        >
                                            {t('members')}
                                        </TabsTrigger>
                                    </TabsList>
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1 overflow-hidden p-0 bg-transparent flex flex-col">
                                <TabsContent value="playlist" className="flex-1 data-[state=active]:flex data-[state=active]:flex-col min-h-0 m-0">
                                    <div className="p-3 border-b bg-muted/30 flex gap-2 shrink-0">
                                        <Input
                                            placeholder={t('quark_url_or_id')}
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            className="h-8 flex-1"
                                        />
                                        <Button onClick={addToPlaylist} disabled={isResolving} size="icon" variant="secondary" className="h-8 w-8 shrink-0" title="Add to Queue">
                                            {isResolving ? <span className="animate-spin">⌛</span> : <Plus className="h-4 w-4" />}
                                        </Button>
                                    </div>

                                    <div className={cn("flex-1 overflow-y-auto p-2 space-y-2", isMobile ? "pb-32" : "")}>
                                        {isRoomLoading ? (
                                            <div className="space-y-2 p-2">
                                                {[1, 2, 3, 4].map((i) => (
                                                    <div key={i} className="h-12 bg-white/5 rounded-md animate-pulse" />
                                                ))}
                                            </div>
                                        ) : playlist.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
                                                <p>{t('queue_empty')}</p>
                                                <p className="text-xs opacity-70">{t('add_videos_hint')}</p>
                                            </div>
                                        ) : (
                                            <DndContext
                                                sensors={sensors}
                                                collisionDetection={closestCenter}
                                                onDragEnd={handleDragEnd}
                                            >
                                                <SortableContext
                                                    items={playlist}
                                                    strategy={verticalListSortingStrategy}
                                                >
                                                    {playlist.map((item, i) => (
                                                        <SortablePlaylistItem
                                                            key={item.id}
                                                            item={item}
                                                            index={i}
                                                            playingItemId={playingItemId}
                                                            onPlay={resolveAndPlay}
                                                            onRemove={removeFromPlaylist}
                                                        />
                                                    ))}
                                                </SortableContext>
                                            </DndContext>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="chat" className="flex-1 data-[state=active]:flex data-[state=active]:flex-col min-h-0 m-0">
                                    <div ref={chatListRef} className={cn("flex-1 overflow-y-auto p-4 space-y-4", isMobile ? "pb-48 no-scrollbar" : "")}>
                                        {messages.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 gap-2">
                                                <MessageSquare className="h-8 w-8" />
                                                <p className="text-sm">{t('no_messages_yet')}</p>
                                            </div>
                                        )}
                                        {messages.map((msg) => (
                                            <ChatMessageItem
                                                key={msg.id}
                                                message={msg}
                                                currentUserId={currentUserId}
                                            />
                                        ))}
                                    </div>
                                    {/* Responsive Chat Input */}
                                    <div className={cn(
                                        "transition-all duration-300 z-[60]",
                                        // Desktop
                                        "md:relative md:bottom-auto md:left-auto md:right-auto md:p-3 md:border-t md:bg-muted/20 md:transform-none md:opacity-100",
                                        // Mobile
                                        "absolute left-6 right-6",
                                        isMobile && isInputFocused
                                            ? "bottom-4"
                                            : "bottom-[calc(1.5rem+env(safe-area-inset-bottom)+3.5rem+0.75rem)]"
                                    )}>
                                        <form onSubmit={sendChatMessage} className={cn(
                                            "flex gap-2",
                                            isMobile ? "p-2 bg-zinc-900/90 backdrop-blur-3xl border border-white/10 rounded-full shadow-2xl" : ""
                                        )}>
                                            <Input
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onFocus={() => isMobile && setIsInputFocused(true)}
                                                onBlur={() => isMobile && setIsInputFocused(false)}
                                                placeholder={t('type_message')}
                                                className={cn(
                                                    "flex-1 md:h-9 bg-background/50",
                                                    isMobile ? "h-10 bg-transparent border-0 rounded-full pl-4 ring-0 focus-visible:ring-0 text-[16px] placeholder:text-zinc-500" : ""
                                                )}
                                            />
                                            <Button type="submit" size="icon" className={cn(
                                                "shrink-0",
                                                isMobile ? "h-10 w-10 rounded-full aspect-square bg-primary hover:bg-primary/90 text-white border-0 shadow-lg shadow-primary/20" : "h-9 w-9"
                                            )} disabled={!chatInput.trim()}>
                                                {isMobile ? <ArrowRightIcon className="w-5 h-5" /> : <Send className="h-4 w-4" />}
                                            </Button>
                                        </form>
                                    </div>
                                </TabsContent>

                                <TabsContent value="members" className="flex-1 data-[state=active]:flex data-[state=active]:flex-col min-h-0 m-0">
                                    <div className="flex flex-col h-full">
                                        <div className={cn("flex-1 overflow-y-auto p-2 space-y-2", isMobile ? "pb-40 no-scrollbar" : "")}>
                                            {isRoomLoading ? (
                                                <div className="space-y-2">
                                                    {[1, 2, 3].map((i) => (
                                                        <div key={i} className="flex items-center gap-3 p-2">
                                                            <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
                                                            <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : members.length === 0 ? (
                                                <div className="text-center text-muted-foreground text-sm opacity-70 mt-4">{t('no_members_info')}</div>
                                            ) : null}
                                            {!isRoomLoading && members.map((m: any, idx: number) => (
                                                <MemberItem
                                                    key={m.userId}
                                                    member={m}
                                                    currentUserId={currentUserId}
                                                    controllerId={controllerId}
                                                    ownerId={ownerId}
                                                    videoDuration={videoRef.current?.duration || 1}
                                                    controllerProgress={members.find((mem: any) => mem.userId === controllerId)?.currentProgress}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>
                            </CardContent>

                            {/* Bottom Navigation Bar - Mobile */}
                            <div className={cn(
                                "md:hidden fixed left-6 right-6 z-50 flex flex-col gap-2 transition-all duration-300",
                                isInputFocused
                                    ? "translate-y-32 opacity-0 pointer-events-none"
                                    : "bottom-[calc(1.5rem+env(safe-area-inset-bottom))] translate-y-0 opacity-100"
                            )}>
                                <TabsList className="flex items-center justify-between h-14 bg-zinc-900/90 backdrop-blur-3xl border border-white/10 rounded-full shadow-2xl p-1 gap-1 w-full overflow-hidden">
                                    <TabsTrigger value="playlist" className="flex-1 flex flex-col items-center justify-center gap-0.5 data-[state=active]:bg-white/10 data-[state=active]:text-primary rounded-full transition-all h-full bg-transparent border-0 ring-0 px-2 m-0 py-0 shadow-none">
                                        <List className="w-5 h-5 mb-0" />
                                        <span className="text-[10px] font-semibold leading-none">{t('playlist')}</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="chat" className="flex-1 flex flex-col items-center justify-center gap-0.5 data-[state=active]:bg-white/10 data-[state=active]:text-primary rounded-full transition-all h-full bg-transparent border-0 ring-0 px-2 m-0 py-0 shadow-none relative">
                                        <MessageSquare className="w-5 h-5 mb-0" />
                                        <span className="text-[10px] font-semibold leading-none">{t('chat')}</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="members" className="flex-1 flex flex-col items-center justify-center gap-0.5 data-[state=active]:bg-white/10 data-[state=active]:text-primary rounded-full transition-all h-full bg-transparent border-0 ring-0 px-2 m-0 py-0 shadow-none">
                                        <Users className="w-5 h-5 mb-0" />
                                        <span className="text-[10px] font-semibold leading-none">{t('members')}</span>
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Mobile Bottom Safety Area */}
                            <div className="md:hidden fixed bottom-0 left-0 right-0 h-[env(safe-area-inset-bottom)] bg-black z-[40]" />
                        </Tabs>
                    </Card>
                </aside>
                <ResourceLibrary
                    open={isLibraryOpen}
                    onOpenChange={setIsLibraryOpen}
                    cookie={roomCookie || userCookie || undefined}
                    onAdd={handleAddFileFromLibrary}
                    onAddSeries={handleAddSeriesFromLibrary}
                    roomId={roomId || undefined}
                    userId={currentUserId || undefined}
                    key={currentUserId || 'guest'}
                />

                <QuarkLoginDialog
                    open={showQuarkLogin}
                    onOpenChange={setShowQuarkLogin}
                    onSuccess={(cookie) => {
                        if (cookie) {
                            updateRoomCookie(cookie);
                            toast({ description: t('logged_in_room_updated') });
                        }
                    }}
                />
            </main >

            {/* Mobile Horizontal Drawer Overlay */}
            {
                isLandscapeMobile && (
                    <div className={cn(
                        "fixed inset-0 z-40 transition-all duration-300 ease-in-out pointer-events-none",
                        isDrawerOpen ? "bg-black/60 pointer-events-auto" : "bg-transparent"
                    )} onClick={() => setIsDrawerOpen(false)}>
                        <div
                            className={cn(
                                "absolute top-0 right-0 h-full w-[320px] bg-zinc-950 border-l border-white/10 shadow-2xl transition-transform duration-300 ease-out pointer-events-auto flex flex-col pt-safe",
                                isDrawerOpen ? "translate-x-0" : "translate-x-full"
                            )}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-white/5">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    <TabsList className="grid w-full grid-cols-4 bg-white/5 h-9 p-0.5 rounded-full border border-white/10">
                                        <TabsTrigger value="playlist" className="rounded-full text-[10px] h-full data-[state=active]:bg-primary">{t('playlist')}</TabsTrigger>
                                        <TabsTrigger value="chat" className="rounded-full text-[10px] h-full data-[state=active]:bg-primary">{t('chat')}</TabsTrigger>
                                        <TabsTrigger value="members" className="rounded-full text-[10px] h-full data-[state=active]:bg-primary">{t('members')}</TabsTrigger>
                                        <TabsTrigger value="settings" className="rounded-full text-[10px] h-full data-[state=active]:bg-primary">{t('settings')}</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <Button variant="ghost" size="icon" className="h-8 w-8 ml-2 shrink-0" onClick={() => setIsDrawerOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-hidden">
                                {activeTab === 'playlist' && (
                                    <div className="flex flex-col h-full">
                                        <div className="p-3 border-b border-white/5 flex gap-2">
                                            <Input
                                                placeholder={t('quark_url_or_id')}
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                className="h-8 flex-1 text-xs"
                                            />
                                            <Button onClick={addToPlaylist} disabled={isResolving} size="icon" variant="secondary" className="h-8 w-8 shrink-0">
                                                {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                            </Button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
                                            {playlist.map((item, i) => (
                                                <SortablePlaylistItem
                                                    key={item.id}
                                                    item={item}
                                                    index={i}
                                                    playingItemId={playingItemId}
                                                    onPlay={resolveAndPlay}
                                                    onRemove={removeFromPlaylist}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'chat' && (
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                                            {messages.map((msg) => (
                                                <ChatMessageItem key={msg.id} message={msg} currentUserId={currentUserId} />
                                            ))}
                                        </div>
                                        <div className="p-3 border-t border-white/5 bg-zinc-900/50 pb-safe">
                                            <form onSubmit={sendChatMessage} className={cn(
                                                "flex gap-2",
                                                isMobile ? "" : "max-w-4xl mx-auto"
                                            )}>
                                                <Input
                                                    value={chatInput}
                                                    onChange={(e) => setChatInput(e.target.value)}
                                                    placeholder={t('type_message')}
                                                    className="h-8 text-xs bg-black/50 border-white/10 rounded-full pl-3"
                                                />
                                                <Button type="submit" size="icon" className="h-8 w-8 rounded-full bg-primary" disabled={!chatInput.trim()}>
                                                    <ArrowRightIcon className="w-4 h-4" />
                                                </Button>
                                            </form>
                                        </div>
                                    </div>
                                )}
                                {activeTab === 'members' && (
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
                                        {members.map((m: any) => (
                                            <MemberItem
                                                key={m.userId}
                                                member={m}
                                                currentUserId={currentUserId}
                                                controllerId={controllerId}
                                                ownerId={ownerId}
                                                videoDuration={videoRef.current?.duration || 1}
                                                controllerProgress={members.find((mem: any) => mem.userId === controllerId)?.currentProgress}
                                            />
                                        ))}
                                    </div>
                                )}
                                {activeTab === 'settings' && (
                                    <div className="flex-1 overflow-y-auto p-4 no-scrollbar origin-top scale-90 -mt-2 h-[110%] w-[110%] -ml-[5%]">
                                        <div className="space-y-6 pb-safe origin-top scale-90 w-[110%] -ml-[5%]">
                                            <div className="space-y-4">
                                                <div className="grid gap-2">
                                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('room_settings')}</Label>
                                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="room-title-mobile" className="text-xs">{t('room_name')}</Label>
                                                            <Input
                                                                id="room-title-mobile"
                                                                value={roomTitle}
                                                                onChange={(e) => isOwner && setRoomTitle(e.target.value)}
                                                                className="h-9 bg-black/40 border-white/10 rounded-xl text-sm"
                                                                disabled={!isOwner}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="room-desc-mobile" className="text-xs">{t('room_description')}</Label>
                                                            <Input
                                                                id="room-desc-mobile"
                                                                value={roomDescription}
                                                                onChange={(e) => isOwner && setRoomDescription(e.target.value)}
                                                                className="h-9 bg-black/40 border-white/10 rounded-xl text-sm"
                                                                disabled={!isOwner}
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between pt-2">
                                                            <div className="space-y-0.5">
                                                                <Label className="text-sm font-medium">{t('lock_control')}</Label>
                                                                <p className="text-[10px] text-muted-foreground">{t('lock_control_desc')}</p>
                                                            </div>
                                                            <Switch
                                                                checked={isLocked}
                                                                onCheckedChange={(checked) => {
                                                                    if (!isOwner) return;
                                                                    setIsLocked(checked);
                                                                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                                                                        socketRef.current.send(JSON.stringify({
                                                                            type: 'UPDATE_ROOM',
                                                                            payload: { isLocked: checked }
                                                                        }));
                                                                    }
                                                                }}
                                                                disabled={!isOwner}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {isOwner && (
                                                    <div className="grid gap-2">
                                                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('cloud_storage')}</Label>
                                                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`h-2.5 w-2.5 rounded-full ${roomCookie || userCookie ? 'bg-green-500' : (hasGlobalCookie ? (globalAuthRequired && !localStorage.getItem('cueplay_system_auth_code') ? 'bg-red-500' : 'bg-amber-500') : 'bg-red-500')}`} />
                                                                    <span className="text-sm font-medium">
                                                                        {roomCookie ? t('quark_drive_connected') : (userCookie ? (t('user_cookie_connected') || 'User Connected') : (hasGlobalCookie ? (globalAuthRequired && !localStorage.getItem('cueplay_system_auth_code') ? t('quark_drive_disconnected') : t('using_global_connection')) : t('quark_drive_disconnected')))}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                className={`w-full h-10 rounded-xl text-sm gap-2 ${roomCookie || userCookie ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-primary hover:bg-primary/90'}`}
                                                                onClick={() => setShowQuarkLogin(true)}
                                                            >
                                                                <QrCode className="h-4 w-4" />
                                                                {roomCookie || userCookie ? t('reconnect_login') : t('login_quark_scan')}
                                                            </Button>

                                                            <div className="flex gap-2">
                                                                {roomCookie && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="flex-1 h-8 bg-white/5 text-destructive hover:bg-destructive/10 text-[10px]"
                                                                        onClick={() => updateRoomCookie('')}
                                                                    >
                                                                        <Unplug className="h-3 w-3 mr-2" />
                                                                        {t('disconnect_cookie') || 'Disconnect'}
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className={`flex-1 h-8 bg-white/5 hover:bg-white/10 text-[10px] text-muted-foreground`}
                                                                    onClick={() => setShowManualInput(!showManualInput)}
                                                                >
                                                                    <Settings className="h-3 w-3 mr-2" />
                                                                    {showManualInput ? t('hide_manual_input') : t('manual_input') || 'Manual'}
                                                                </Button>
                                                            </div>

                                                            {showManualInput && (
                                                                <div className="pt-2 border-t border-white/5 animate-in slide-in-from-top-1 fade-in duration-200">
                                                                    <Input
                                                                        value={roomCookie}
                                                                        onChange={(e) => updateRoomCookie(e.target.value)}
                                                                        className="h-8 text-[10px] font-mono bg-black/40 border-white/10 rounded-lg"
                                                                        placeholder="Cookie string..."
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}






export default function RoomPage() {
    const { t } = useTranslation('common');
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">{t('loading_room')}</div>}>
            <RoomContent />
        </Suspense>
    );
}
