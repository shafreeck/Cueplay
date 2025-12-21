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
import { ModeToggle } from '@/components/mode-toggle';
import { ResourceLibrary } from '@/components/resource-library';
import { RoomHistory } from '@/utils/history';
import { Trash2, PlayCircle, Plus, Settings, Copy, Cast, Crown, Eye, MessageSquare, Send, GripVertical, Link2, Unlink, ArrowLeft, FolderSearch } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PlaylistItem {
    id: string;
    fileId: string;
    title?: string;
}

interface ChatMessage {
    id: string;
    senderId: string;
    senderName?: string;
    content: string;
    timestamp: number;
    isSystem?: boolean;
}

interface SortableItemProps {
    item: PlaylistItem;
    index: number;
    playingItemId: string | null;
    onPlay: (fileId: string, id: string) => void;
    onRemove: (id: string) => void;
}

function SortablePlaylistItem({ item, index, playingItemId, onPlay, onRemove }: SortableItemProps) {
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
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center justify-between p-2 rounded-md border transition-colors ${item.id === playingItemId ? 'bg-primary/20 border-primary/50' : 'bg-white/5 border-white/5 hover:bg-white/10'} ${isDragging ? 'opacity-50' : ''}`}
        >
            <div className="flex items-center flex-1 min-w-0 mr-2">
                <div {...attributes} {...listeners} className="cursor-grab hover:text-foreground text-muted-foreground mr-2 p-1">
                    <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                    <span className="text-sm font-medium truncate" title={item.title || item.fileId}>
                        {item.title || item.fileId}
                    </span>
                    {item.id === playingItemId && (
                        <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            Playing
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPlay(item.fileId, item.id)}>
                    <PlayCircle className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onRemove(item.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
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
    const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
    const [playingItemId, setPlayingItemId] = useState<string | null>(null);
    const [roomCookie, setRoomCookie] = useState(''); // Shared room cookie
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [nickname, setNickname] = useState('');
    const [resetConfirm, setResetConfirm] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);

    const [playbackRate, setPlaybackRate] = useState(1.0);
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

    // Sync Ref with State
    useEffect(() => { isSyncedRef.current = isSynced; }, [isSynced]);

    const addLog = (msg: string) => setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);

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
            // F key to toggle fullscreen
            if (e.key === 'f' || e.key === 'F') {
                if (!document.fullscreenElement && videoSrc) {
                    e.preventDefault();
                    toggleFullscreen();
                }
            }
            // ESC is handled natively by browser, but we can add custom handling if needed
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

        const handleTrackChange = () => {
            const tracks = video.textTracks;
            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                if (track.mode === 'showing') {
                    track.mode = 'hidden';
                    track.oncuechange = () => {
                        const activeCue = track.activeCues?.[0] as VTTCue;
                        setCurrentSubtitle(activeCue ? activeCue.text : '');
                    };
                }
            }
        };

        video.textTracks.onchange = handleTrackChange;
        video.addEventListener('loadedmetadata', handleTrackChange);
        handleTrackChange();
        const interval = setInterval(handleTrackChange, 2000);

        return () => {
            video.textTracks.onchange = null;
            video.removeEventListener('loadedmetadata', handleTrackChange);
            clearInterval(interval);
        };
    }, [videoSrc]); // Re-run when video source changes

    const resolveAndPlayWithoutSync = async (fid: string) => {
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
            setVideoSrc(finalUrl);
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
        setPlayingItemId(itemId || null); // Track playlist item

        addLog(`Resolving video ${fid}...`);
        try {
            const { source, cookie } = await ApiClient.resolveVideo(fid, roomId || '');
            console.log("Resolve result:", { hasSource: !!source, cookieLen: cookie?.length });

            setRawUrl(source.url); // Use raw URL for sharing
            if (source.meta?.duration) {
                setDuration(source.meta.duration);
            }

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
        const newPlaylist = playlist.filter(item => item.id !== id);
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
                // Clear local state immediately for better UX
                setFileId('');
                setRawUrl('');
                setVideoSrc('');
            }
        } else {
            addLog("WebSocket not open, playlist sync failed.");
        }
    };

    const handleAddFileFromLibrary = async (file: DriveFile) => {
        setIsResolving(true);
        try {
            // We have the ID and Name directly.
            // We resolve it just to ensure it's playable/valid and maybe get updated metadata.
            const { source } = await ApiClient.resolveVideo(file.id, roomId || '');
            const title = source.meta?.file_name || source.meta?.title || file.name || file.id;

            const newItem = { id: Math.random().toString(36).slice(2), fileId: file.id, title };
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

    const playNext = () => {
        if (playlist.length === 0) return;

        // Try getting by ID first, then fallback to fileId
        let currentIndex = -1;
        if (playingItemId) {
            currentIndex = playlist.findIndex(item => item.id === playingItemId);
        } else {
            currentIndex = playlist.findIndex(item => item.fileId === fileId);
        }

        if (currentIndex === -1) {
            addLog("Current video not found in playlist.");
            return;
        }

        const nextIndex = currentIndex + 1;

        if (nextIndex < playlist.length) {
            const nextItem = playlist[nextIndex];
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
                toast({
                    title: t('auto_play_blocked_title'),
                    description: t('auto_play_blocked_desc'),
                    variant: "destructive"
                })
            });
        }
    }, [videoSrc]);

    const sendState = useCallback(() => {
        const ws = socketRef.current;
        if (isRemoteUpdate.current || isLoadingSource.current || !videoRef.current || !ws || ws.readyState !== WebSocket.OPEN) return;

        // Enforce View Only: Only controller can broadcast state
        if (controllerIdRef.current && controllerIdRef.current !== currentUserId) {
            // Trace why this was called
            // console.warn("Blocked Sync", new Error().stack); 
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

        addLog(`Sending State: ${videoRef.current.currentTime.toFixed(1)}s`);
        ws.send(JSON.stringify({
            type: 'PLAYER_STATE',
            payload: {
                state: videoRef.current.paused ? 'paused' : 'playing',
                time: videoRef.current.currentTime,
                playbackRate: videoRef.current.playbackRate
            }
        }));
    }, [currentUserId]);

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

        const sendState = () => {
            // Debug Log
            // console.log("sendState check", { 
            //     isRemote: isRemoteUpdate.current, 
            //     video: !!videoRef.current, 
            //     ws: ws.readyState, 
            //     controller: controllerIdRef.current, 
            //     me: currentUserId 
            // });

            if (isRemoteUpdate.current || isLoadingSource.current || !videoRef.current || ws.readyState !== WebSocket.OPEN) return;

            // Enforce View Only: Only controller can broadcast state
            if (controllerIdRef.current && controllerIdRef.current !== currentUserId) {
                addLog(`Blocked Sync: I am ${currentUserId}, Controller is ${controllerIdRef.current}`);

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

            addLog(`Sending State: ${videoRef.current.currentTime.toFixed(1)}s`);
            ws.send(JSON.stringify({
                type: 'PLAYER_STATE',
                payload: {
                    state: videoRef.current.paused ? 'paused' : 'playing',
                    time: videoRef.current.currentTime,
                    playbackRate: videoRef.current.playbackRate
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
            if (data.type === 'MEDIA_CHANGE') {
                const { url, fileId: remoteFileId, provider, playingItemId: remotePlayingItemId } = data.payload;
                setFileId(remoteFileId || '');
                setRawUrl(url || '');
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
                    resolveAndPlayWithoutSync(remoteFileId);
                }
                setCurrentSubtitle('');

                // Sync playlist with room state if empty
                setPlaylist(prev => {
                    if (prev.length === 0 && remoteFileId) {
                        return [{ id: Math.random().toString(36).slice(2), fileId: remoteFileId, title: 'Current Video' }];
                    }
                    return prev;
                });

                // Fetch metadata for the synced item if we just added it
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
                const { members, ownerId, controllerId, quarkCookie } = data.payload;
                setMembers(members);
                setOwnerId(ownerId);
                setControllerId(controllerId);
                controllerIdRef.current = controllerId;
                if (quarkCookie !== undefined) setRoomCookie(quarkCookie);

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
                // Use Ref and calculate control status locally to avoid closure staleness
                const amIController = !controllerIdRef.current || controllerIdRef.current === userId;
                if (!amIController && !isSyncedRef.current) return;

                const { state, time, playbackRate } = data.payload;
                const now = video.currentTime;
                const drift = now - time;

                isRemoteUpdate.current = true;

                // 1. Hard Sync: State Mismatch or Large Drift
                const isStateMismatch = (state === 'playing' && video.paused) || (state === 'paused' && !video.paused);

                if (Math.abs(drift) > 2.0 || isStateMismatch) {
                    // console.log("Hard Sync", { drift, state, myState: video.paused ? 'paused' : 'playing' });
                    if (Math.abs(drift) > 0.5) { // Only seek if drift is significant to avoid stuttering on state changes
                        video.currentTime = time;
                    }
                    if (state === 'playing') video.play().catch(() => { });
                    else video.pause();

                    // Reset rate on hard sync
                    if (video.playbackRate !== playbackRate) {
                        video.playbackRate = playbackRate;
                    }
                }
                // 2. Soft Sync: Small Drift (Speed Adjustment)
                // Only if playing and no state mismatch
                else if (state === 'playing' && Math.abs(drift) > 0.15) {
                    // console.log("Soft Sync", { drift, currentRate: video.playbackRate });
                    const targetRate = playbackRate || 1.0;

                    if (drift > 0) {
                        // We are ahead -> Slow down
                        video.playbackRate = Math.max(0.5, targetRate - 0.1);
                    } else {
                        // We are behind -> Speed up
                        video.playbackRate = Math.min(2.0, targetRate + 0.1);
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
                addLog(`Received Playlist Update: ${newPlaylist ? newPlaylist.length : 'Invalid'} items`);
                if (newPlaylist) {
                    setPlaylist(newPlaylist);
                    toast({ description: t('playlist_updated') });
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
        const syncEvents = ['play', 'pause', 'seeked'];
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
        const interval = setInterval(() => {
            const ws = socketRef.current;
            const video = videoRef.current;
            if (ws && ws.readyState === WebSocket.OPEN && video) {
                // Only report if we have loaded a video
                if (!video.duration) return;

                // 1. Always report progress for UI (Member List)
                ws.send(JSON.stringify({
                    type: 'VIDEO_PROGRESS',
                    payload: { time: video.currentTime }
                }));

                // 2. If Controller, broadcast authoritative state for Active Sync
                // We do this here (periodic) to handle drift actively, not just on events.
                if (controllerIdRef.current === currentUserId) {
                    ws.send(JSON.stringify({
                        type: 'PLAYER_STATE',
                        payload: {
                            state: video.paused ? 'paused' : 'playing',
                            time: video.currentTime,
                            playbackRate: video.playbackRate
                        }
                    }));
                }
            }
        }, 1000); // 1s interval for better sync resolution
        return () => clearInterval(interval);
    }, [currentUserId]); // Depends on currentUserId to identify if I am controller



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
                                            <div className="pt-2 mt-2 border-t space-y-2">
                                                <Label className="text-[10px] font-bold text-primary uppercase tracking-wider">{t('room_setup_owner')}</Label>
                                                <div className="grid grid-cols-3 items-center gap-4">
                                                    <Label htmlFor="roomCookie" className="text-xs">{t('room_cookie')}</Label>
                                                    <Input
                                                        id="roomCookie"
                                                        value={roomCookie}
                                                        onChange={(e) => updateRoomCookie(e.target.value)}
                                                        className="col-span-2 h-7 text-xs"
                                                        placeholder={t('share_with_room')}
                                                        type="password"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground leading-tight">
                                                    {t('cookie_shared_desc')}
                                                </p>
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
                                controlsList="nofullscreen"
                                crossOrigin="anonymous"
                                autoPlay
                                className="w-full h-full object-contain"
                                src={videoSrc}
                                onEnded={playNext}
                            >
                                Your browser does not support video playback.
                            </video>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center animate-pulse">
                                    ▶
                                </div>
                                <p className="text-sm font-medium">{t('enter_quark_link')}</p>
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
                        <Tabs defaultValue="playlist" className="flex flex-col h-full">
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

                            <CardContent className="flex-1 overflow-hidden p-0 bg-transparent block">
                                <TabsContent value="playlist" className="flex-1 flex flex-col min-h-0 m-0">
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
                                        {playlist.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
                                                <p>{t('queue_empty')}</p>
                                                <p className="text-xs opacity-70">{t('add_videos_hint')}</p>
                                            </div>
                                        )}
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
                                    </div>
                                </TabsContent>

                                <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 m-0">
                                    <div ref={chatListRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {messages.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 gap-2">
                                                <MessageSquare className="h-8 w-8" />
                                                <p className="text-sm">{t('no_messages_yet')}</p>
                                            </div>
                                        )}
                                        {messages.map((msg) => {
                                            const isMe = msg.senderId === currentUserId;
                                            const isSystem = msg.isSystem;

                                            if (isSystem) {
                                                return (
                                                    <div key={msg.id} className="flex justify-center my-2">
                                                        <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded-full">{msg.content}</span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                    <div className="flex items-end gap-2 max-w-[85%]">
                                                        {!isMe && (
                                                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] shrink-0 font-bold border border-white/10">
                                                                {msg.senderName?.slice(0, 1).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div
                                                            className={`px-3 py-2 rounded-2xl text-sm break-words shadow-sm ${isMe
                                                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                                                : 'bg-muted text-foreground rounded-bl-none'
                                                                }`}
                                                        >
                                                            {msg.content}
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground mt-1 px-1 opacity-70">
                                                        {!isMe && <span className="mr-1">{msg.senderName}</span>}
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            );
                                        })}
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

                                <TabsContent value="members" className="flex-1 flex flex-col min-h-0 m-0">
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                            {members.length === 0 && (
                                                <div className="text-center text-muted-foreground text-sm opacity-70 mt-4">{t('no_members_info')}</div>
                                            )}
                                            {members.map((m: any) => {
                                                if (!m || !m.userId) return null;
                                                // Generate consistent color from userId
                                                const hash = m.userId.split('').reduce((acc: number, char: string) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
                                                const colors = [
                                                    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
                                                    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
                                                    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
                                                    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
                                                ];
                                                const colorClass = colors[Math.abs(hash) % colors.length];
                                                const displayName = m.name || m.userId;
                                                const initial = displayName.slice(0, 1).toUpperCase();

                                                // Sync Calculation
                                                const controllerMember = members.find((mem: any) => mem.userId === controllerId);
                                                const targetTime = controllerMember?.currentProgress || 0;
                                                const myTime = m.currentProgress || 0;
                                                const diff = Math.abs(myTime - targetTime);
                                                const isUnsync = diff > 2; // Tolerance 2s

                                                let progressColor = 'bg-emerald-500/80';
                                                if (diff > 15) progressColor = 'bg-red-900/90';
                                                else if (diff > 5) progressColor = 'bg-red-600/90';
                                                else if (diff > 2) progressColor = 'bg-yellow-500/90';

                                                // Progress Percentage
                                                const duration = videoRef.current?.duration || 1;
                                                const percent = Math.min(100, Math.max(0, (myTime / duration) * 100));

                                                return (
                                                    <div key={m.userId} className="relative flex items-center justify-between p-2 rounded-md border bg-card/50 overflow-hidden">
                                                        <div className="flex items-center gap-3 relative z-10">
                                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${colorClass} bg-opacity-90`}>
                                                                {initial}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-medium leading-none">
                                                                        {m.userId === currentUserId ? `${displayName} (${t('you')})` : displayName}
                                                                    </span>
                                                                    <div className={`h-1.5 w-1.5 rounded-full ${m.isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-zinc-700'}`} title={m.isOnline ? t('online') : t('offline')} />
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    {m.name && <span className="text-[10px] text-muted-foreground font-mono leading-none opacity-70">{m.userId}</span>}
                                                                    {/* Diff Debug text can be added here if needed */}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 relative z-10">
                                                            {m.userId === controllerId && <span title="Controlling"><Cast className="h-4 w-4 text-primary animate-pulse" /></span>}
                                                            {m.userId === ownerId && <span title="Owner"><Crown className="h-3 w-3 text-yellow-500" /></span>}
                                                        </div>

                                                        {/* Progress Bar Background */}
                                                        {m.isOnline && m.currentProgress !== undefined && (
                                                            <div
                                                                className={`absolute bottom-0 left-0 h-0.5 transition-all duration-1000 ease-linear ${progressColor}`}
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        )}
                                                    </div>
                                                )
                                            })}
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
                    cookie={roomCookie}
                    onAdd={handleAddFileFromLibrary}
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


