'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from 'react-i18next';
import { ApiClient, DriveFile } from '@/api/client';
import { WS_BASE, getProxyBase } from '@/api/config';
import { LanguageToggle } from '@/components/language-toggle';
import { QuarkLoginDialog } from '@/components/quark-login-dialog';
import { ResourceLibrary } from '@/components/resource-library';
import { RoomHistory } from '@/utils/history';
import { Trash2, PlayCircle, Plus, Settings, Copy, Cast, Crown, Eye, MessageSquare, Send, GripVertical, Link2, Unlink, ArrowLeft, FolderSearch, QrCode, ChevronDown, ChevronRight, Folder, Loader2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { PlaylistItem, ChatMessage } from './types';
import { PlaylistItemRenderer } from './components/playlist-item';
import { ChatMessageItem } from './components/chat-message-item';
import { MemberItem } from './components/member-item';

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

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
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
                isMobile={false}
            />
        </div>
    );
}

import { MobileRoomLayout } from './mobile-layout';
import { useIsMobile } from '@/hooks/use-mobile';

// Helper to check if playlist structure changed (ignoring progress/metadata updates)
const isPlaylistStructureDifferent = (a: PlaylistItem[], b: PlaylistItem[]): boolean => {
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id) return true;

        // Check children recursively for folders
        if (a[i].children && b[i].children) {
            if (isPlaylistStructureDifferent(a[i].children, b[i].children)) return true;
        } else if (!!a[i].children !== !!b[i].children) {
            // One has children, the other doesn't
            return true;
        }
    }
    return false;
}

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
    const [roomCookie, setRoomCookie] = useState(''); // Shared room cookie
    const [hasGlobalCookie, setHasGlobalCookie] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [nickname, setNickname] = useState('');
    const [resetConfirm, setResetConfirm] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [showQuarkLogin, setShowQuarkLogin] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);

    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [isRoomLoading, setIsRoomLoading] = useState(true);
    const isMobile = useIsMobile();
    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isSynced, setIsSynced] = useState(true);
    const [chatInput, setChatInput] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const chatListRef = useRef<HTMLDivElement>(null);

    const socketRef = useRef<WebSocket | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isRemoteUpdate = useRef(false);
    const isLoadingSource = useRef(false);
    const lastTimeRef = useRef(0);
    const isSyncedRef = useRef(isSynced);
    const lastMinAgeRef = useRef<number>(Number.MAX_SAFE_INTEGER);
    const lastResumedItemIdRef = useRef<string | null>(null);

    // Sync Ref with State
    useEffect(() => {
        isSyncedRef.current = isSynced;
        // Reset min age on sync toggle to recalibrate
        if (isSynced) lastMinAgeRef.current = Number.MAX_SAFE_INTEGER;
    }, [isSynced]);

    // Auto-save progress
    useEffect(() => {
        const interval = setInterval(() => {
            const video = videoRef.current;
            // Only save if we have successfully resumed the current item
            // This prevents overwriting server progress with 0 on reload
            if (video && video.duration && !video.paused && playingItemId) {
                if (lastResumedItemIdRef.current !== playingItemId) {
                    return;
                }
                setPlaylist(prev => {
                    let updated = false;
                    const updateProgress = (list: PlaylistItem[]): PlaylistItem[] => {
                        return list.map(item => {
                            if (item.id === playingItemId) {
                                if (Math.abs((item.progress || 0) - video.currentTime) > 1) { // Only update if drift > 1s
                                    updated = true;
                                    return { ...item, progress: video.currentTime, duration: video.duration };
                                }
                                return item;
                            }
                            if (item.children) {
                                const newChildren = updateProgress(item.children);
                                if (updated) return { ...item, children: newChildren };
                            }
                            return item;
                        });
                    };

                    const newPlaylist = updateProgress(prev);
                    if (updated && socketRef.current?.readyState === WebSocket.OPEN) {
                        socketRef.current.send(JSON.stringify({
                            type: 'PLAYLIST_UPDATE',
                            payload: { playlist: newPlaylist }
                        }));
                    }
                    return updated ? newPlaylist : prev;
                });
            }
        }, 5000); // Save every 5s
        return () => clearInterval(interval);
    }, [playingItemId]);

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

    // Resume progress when playlist is loaded/updated or video source changes
    useEffect(() => {
        if (!playingItemId || !playlist.length || !videoRef.current || !videoSrc) return;
        if (lastResumedItemIdRef.current === playingItemId) return;

        const video = videoRef.current;
        const item = findPlaylistItem(playlist, playingItemId);
        if (!item) return;

        if (item.progress !== undefined) {
            const doResume = () => {
                if (lastResumedItemIdRef.current === playingItemId) return;

                addLog(`[Resume] Attempting seek to ${item.progress!.toFixed(1)}s (ReadyState: ${video.readyState}, Src: ${video.src.slice(-30)})`);
                video.currentTime = item.progress!;

                // Seek confirmation loop (Retry up to 10 times)
                let attempts = 0;
                const verifySeek = () => {
                    attempts++;
                    const drift = Math.abs(video.currentTime - (item.progress || 0));
                    if (drift < 2) {
                        addLog(`[Resume] Confirmed at ${video.currentTime.toFixed(1)}s`);
                        lastResumedItemIdRef.current = playingItemId;
                    } else if (attempts < 10) {
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
    };

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

    // Double-click to toggle fullscreen
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleDoubleClick = (e: MouseEvent) => {
            // Prevent double-click text selection
            e.preventDefault();
            toggleFullscreen();
        };

        container.addEventListener('dblclick', handleDoubleClick);

        return () => {
            container.removeEventListener('dblclick', handleDoubleClick);
        };
    }, []);

    // Subtitle Hijacking Logic
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Clear subtitle when video changes
        setCurrentSubtitle('');

        // Manage tracks: In native fullscreen, we show native tracks. In all other cases, we hide them and use Custom Overlay.
        const handleTrackChange = () => {
            // Check if we are in Native Fullscreen (Video is the fullscreen element)
            const isNativeFullscreen = document.fullscreenElement === video;
            const tracks = video.textTracks;

            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                if (track.mode === 'disabled') continue;

                // If native fullscreen: Force SHOWING
                // If not native fullscreen (Windowed or Container FS): Force HIDDEN (so we use overlay)
                const shouldBeShowing = isNativeFullscreen;

                if (shouldBeShowing) {
                    if (track.mode === 'hidden') track.mode = 'showing';
                } else {
                    if (track.mode === 'showing') track.mode = 'hidden';
                }
            }
        };

        const handleFullscreenChange = () => {
            handleTrackChange();
        };

        // Check current active cues and update subtitle on every timeupdate
        const updateCurrentSubtitle = () => {
            // Don't update custom overlay if in native fullscreen (optimization)
            if (document.fullscreenElement === video) {
                if (currentSubtitle) setCurrentSubtitle('');
                return;
            }

            const tracks = video.textTracks;
            let hasActiveCue = false;
            const currentTime = video.currentTime;

            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];

                if (track.mode === 'hidden' && track.activeCues && track.activeCues.length > 0) {
                    const activeCue = track.activeCues[0] as VTTCue;
                    const cueDisplayDuration = currentTime - activeCue.startTime;

                    // Check if subtitle has been displayed for too long
                    // This handles cases where browser sets endTime to video duration during progressive loading
                    if (cueDisplayDuration > MAX_SUBTITLE_DURATION) {
                        setCurrentSubtitle('');
                    } else {
                        setCurrentSubtitle(activeCue.text);
                        hasActiveCue = true;
                    }
                    break;
                }
            }

            // Clear subtitle if no active cue
            if (!hasActiveCue) {
                setCurrentSubtitle('');
            }
        };

        video.textTracks.onchange = handleTrackChange;
        video.addEventListener('loadedmetadata', handleTrackChange);
        video.addEventListener('timeupdate', updateCurrentSubtitle);
        // Also listen to document fullscreen changes to toggle modes
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        handleTrackChange();
        const interval = setInterval(handleTrackChange, 2000);

        return () => {
            video.textTracks.onchange = null;
            video.removeEventListener('loadedmetadata', handleTrackChange);
            video.removeEventListener('timeupdate', updateCurrentSubtitle);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            clearInterval(interval);
        };
    }, [videoSrc]); // Re-run when video source changes

    const resolveAndPlayWithoutSync = async (fid: string, itemId?: string) => {
        if (itemId) {
            lastResumedItemIdRef.current = null; // Prepare for resume
            setPlayingItemId(itemId);
        }

        try {
            const { source, cookie } = await ApiClient.resolveVideo(fid, roomId || '');
            setRawUrl(source.url);
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
            setVideoSrc(finalUrl);
            if (itemId) {
                addLog(`Resolving synced video: ${fid} (item: ${itemId})`);
            }
        } catch (e) {
            console.error("resolveAndPlayWithoutSync error:", e);
        }
    }

    const resolveAndPlay = async (targetFileId: string, itemId?: string) => {
        if (!targetFileId) return;
        let fid = targetFileId;
        const urlMatch = targetFileId.match(/video\/([a-zA-Z0-9]+)/);
        if (urlMatch) fid = urlMatch[1];

        setFileId(fid); // Sync internal state
        lastResumedItemIdRef.current = null; // Prepare for resume
        setPlayingItemId(itemId || null); // Track playlist item
        setVideoSrc(''); // Clear current source to force re-render/resume

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

        addLog(`Resolving video ${fid}...`);
        try {
            const { source, cookie } = await ApiClient.resolveVideo(fid, roomId || '');
            console.log("Resolve result:", { hasSource: !!source, cookieLen: cookie?.length });

            setRawUrl(source.url); // Use raw URL for sharing
            if (source.meta?.duration) {
                setDuration(source.meta.duration);
            }

            // Sync with others
            if (socketRef.current?.readyState === WebSocket.OPEN) {
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
        } catch (e: any) {
            console.error(e);
            toast({
                variant: "destructive",
                title: t('failed_resolve_title'),
                description: e.message || t('unknown_error'),
            });
            addLog(`Resolve error: ${e.message}`);
        }
    }

    const [isResolving, setIsResolving] = useState(false);

    // Playlist Logic
    // Playlist Logic
    const addToPlaylist = async () => {
        if (!inputValue || isResolving) return;
        setIsResolving(true);
        let fid = inputValue;
        const urlMatch = inputValue.match(/video\/([a-zA-Z0-9]+)/);
        if (urlMatch) fid = urlMatch[1];

        try {
            // Resolve first to validate
            const { source } = await ApiClient.resolveVideo(fid, roomId || '');
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
            console.error(e);
            toast({
                variant: "destructive",
                title: t('invalid_video_title'),
                description: `Could not resolve video: ${e.message}`
            });
        } finally {
            setIsResolving(false);
        }
    };

    const removeFromPlaylist = (id: string) => {
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
        setIsResolving(true);
        try {
            const { source } = await ApiClient.resolveVideo(file.id, roomId || '');
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
            console.error(e);
            toast({
                variant: "destructive",
                title: t('invalid_video_title'),
                description: `Could not resolve video: ${e.message}`
            });
        } finally {
            setIsResolving(false);
        }
    };

    const handleAddSeriesFromLibrary = (folder: DriveFile, files: DriveFile[]) => {
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

        const sendStateLocal = () => {
            if (isRemoteUpdate.current || isLoadingSource.current || !videoRef.current || ws.readyState !== WebSocket.OPEN) return;

            // Enforce View Only: Only controller can broadcast state
            if (controllerIdRef.current && controllerIdRef.current !== currentUserId) {
                addLog(`Blocked Sync: I am ${currentUserId}, Controller is ${controllerIdRef.current}`);
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
        };

        ws.onopen = () => {
            const payload = { roomId: roomId || '', userId, name };
            console.log("JOIN_ROOM Payload:", payload); // Debug log
            ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload }));
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'error') {
                const isRoomNotFound = data.payload.msg === 'Room not found';
                toast({
                    variant: "destructive",
                    title: t('error'),
                    description: isRoomNotFound ? t('room_not_found') : data.payload.msg
                });
                if (isRoomNotFound) {
                    router.push('/');
                }
                return;
            }
            if (data.type === 'MEDIA_CHANGE') {
                const { url, fileId: remoteFileId, provider, playingItemId: remotePlayingItemId } = data.payload;
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
                    ApiClient.resolveVideo(remoteFileId, roomId || '').then(({ source }) => {
                        setPlaylist(prev => prev.map(item =>
                            item.fileId === remoteFileId && item.title === 'Current Video'
                                ? { ...item, title: source.meta?.file_name || source.meta?.title || remoteFileId }
                                : item
                        ));
                    }).catch(() => { });
                }

                // ... inside RoomContent component ...

            } else if (data.type === 'ROOM_UPDATE') {
                const { members, ownerId, controllerId, quarkCookie, hasGlobalCookie } = data.payload;
                setMembers(members);
                setOwnerId(ownerId);
                setControllerId(controllerId);
                controllerIdRef.current = controllerId;
                if (quarkCookie !== undefined) setRoomCookie(quarkCookie);
                if (hasGlobalCookie !== undefined) setHasGlobalCookie(hasGlobalCookie);

                setIsRoomLoading(false);

                // Add to visited history
                if (roomId && ownerId) {
                    RoomHistory.addVisitedRoom({
                        id: roomId,
                        ownerId: ownerId,
                        members: members || []
                    });
                }
            } else if (data.type === 'PLAYER_STATE') {
                const video = videoRef.current;
                if (!video) return;

                // Independent Mode: Viewer disabled sync
                const amIController = !controllerIdRef.current || controllerIdRef.current === userId;
                if (!amIController && !isSyncedRef.current) return;

                const { state, time, playbackRate, sentAt } = data.payload;

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
                const isStateMismatch = (state === 'playing' && video.paused) || (state === 'paused' && !video.paused);

                if (Math.abs(drift) > 3.0 || isStateMismatch) {
                    // console.log("Hard Sync", { drift, state });
                    if (Math.abs(drift) > 0.5) { // Minimum seek threshold
                        video.currentTime = compensatedTime;
                    }
                    if (state === 'playing') video.play().catch(() => { });
                    else video.pause();

                    // Reset rate on hard sync
                    if (video.playbackRate !== playbackRate) {
                        video.playbackRate = playbackRate;
                    }
                }
                // 2. Soft Sync: Small/Medium Drift (Speed Adjustment)
                // We prefer this over Hard Sync to maintain smoothness.
                else if (state === 'playing' && Math.abs(drift) > 0.1) {
                    const targetRate = playbackRate || 1.0;
                    if (drift > 0) {
                        // We are ahead -> Slow down
                        // 0.1 - 0.5s drift: -0.05 speed
                        // 0.5s - 3.0s drift: -0.15 speed
                        const factor = drift > 0.5 ? 0.15 : 0.05;
                        video.playbackRate = Math.max(0.25, targetRate - factor);
                    } else {
                        // We are behind -> Speed up
                        // 0.1 - 0.5s drift: +0.05 speed
                        // 0.5s - 3.0s drift: +0.15 speed
                        const factor = drift < -0.5 ? 0.15 : 0.05;
                        video.playbackRate = Math.min(4.0, targetRate + factor);
                    }
                }
                // 3. Stabilize
                else {
                    if (playbackRate && Math.abs(video.playbackRate - playbackRate) > 0.01) {
                        video.playbackRate = playbackRate;
                    }
                }

                // Debounce the remote update flag
                // We use a shorter timeout because soft sync (rate change) doesn't trigger 'seeked' but might trigger 'ratechange'
                // The 'seeked' event is the dangerous one for loops.
                setTimeout(() => { isRemoteUpdate.current = false; }, 500);
            } else if (data.type === 'PLAYLIST_UPDATE') {
                const { playlist: newPlaylist } = data.payload;
                addLog(`Received Playlist Update: ${newPlaylist ? newPlaylist.length : 'Invalid'} items (playing: ${playingItemId})`);
                if (newPlaylist) {
                    const isStructureChanged = isPlaylistStructureDifferent(playlistRef.current, newPlaylist);
                    setPlaylist(newPlaylist);
                    if (isStructureChanged) {
                        toast({ description: t('playlist_updated') });
                    }
                }
            } else if (data.type === 'CHAT_MESSAGE') {
                const message = data.payload;
                setMessages(prev => {
                    if (prev.some(m => m.id === message.id)) return prev;
                    return [...prev, message];
                });
            }
        };

        return () => {
            ws.close();
        };
    }, [roomId]);

    const canControl = !controllerId || controllerId === currentUserId;
    const isOwner = currentUserId && ownerId && currentUserId === ownerId;

    // Bind Video Events (Only if authorized to control)
    useEffect(() => {
        if (!canControl) return;

        const video = videoRef.current;
        const syncEvents = ['play', 'pause', 'seeked', 'ratechange'];
        const handleSync = (e: Event) => {
            if (e.isTrusted && !isRemoteUpdate.current && !isLoadingSource.current) {
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
                        payload: { time: video.currentTime, sentAt: now }
                    }));
                    lastProgressSent = now;
                }

                // 2. If Controller, broadcast authoritative state for Active Sync
                // We do this every 1s to maintain tight sync.
                if (controllerIdRef.current === currentUserId) {
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
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
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


    if (isMobile) {
        return (
            <>
                <MobileRoomLayout
                    roomId={roomId}
                    videoRef={videoRef}
                    containerRef={containerRef}
                    videoSrc={videoSrc}
                    playlist={playlist}
                    playingItemId={playingItemId}
                    messages={messages}
                    members={members}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    sendChatMessage={sendChatMessage}
                    onPlay={resolveAndPlay}
                    onRemoveFromPlaylist={removeFromPlaylist}
                    addToPlaylist={addToPlaylist}
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    toggleFullscreen={toggleFullscreen}
                    setIsLibraryOpen={setIsLibraryOpen}
                    onEnded={playNext}
                    isResolving={isResolving}
                    currentUserId={currentUserId}
                    ownerId={ownerId}
                    controllerId={controllerId}
                />
                <ResourceLibrary
                    open={isLibraryOpen}
                    onOpenChange={setIsLibraryOpen}
                    cookie={roomCookie || undefined}
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
            </>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background text-foreground">
            <header className="sticky top-4 z-50 px-4 mb-6 pointer-events-none">
                <div className="container mx-auto h-14 rounded-full flex items-center justify-between gap-4 px-6 bg-black/40 backdrop-blur-2xl border border-white/5 shadow-2xl pointer-events-auto">
                    <div className="flex items-center gap-2 overflow-hidden shrink-0">
                        <Link href="/">
                            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                {t('rooms')}
                            </Button>
                        </Link>
                        <h1 className="text-xl font-bold truncate">{t('room_title', { id: roomId })}</h1>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            navigator.clipboard.writeText(roomId || '');
                            toast({ description: t('room_id_copied') });
                        }}>
                            <Copy className="h-3 w-3" />
                        </Button>
                        <div
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all duration-300 ${canControl
                                ? 'bg-primary/50 text-white border-primary/50 shadow-[0_0_15px_rgba(124,58,237,0.25)] cursor-default'
                                : 'bg-muted/50 text-muted-foreground border-white/10 hover:bg-muted hover:text-foreground cursor-pointer'
                                }`}
                            onClick={() => {
                                if (!canControl && socketRef.current?.readyState === WebSocket.OPEN) {
                                    socketRef.current.send(JSON.stringify({ type: 'TAKE_CONTROL', payload: { roomId: roomId || '' } }));
                                    toast({ title: t('control_requested_title'), description: t('control_requested_desc') });
                                }
                            }}
                            title={!canControl ? t('click_to_take_control') : t('you_have_control')}
                        >
                            {canControl ? (
                                <>
                                    <Cast className="h-3.5 w-3.5" />
                                    <span>{t('controlling')}</span>
                                </>
                            ) : (
                                <>
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>{t('viewing')}</span>
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
                        <Popover>
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
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <Label htmlFor="nickname">{t('display_name')}</Label>
                                            <Input
                                                id="nickname"
                                                value={nickname}
                                                onChange={(e) => saveNickname(e.target.value)}
                                                placeholder={t('enter_display_name')}
                                                className="col-span-2 h-8"
                                            />
                                        </div>
                                        {isOwner && (
                                            <div className="pt-2 mt-2 border-t space-y-3">
                                                <Label className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('cloud_storage')}</Label>

                                                <div className="bg-muted/30 rounded-lg p-3 border border-white/5 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`h-2 w-2 rounded-full ${roomCookie ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : (hasGlobalCookie ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-zinc-600')}`} />
                                                            <span className="text-xs font-medium text-foreground">
                                                                {roomCookie ? t('quark_drive_connected') : (hasGlobalCookie ? t('using_global_connection') : t('quark_drive_disconnected'))}
                                                            </span>
                                                        </div>
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

                                                    <Button
                                                        variant={roomCookie ? "outline" : "default"}
                                                        size="sm"
                                                        className="w-full h-8 text-xs gap-2"
                                                        onClick={() => setShowQuarkLogin(true)}
                                                    >
                                                        <QrCode className="h-3.5 w-3.5" />
                                                        {roomCookie ? t('reconnect_login') : t('login_quark_scan')}
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
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="w-full">{t('view_debug_logs')}</Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl h-[500px] flex flex-col">
                                                <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 font-mono text-xs rounded-md border">
                                                    {logs.map((log, i) => (
                                                        <div key={i} className="text-emerald-400 border-b border-white/5 pb-1 mb-1">
                                                            {log}
                                                        </div>
                                                    ))}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                        <Button
                                            variant={resetConfirm ? "destructive" : "secondary"}
                                            size="sm"
                                            className="w-full"
                                            onClick={() => {
                                                if (!resetConfirm) {
                                                    setResetConfirm(true);
                                                    setTimeout(() => setResetConfirm(false), 3000);
                                                    return;
                                                }
                                                localStorage.removeItem('cueplay_userid');
                                                toast({ title: t('identity_reset_title'), description: t('identity_reset_desc') });
                                                setTimeout(() => window.location.reload(), 500);
                                            }}
                                        >
                                            {resetConfirm ? t('click_confirm_reset') : t('reset_identity')}
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
                {/* Video Section */}
                <div className="lg:col-span-3 space-y-4">
                    <div
                        ref={containerRef}
                        className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group border border-white/10 transition-all duration-300 ring-1 ring-white/5"
                    >
                        {videoSrc ? (
                            <video
                                key={videoSrc}
                                ref={videoRef}
                                controls
                                autoPlay
                                className="w-full h-full object-contain"
                                src={videoSrc}
                                onEnded={playNext}
                            >
                                Your browser does not support video playback.
                            </video>
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
                                className="absolute bottom-20 left-0 right-0 pointer-events-none z-20"
                                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                            >
                                <div
                                    className="bg-black/50 text-white px-6 py-2 rounded-lg text-lg lg:text-3xl shadow-2xl border border-white/10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                                    style={{
                                        textAlign: 'center',
                                        display: 'inline-block',
                                        maxWidth: '90%',
                                        wordWrap: 'break-word'
                                    }}
                                >
                                    {currentSubtitle.split('\n').map((line, i) => (
                                        <div key={i} style={{ textAlign: 'center' }}>{line}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <aside className="space-y-6">
                    <Card className="flex flex-col h-[500px] lg:h-[calc(100vh-12rem)] shadow-2xl overflow-hidden glass border-white/5">
                        <Tabs defaultValue="playlist" className="flex flex-col flex-1 min-h-0">
                            <CardHeader className="py-4 px-4 border-b border-white/5 bg-transparent">
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

                                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
                                    <div ref={chatListRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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
                                    <div className="p-3 border-t bg-muted/20">
                                        <form onSubmit={sendChatMessage} className="flex gap-2">
                                            <Input
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                placeholder={t('type_message')}
                                                className="flex-1 h-9 bg-background/50"
                                            />
                                            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!chatInput.trim()}>
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </form>
                                    </div>
                                </TabsContent>

                                <TabsContent value="members" className="flex-1 data-[state=active]:flex data-[state=active]:flex-col min-h-0 m-0">
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
                        </Tabs>
                    </Card>
                </aside>
                <ResourceLibrary
                    open={isLibraryOpen}
                    onOpenChange={setIsLibraryOpen}
                    cookie={roomCookie || undefined}
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


