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
import { useTranslation } from 'react-i18next';
import { ApiClient, DriveFile } from '@/api/client';
import { WS_BASE, getProxyBase, resetProxyCache } from '@/api/config';
import { LanguageToggle } from '@/components/language-toggle';
import { QuarkLoginDialog } from '@/components/quark-login-dialog';
import { ResourceLibrary } from '@/components/resource-library';
import { RoomHistory } from '@/utils/history';
import { Trash2, PlayCircle, Plus, Settings, Copy, Cast, Crown, Eye, EyeOff, MessageSquare, Send, GripVertical, Link2, Unlink, ArrowLeft, FolderSearch, QrCode, ChevronDown, ChevronRight, ChevronLeft, Folder, Loader2, List, Users, MoreVertical, ArrowRight as ArrowRightIcon, Maximize, Minimize, Lock, Check, SlidersHorizontal, Menu, X, Unplug, PanelRightClose, PanelRightOpen } from 'lucide-react';
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
    const searchParams = useSearchParams();
    const router = useRouter();
    const roomId = searchParams.get('id');
    const { toast } = useToast();
    const { t } = useTranslation('common');

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
    const controllerIdRef = useRef<string | null>(null);
    const [videoSrc, setVideoSrc] = useState<string>('');
    const [rawUrl, setRawUrl] = useState<string>('');
    const [resolutions, setResolutions] = useState<Array<{ id: string, name: string, url: string }>>([]);
    const [currentResolution, setCurrentResolution] = useState<string>('Original');
    const [duration, setDuration] = useState<number>(3600);
    const [fileId, setFileId] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const lastSubtitleChangeTime = useRef<number>(0);
    const MAX_SUBTITLE_DURATION = 8; // Maximum subtitle display duration in seconds
    const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
    const playlistRef = useRef(playlist);
    useEffect(() => { playlistRef.current = playlist; }, [playlist]);
    const [playingItemId, setPlayingItemId] = useState<string | null>(null);
    const playingItemIdRef = useRef<string | null>(null);
    useEffect(() => { playingItemIdRef.current = playingItemId; }, [playingItemId]);


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
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
    const [manualTracks, setManualTracks] = useState<any[]>([]);
    const [selectedManualTrackId, setSelectedManualTrackId] = useState<number | undefined>(undefined);
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);

    const handleManualTracks = useCallback((tracks: any[]) => {
        setManualTracks(tracks);
        // Auto-select first track if nothing selected
        if (tracks.length > 0 && selectedManualTrackId === undefined) {
            const best = tracks.find(t => {
                const lang = (t.language || '').toLowerCase();
                return lang === 'chi' || lang === 'zho' || lang === 'zh';
            }) || tracks.find(t => (t.language || '').toLowerCase() === 'eng')
                || tracks[0];
            setSelectedManualTrackId(best.id);
        }
    }, [selectedManualTrackId]);

    // Reset manual tracks on video change
    useEffect(() => {
        setManualTracks([]);
        setSelectedManualTrackId(undefined);
        setIsSubMenuOpen(false);
    }, [videoSrc]);
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
    const pendingSeekTimeRef = useRef<number | null>(null);

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

    const resolveAndPlayWithoutSync = async (fid: string, itemId?: string) => {
        if (itemId) {
            lastResumedItemIdRef.current = null; // Prepare for resume
            setPlayingItemId(itemId);
        }

        try {
            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
            const { source, cookie } = await ApiClient.resolveVideo(fid, roomId || '', authCode);
            lastVideoCookieRef.current = cookie;
            addLog(`[ResolveSync] Source: ${JSON.stringify(source, null, 2)}`);
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

            let finalUrl = source.url;
            if (cookie && cookie.trim()) {
                const proxyBase = await getProxyBase();
                finalUrl = `${proxyBase}/api/stream/proxy?url=${encodeURIComponent(source.url)}&cookie=${encodeURIComponent(cookie)}`;
            } else {
                console.warn("No cookie returned from API for this video.");
            }

            // If the source is different or it's a new play, set it
            addLog(`[Sync] Final URL: ${finalUrl} (ProxyBase: ${await getProxyBase()})`);
            setVideoSrc(finalUrl);
            if (itemId) {
                addLog(`Resolving synced video: ${fid} (item: ${itemId})`);
            }
        } catch (e: any) {
            console.warn("resolveAndPlayWithoutSync error:", e);
            addLog(`[Sync] Error: ${e.message}`);
            if (e.message.includes('No authorization cookie') || e.message.includes('system_login_required')) {
                toast({
                    variant: "destructive",
                    title: t('error_quark_login_required'),
                    description: t('error_no_cookie_configured'),
                    action: <Button variant="outline" size="sm" onClick={() => setShowQuarkLogin(true)}>{t('login')}</Button>
                });
            }
        }
    }

    // Helper: Resolve metadata effectively in background without changing videoSrc
    const resolveAndPlayMetadataOnly = async (fid: string, itemId?: string) => {
        try {
            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
            const { source } = await ApiClient.resolveVideo(fid, roomId || '', authCode);

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
            if (e.message.includes('No authorization cookie') || e.message.includes('system_login_required')) {
                toast({
                    variant: "destructive",
                    title: t('error_quark_login_required'),
                    description: t('error_no_cookie_configured'),
                    action: <Button variant="outline" size="sm" onClick={() => setShowQuarkLogin(true)}>{t('login')}</Button>
                });
            }
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
            const { source, cookie } = await ApiClient.resolveVideo(fid, roomId || '', authCode);
            let nextUrl = source.url;
            if (cookie && cookie.trim()) {
                const proxyBase = await getProxyBase();
                nextUrl = `${proxyBase}/api/stream/proxy?url=${encodeURIComponent(source.url)}&cookie=${encodeURIComponent(cookie)}`;
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

    const resolveAndPlay = async (targetFileId: string, itemId?: string) => {
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

        setFileId(fid); // Sync internal state
        lastResumedItemIdRef.current = null; // Prepare for resume
        setPlayingItemId(itemId || null); // Track playlist item
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
        console.log(`[Seamless] Checking logic: ReqID=${fid}, NextID=${nextVideoId}, NextSrc=${!!nextVideoSrc}`);
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
            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
            const { source, cookie } = await ApiClient.resolveVideo(fid, roomId || '', authCode);
            lastVideoCookieRef.current = cookie;
            addLog(`[Resolve] Source: ${JSON.stringify(source, null, 2)}`);
            console.log("Resolve result (Full):", { source, cookieLen: cookie?.length });

            setRawUrl(source.url); // Use raw URL for sharing

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
                        meta: source.meta,
                        playingItemId: itemId || null
                    }
                }));
            }

            // Local playback
            let finalUrl = source.url;
            if (cookie && cookie.trim()) {
                const proxyBase = await getProxyBase();
                finalUrl = `${proxyBase}/api/stream/proxy?url=${encodeURIComponent(source.url)}&cookie=${encodeURIComponent(cookie)}`;
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
            console.warn(e);
            addLog(`Resolve error: ${e.message}`);
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
                    title: t('failed_resolve_title'),
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
            const { source } = await ApiClient.resolveVideo(fid, roomId || '', authCode);
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
                setFileId('');
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
            const { source } = await ApiClient.resolveVideo(file.id, roomId || '', authCode);
            const title = source.meta?.file_name || source.meta?.title || file.name || file.id;

            const newItem: PlaylistItem = { id: Math.random().toString(36).slice(2), fileId: file.id, title, type: 'file' };
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
                resolveAndPlay(file.id, newItem.id);
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
            type: 'file'
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
            resolveAndPlay(children[0].fileId, children[0].id);
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
            resolveAndPlay(nextItem.fileId, nextItem.id);
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
                resolveAndPlay(prevItem.fileId, prevItem.id);
            }
        }
    };

    // Auto-play when source changes
    useEffect(() => {
        if (videoSrc && videoRef.current) {
            videoRef.current.play().catch(e => {
                console.warn("Auto-play failed:", e);
            });
        }
    }, [videoSrc]);

    const sendState = useCallback(() => {
        const ws = socketRef.current;
        if (isRemoteUpdate.current || isLoadingSource.current || !videoRef.current || !ws || ws.readyState !== WebSocket.OPEN) return;

        // Enforce View Only: Only controller can broadcast state
        if (controllerIdRef.current && controllerIdRef.current !== currentUserId) {
            addLog(`Blocked Sync: Controller is ${controllerIdRef.current}`);

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
                sentAt: Date.now()
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
            console.log("JOIN_ROOM Payload:", payload); // Debug log
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
                const { url, fileId: remoteFileId, provider, playingItemId: remotePlayingItemId } = data.payload;

                // *** CONTROLLER GUARD ***
                // If I am the controller and I already have this item playing, ignore the echo.
                // This prevents AbortError caused by double resolution/setting video source.
                const amIController = !controllerIdRef.current || controllerIdRef.current === userId;
                if (amIController && remotePlayingItemId && remotePlayingItemId === playingItemIdRef.current) {
                    addLog(`[WS] MEDIA_CHANGE ignored (already playing ${remotePlayingItemId})`);
                    return;
                }
                setFileId(remoteFileId || '');
                setRawUrl(url || '');
                lastResumedItemIdRef.current = null; // Prepare for resume
                setPlayingItemId(remotePlayingItemId || null);

                if (!remoteFileId) {
                    setVideoSrc('');
                } else if (url) {
                    // Peers need to resolve to get the cookie if they don't have one?
                    // Currently MEDIA_CHANGE sends the raw URL.
                    // If raw URL needs cookie, peer needs to get it.
                    // IMPORTANT: Peers must also call resolve to get the Global Cookie if they don't have one.
                    // But here we just setVideoSrc.
                    // If we don't resolve, we don't get the global cookie.
                    // So we must resolve on every MEDIA_CHANGE if we want to use Global Cookie.

                    // Trigger resolution for self
                    resolveAndPlayWithoutSync(remoteFileId, remotePlayingItemId);
                }
                setCurrentSubtitle('');

                // Sync playlist metadata if needed (but don't set placeholder)
                if (remoteFileId) {
                    const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
                    ApiClient.resolveVideo(remoteFileId, roomId || '', authCode).then(({ source }) => {
                        setPlaylist(prev => prev.map(item =>
                            item.fileId === remoteFileId && item.title === 'Current Video'
                                ? { ...item, title: source.meta?.file_name || source.meta?.title || remoteFileId }
                                : item
                        ));
                    }).catch((e) => {
                        if (e.message.includes('No authorization cookie')) {
                            // Silent fail for background sync, or toast?
                            // Maybe toast once?
                            console.warn("Background sync auth failed");
                        }
                    });
                }

                // ... inside RoomContent component ...

            } else if (data.type === 'ROOM_UPDATE') {
                const { members, ownerId, controllerId, quarkCookie, hasGlobalCookie } = data.payload;
                const isCurrentOwner = ownerId === userId;

                setMembers(members);
                setOwnerId(ownerId);
                setControllerId(controllerId);
                controllerIdRef.current = controllerId;
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
            } else if (data.type === 'PLAYER_STATE') {
                const video = videoRef.current;
                if (!video) return;

                // Independent Mode: Viewer disabled sync
                const amIController = !controllerIdRef.current || controllerIdRef.current === userId;
                if (!amIController && !isSyncedRef.current) return;

                const { state, time, playbackRate, sentAt } = data.payload;

                // Update local playlist progress based on controller's authoritative time
                // This keeps the progress bar in the playlist UI smooth for everyone
                if (playingItemId) {
                    setPlaylist(prev => {
                        let updated = false;
                        const update = (list: any[]): any[] => {
                            return list.map(item => {
                                if (item.id === playingItemId) {
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
                    const age = Date.now() - sentAt;
                    // Reset if too old (> 1 min) or first time
                    if (age < lastMinAgeRef.current || lastMinAgeRef.current === Number.MAX_SAFE_INTEGER) {
                        lastMinAgeRef.current = age;
                    }
                    // Relative latency: how much older this specific message is compared to the 'fastest' message seen
                    // Plus a small constant base latency guess (50ms) to jump slightly ahead of what we received
                    const relativeLatency = (age - lastMinAgeRef.current) / 1000;
                    compensatedTime = time + relativeLatency + 0.05;
                }

                const now = video.currentTime;
                const drift = now - compensatedTime;

                isRemoteUpdate.current = true;

                // 1. Hard Sync: State Mismatch or Very Large Drift (> 3.0s)
                // We use a larger threshold (3s) to avoid frequent seeking, which causes buffering/stuttering.
                // Ignore mismatch if we are buffering (we might be "paused" waiting for data while controller is playing)
                const isStateMismatch = !isBuffering.current && ((state === 'playing' && video.paused) || (state === 'paused' && !video.paused));

                if (Math.abs(drift) > 2.0 || isStateMismatch) {
                    addLog(`[Sync] Hard Sync: Drift=${drift.toFixed(3)}s, StateMismatch=${isStateMismatch}`);
                    if (Math.abs(drift) > 0.5) { // Minimum seek threshold
                        addLog(`[Sync] Seeking to ${compensatedTime.toFixed(2)}s`);
                        video.currentTime = compensatedTime;
                    }
                    if (state === 'playing') video.play().catch(() => { });
                    else video.pause();

                    // Reset rate on hard sync
                    if (video.playbackRate !== playbackRate) {
                        video.playbackRate = playbackRate;
                    }
                }
                // 2. Soft Sync: Drift Adjustment (Tiered)
                else {
                    // Soft Sync DISABLED - Just reset rate
                    const targetRate = playbackRate || 1.0;
                    if (Math.abs(video.playbackRate - targetRate) > 0.01) {
                        video.playbackRate = targetRate;
                        addLog(`[Sync] Reset Rate -> ${targetRate}`);
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
                const { userId, time, playingItemId: memberPlayingItemId, duration } = data.payload;
                // Update members list progress
                setMembers(prev => prev.map(m => m.userId === userId ? { ...m, currentProgress: time } : m));

                // Update playlist progress if this is the controller (providing authoritative progress)
                if (memberPlayingItemId && userId === controllerIdRef.current) {
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
                }
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
                            playingItemId: playingItemIdRef.current || undefined,
                            duration: video.duration || undefined
                        }
                    }));

                    lastProgressSent = now;
                }

                // Update local member progress every 1s (independent of network throttle)
                setMembers(prev => prev.map(m => m.userId === currentUserId ? { ...m, currentProgress: video.currentTime } : m));

                // 2. If Controller, broadcast authoritative state for Active Sync
                // We do this every 1s to maintain tight sync.
                if (controllerIdRef.current === currentUserId) {
                    // Update local member progress to fix "Red" color (self-sync status)
                    setMembers(prev => prev.map(m => m.userId === currentUserId ? { ...m, currentProgress: video.currentTime } : m));

                    // Update local playlist progress state so the controller sees their own bar move
                    const currentPlayingId = playingItemIdRef.current;
                    if (currentPlayingId) {
                        setPlaylist(prev => {
                            let updated = false;
                            const update = (list: any[]): any[] => {
                                return list.map(item => {
                                    if (item.id === currentPlayingId) {
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
                            return updated ? newList : prev;
                        });
                    }

                    ws.send(JSON.stringify({
                        type: 'PLAYER_STATE',
                        payload: {
                            state: video.paused ? 'paused' : 'playing',
                            time: video.currentTime,
                            playbackRate: video.playbackRate,
                            sentAt: now
                        }
                    }));
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [currentUserId]);



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
                finalUrl = `${proxyBase}/api/stream/proxy?url=${encodeURIComponent(res.url)}&cookie=${encodeURIComponent(lastVideoCookieRef.current)}`;
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
                            className={`flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-full text-xs font-bold border transition-all duration-300 ${canControl
                                ? 'bg-primary/50 text-white border-primary/50 shadow-[0_0_15px_rgba(124,58,237,0.25)] cursor-default'
                                : 'bg-muted/50 text-muted-foreground border-white/10 hover:bg-muted hover:text-foreground cursor-pointer'
                                }`}
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

                        {isLandscapeMobile ? (
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
                        ) : (
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

                                                {/* Cloud Storage Settings (Owner Only) */}
                                                {isOwner && (
                                                    <div className="pt-2 mt-2 border-t space-y-3">
                                                        <Label className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('cloud_storage')}</Label>

                                                        <div className="bg-muted/30 rounded-lg p-3 border border-white/5 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`h-2 w-2 rounded-full ${roomCookie || userCookie ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : (hasGlobalCookie ? (globalAuthRequired && !localStorage.getItem('cueplay_system_auth_code') ? 'bg-red-500' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]') : 'bg-red-500')}`} />
                                                                    <span className="text-xs font-medium text-foreground">
                                                                        {roomCookie ? t('quark_drive_connected') : (userCookie ? t('user_cookie_connected') : (hasGlobalCookie ? (globalAuthRequired && !localStorage.getItem('cueplay_system_auth_code') ? t('quark_drive_disconnected') : t('using_global_connection')) : t('quark_drive_disconnected')))}
                                                                    </span>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    {roomCookie && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-5 w-5 text-destructive hover:bg-destructive/10"
                                                                            title={t('disconnect_cookie')}
                                                                            onClick={() => updateRoomCookie('')}
                                                                        >
                                                                            <Unplug className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-5 w-5 hover:bg-white/10"
                                                                        title={t('manual_cookie_input')}
                                                                        onClick={() => setShowManualInput(!showManualInput)}
                                                                    >
                                                                        <Settings className="h-3 w-3 text-muted-foreground" />
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            <Button
                                                                variant={roomCookie || userCookie ? "outline" : "default"}
                                                                size="sm"
                                                                className="w-full h-8 text-xs gap-2"
                                                                onClick={() => setShowQuarkLogin(true)}
                                                            >
                                                                <QrCode className="h-3.5 w-3.5" />
                                                                {roomCookie || userCookie ? t('reconnect_login') : t('login_quark_scan')}
                                                            </Button>

                                                            {showManualInput && (
                                                                <div className="pt-2 border-t border-white/5 animate-in slide-in-from-top-1 fade-in duration-200">
                                                                    <Label htmlFor="roomCookie" className="text-[10px] text-muted-foreground mb-1.5 block">{t('manual_cookie_input')}</Label>
                                                                    <Input
                                                                        id="roomCookie"
                                                                        value={roomCookie}
                                                                        onChange={(e) => updateRoomCookie(e.target.value)}
                                                                        className="h-7 text-xs font-mono bg-muted/20"
                                                                        placeholder="Paste cookie string..."
                                                                        type="password"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {!isOwner && (
                                                    <div className="text-[10px] text-muted-foreground text-center pt-2">
                                                        {t('only_owner_settings')}
                                                    </div>
                                                )}
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
                        )}
                    </div>
                </div>
            </header>



            <main className={cn(
                "flex-1 flex flex-col min-h-0 animate-fade-in",
                "md:container md:mx-auto md:grid md:gap-6 transition-all duration-300 ease-in-out",
                (isImmersiveMode || isLandscapeMobile) ? "md:grid-cols-1 md:max-w-none md:p-0 items-center justify-center" : (isSidebarOpen ? "md:p-6 md:grid-cols-4" : "md:p-6 md:grid-cols-1")
            )}>
                {/* Video Section */}
                <div className={cn(
                    "space-y-4 shrink-0 z-10 w-full transition-all duration-300 ease-in-out",
                    isImmersiveMode || !isSidebarOpen ? "md:col-span-1 relative group/video" : "md:col-span-3 relative group/video"
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
                                    {/* Control Status Indicator */}
                                    <div
                                        className={`flex items-center justify-center h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 ${canControl
                                            ? 'text-primary border-primary/50 shadow-[0_0_10px_rgba(124,58,237,0.3)]'
                                            : 'text-white/70'
                                            }`}
                                        onClick={(e) => {
                                            if (canControl) return;
                                            if (socketRef.current?.readyState === WebSocket.OPEN) {
                                                socketRef.current.send(JSON.stringify({ type: 'TAKE_CONTROL', payload: { roomId: roomId || '' } }));
                                                toast({ title: t('control_requested_title'), description: t('control_requested_desc') });
                                            }
                                        }}
                                    >
                                        {canControl ? <Cast className="h-5 w-5" /> : (isLocked ? <Lock className="h-5 w-5" /> : <Eye className="h-5 w-5" />)}
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
                                        {isDanmakuEnabled && <DanmakuOverlay ref={danmakuRef} />}
                                    </>
                                }
                                onSubtitleChange={setCurrentSubtitle}
                                autoPlay
                                className="w-full h-full object-contain"
                                src={videoSrc}
                                nextSrc={nextVideoSrc}
                                isPreloadEnabled={enablePreload}
                                onEnded={playNext}
                                onLoadStart={() => addLog(`[Video Event] LoadStart: ${videoSrc.slice(0, 50)}...`)}
                                onLoadedMetadata={() => {
                                    addLog(`[Video Event] LoadedMetadata: Duration ${videoRef.current?.duration}`);

                                    // RESTORE TIME (Resolution Switch) - Execute as early as possible
                                    if (videoRef.current && pendingSeekTimeRef.current !== null) {
                                        addLog(`[Resolution] Restoring time to ${pendingSeekTimeRef.current.toFixed(1)}s`);
                                        videoRef.current.currentTime = pendingSeekTimeRef.current;
                                        pendingSeekTimeRef.current = null;
                                        // Ensure it plays if it was playing, or if autoPlay is meant to be on
                                        // For resolution switch, we generally want to resume.
                                        videoRef.current.play().catch(e => console.warn("Auto-resume failed", e));
                                    }
                                }}
                                onCanPlay={() => {
                                    addLog(`[Video Event] CanPlay`);
                                    if (videoRef.current) {
                                        // Restore Rate
                                        if (Math.abs(videoRef.current.playbackRate - playbackRate) > 0.01) {
                                            addLog(`[Rate] Restoring rate to ${playbackRate}`);
                                            videoRef.current.playbackRate = playbackRate;
                                        }
                                    }
                                }}
                                onStalled={() => addLog(`[Video Event] Stalled`)}
                                onWaiting={() => addLog(`[Video Event] Waiting`)}
                                onError={(e) => {
                                    const err = e.currentTarget.error;
                                    const code = err?.code;
                                    const msg = err?.message;
                                    addLog(`[Video Error] Code: ${code}, Msg: ${msg}`);
                                    console.error("[Video Error]", err);

                                    // Auto-retry logic for network/source errors (Proxy restart or Expiry)
                                    if (code === 2 || code === 4) { // MEDIA_ERR_NETWORK (2) or MEDIA_ERR_SRC_NOT_SUPPORTED (4)
                                        if (retryCount.current < 3) {
                                            retryCount.current += 1;
                                            addLog(`[Retry] Attempt ${retryCount.current}/3... Resetting Proxy Cache.`);

                                            // 1. Force new proxy port discovery
                                            resetProxyCache();

                                            // 2. Retry playback (re-resolve URL)
                                            // Use setTimeout to avoid rapid loops if error is persistent
                                            setTimeout(() => {
                                                if (fileId) {
                                                    resolveAndPlay(fileId, playingItemId || undefined);
                                                }
                                            }, 1000);
                                        } else {
                                            addLog(`[Retry] Max retries exceeded.`);
                                            toast({
                                                variant: "destructive",
                                                title: t('playback_error'),
                                                description: t('playback_error_desc')
                                            });
                                        }
                                    }
                                }}
                                onDebug={(msg) => addLog(msg)}
                                onManualTracksDetected={handleManualTracks}
                                manualTrackId={selectedManualTrackId}
                            />
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
                                className="absolute bottom-20 left-0 right-0 pointer-events-none z-20 flex justify-center items-center"
                            >
                                <div
                                    className="bg-black/50 text-white px-6 py-2 rounded-lg text-lg lg:text-3xl shadow-2xl border border-white/10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-center inline-block max-w-[90%] break-words"
                                >
                                    {currentSubtitle.split('\n').map((line, i) => (
                                        <div key={i} className="text-center">{line}</div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Right Side Control Satellite Pills */}
                        {/* Always show if controls are needed, Danmaku is always available */}
                        {(true) && (
                            <div className={cn(
                                "absolute right-6 top-1/2 -translate-y-1/2 z-[30] transition-all duration-300 flex flex-col items-end gap-3",
                                showControls ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-4 pointer-events-none"
                            )}>



                                {/* Group 1: Resolution (Always visible if exists) */}
                                {resolutions.length > 0 && (
                                    <div className="flex flex-col gap-1 p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-2">
                                        {resolutions.map((res) => (
                                            <button
                                                key={res.id}
                                                className={cn(
                                                    "w-12 py-1.5 text-[10px] font-bold rounded-xl transition-all duration-200 active:scale-90",
                                                    currentResolution === res.id
                                                        ? "bg-white/20 text-white shadow-sm"
                                                        : "text-zinc-500 hover:text-white hover:bg-white/10"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    changeResolution(res);
                                                }}
                                            >
                                                {getResolutionLabel(res.name)}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Group 2: Subtitles (Independent Triggered Menu) */}
                                {manualTracks.length > 1 && (
                                    <div className={cn(
                                        "bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden flex flex-col",
                                        isSubMenuOpen ? "p-2 min-w-[120px]" : "p-1.5"
                                    )}>
                                        {!isSubMenuOpen ? (
                                            // Subtitle Trigger Button
                                            <button
                                                className="w-12 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-90"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsSubMenuOpen(true);
                                                }}
                                            >
                                                {t('sub_short')}
                                            </button>
                                        ) : (
                                            // Subtitle Sub-menu Content
                                            <div className="animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                                                <button
                                                    className="flex items-center gap-2 px-2 py-1.5 border-b border-white/5 mb-1 group hover:text-white transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsSubMenuOpen(false);
                                                    }}
                                                >
                                                    <ArrowLeft className="w-3 h-3 text-zinc-500 group-hover:text-white transition-colors" />
                                                    <span className="text-[10px] uppercase tracking-tighter text-zinc-400 font-bold">
                                                        {t('subtitles')}
                                                    </span>
                                                </button>
                                                <div className="flex flex-col gap-1 max-h-[30vh] overflow-y-auto no-scrollbar py-0.5">
                                                    {manualTracks.map((t) => (
                                                        <button
                                                            key={t.id}
                                                            className={cn(
                                                                "px-3 py-2 text-xs font-medium rounded-xl transition-all duration-200 active:scale-95 whitespace-nowrap text-left flex justify-between items-center gap-4",
                                                                selectedManualTrackId === t.id
                                                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                                    : "text-zinc-400 hover:text-white hover:bg-white/10"
                                                            )}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedManualTrackId(t.id);
                                                            }}
                                                        >
                                                            <span className="truncate max-w-[120px]">{t.language ? t.language.toUpperCase() : `TRACK ${t.id}`}</span>
                                                            {selectedManualTrackId === t.id && <Check className="w-3 h-3 shrink-0" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Group 3: Danmaku Toggle */}
                                <div className="flex flex-col gap-1 p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-2">
                                    <button
                                        className={cn(
                                            "w-12 py-1.5 text-[10px] font-bold rounded-xl transition-all duration-200 active:scale-90 flex items-center justify-center gap-1",
                                            isDanmakuEnabled
                                                ? "bg-white/20 text-white shadow-sm"
                                                : "text-zinc-500 hover:text-white hover:bg-white/10"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsDanmakuEnabled(!isDanmakuEnabled);
                                            toast({ description: !isDanmakuEnabled ? t('danmaku_on') : t('danmaku_off'), duration: 1000 });
                                        }}
                                        title={isDanmakuEnabled ? t('hide_danmaku') : t('show_danmaku')}
                                    >
                                        <span className="text-[12px]">{t('danmaku_short')}</span>
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
                                        <Button
                                            onClick={() => setIsLibraryOpen(true)}
                                            size="icon"
                                            variant="outline"
                                            className="h-8 w-8 shrink-0 border-dashed border-muted-foreground/50 hover:border-primary/50"
                                            title={t('resource_library')}
                                        >
                                            <FolderSearch className="h-4 w-4" />
                                        </Button>
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
            {isLandscapeMobile && (
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
                                        <Button
                                            onClick={() => setIsLibraryOpen(true)}
                                            size="icon"
                                            variant="outline"
                                            className="h-8 w-8 shrink-0 border-dashed border-white/10 hover:border-primary/50"
                                            title={t('resource_library')}
                                        >
                                            <FolderSearch className="h-4 w-4" />
                                        </Button>
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
            )}
        </div>
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
