'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ApiClient } from '@/api/client';
import { ModeToggle } from '@/components/mode-toggle';
import { Trash2, PlayCircle, Plus, Settings, Copy, Cast, Crown, Eye, MessageSquare, Send, GripVertical } from 'lucide-react';
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
            className={`group flex items-center justify-between p-2 rounded-md border transition-colors ${item.id === playingItemId ? 'bg-accent border-primary/50' : 'bg-card border-border/50 hover:bg-accent'} ${isDragging ? 'opacity-50' : ''}`}
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

export default function RoomDetail() {
    const params = useParams();
    const roomId = params.id as string;
    const { toast } = useToast();
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
    const [cookie, setCookie] = useState('');
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
    const [playingItemId, setPlayingItemId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [nickname, setNickname] = useState('');
    const [resetConfirm, setResetConfirm] = useState(false);

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatListRef = useRef<HTMLDivElement>(null);

    const socketRef = useRef<WebSocket | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isRemoteUpdate = useRef(false);
    const isLoadingSource = useRef(false);
    const cookieRef = useRef(cookie);
    const lastTimeRef = useRef(0);

    const addLog = (msg: string) => setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // Update cookie ref for the proxy requests
    useEffect(() => {
        cookieRef.current = cookie;
    }, [cookie]);

    // Load/Save Cookie & Nickname
    useEffect(() => {
        const stored = localStorage.getItem('quark_cookie');
        if (stored) {
            setCookie(stored);
            cookieRef.current = stored;
        }
        const storedName = localStorage.getItem('cueplay_nickname');
        if (storedName) setNickname(storedName);
    }, []);

    const saveCookie = (val: string) => {
        setCookie(val);
        localStorage.setItem('quark_cookie', val);
    };

    const saveNickname = (val: string) => {
        setNickname(val);
        localStorage.setItem('cueplay_nickname', val);
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

    // Construct and Load Source
    useEffect(() => {
        if (!rawUrl) return;
        const proxyUrl = `http://localhost:3001/api/stream/proxy?url=${encodeURIComponent(rawUrl)}&cookie=${encodeURIComponent(cookieRef.current || '')}`;
        isLoadingSource.current = true; // Block sync during load
        setVideoSrc(proxyUrl);
        // addLog(`Source updated: ${proxyUrl}`);
        // Reset loading state after a safety delay or on 'canplay'
        setTimeout(() => { isLoadingSource.current = false; }, 2000);
    }, [rawUrl]);



    useEffect(() => {
        addLog(`Fullscreen Enabled: ${document.fullscreenEnabled}`);
    }, []);

    // Subtitle Hijacking Logic
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

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
        const interval = setInterval(handleTrackChange, 2000);
        return () => {
            video.textTracks.onchange = null;
            clearInterval(interval);
        };
    }, []);

    const resolveAndPlay = async (targetFileId: string, itemId?: string) => {
        if (!targetFileId) return;
        let fid = targetFileId;
        const urlMatch = targetFileId.match(/video\/([a-zA-Z0-9]+)/);
        if (urlMatch) fid = urlMatch[1];

        if (urlMatch) fid = urlMatch[1];

        setFileId(fid); // Sync internal state
        setPlayingItemId(itemId || null); // Track playlist item

        addLog(`Resolving video ${fid}...`);
        try {
            const source = await ApiClient.resolveVideo(fid, cookieRef.current);
            setRawUrl(source.url);
            if (source.meta?.duration) {
                setDuration(source.meta.duration);
            }

            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                    type: 'MEDIA_CHANGE',
                    payload: { fileId: fid, url: source.url, provider: 'quark' }
                }));
            }
        } catch (e: any) {
            console.error(e);
            toast({
                variant: "destructive",
                title: "Failed to resolve video",
                description: e.message || "Unknown error occurred",
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
            const source = await ApiClient.resolveVideo(fid, cookieRef.current);
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
                title: "Added to Queue",
                description: `Video ${title} added to playlist.`
            });
            addLog(`Added to playlist: ${fid}`);
            setInputValue(''); // Clear input only on success
        } catch (e: any) {
            console.error(e);
            toast({
                variant: "destructive",
                title: "Invalid Video",
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
                    title: "Auto-play Blocked",
                    description: "Please click play manually.",
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
                    title: "View Only Mode",
                    description: `You must "Take Control" to playback actions.`,
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
        const wsUrl = 'ws://localhost:3000/ws';
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
                        title: "View Only Mode",
                        description: `You must "Take Control" to playback actions.`,
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
            const payload = { roomId, userId, name };
            console.log("JOIN_ROOM Payload:", payload); // Debug log
            ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload }));
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'MEDIA_CHANGE') {
                const { url, fileId: remoteFileId, provider } = data.payload;
                setFileId(remoteFileId || '');
                setRawUrl(url || '');
                if (!remoteFileId) setVideoSrc('');
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
                    ApiClient.resolveVideo(remoteFileId, cookieRef.current).then(source => {
                        setPlaylist(prev => prev.map(item =>
                            item.fileId === remoteFileId && item.title === 'Current Video'
                                ? { ...item, title: source.meta?.file_name || source.meta?.title || remoteFileId }
                                : item
                        ));
                    }).catch(() => { });
                }

            } else if (data.type === 'ROOM_UPDATE') {
                const { members, ownerId, controllerId } = data.payload;
                setMembers(members);
                setOwnerId(ownerId);
                setControllerId(controllerId);
                controllerIdRef.current = controllerId;
            } else if (data.type === 'PLAYER_STATE') {
                const video = videoRef.current;
                if (!video) return;
                const { state, time } = data.payload;
                isRemoteUpdate.current = true;
                if (Math.abs(video.currentTime - time) > 0.8) {
                    video.currentTime = time;
                }
                if (state === 'playing' && video.paused) {
                    video.play().catch(() => { });
                } else if (state === 'paused' && !video.paused) {
                    video.pause();
                }
                setTimeout(() => { isRemoteUpdate.current = false; }, 500);
            } else if (data.type === 'PLAYLIST_UPDATE') {
                const { playlist: newPlaylist } = data.payload;
                addLog(`Received Playlist Update: ${newPlaylist ? newPlaylist.length : 'Invalid'} items`);
                if (newPlaylist) {
                    setPlaylist(newPlaylist);
                    toast({ description: "Playlist updated" });
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
    useEffect(() => {
        const interval = setInterval(() => {
            const ws = socketRef.current;
            const video = videoRef.current;
            if (ws && ws.readyState === WebSocket.OPEN && video) {
                // Only report if we have loaded a video
                if (!video.duration) return;

                ws.send(JSON.stringify({
                    type: 'VIDEO_PROGRESS',
                    payload: { time: video.currentTime }
                }));
            }
        }, 2000);
        return () => clearInterval(interval);
    }, []);



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
        <div className="min-h-screen bg-background text-foreground">
            <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-10">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-hidden shrink-0">
                        <Link href="/">
                            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">← Rooms</Button>
                        </Link>
                        <h1 className="text-xl font-bold truncate">Room: {roomId}</h1>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            navigator.clipboard.writeText(roomId);
                            toast({ description: "Room ID copied to clipboard" });
                        }}>
                            <Copy className="h-3 w-3" />
                        </Button>
                        <div
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${canControl
                                ? 'bg-primary/10 text-primary border-primary/20 cursor-default'
                                : 'bg-muted/50 text-muted-foreground border-border/50 cursor-pointer hover:bg-muted hover:text-foreground'
                                }`}
                            onClick={() => {
                                if (!canControl && socketRef.current?.readyState === WebSocket.OPEN) {
                                    socketRef.current.send(JSON.stringify({ type: 'TAKE_CONTROL', payload: { roomId } }));
                                    toast({ title: "Control Requested", description: "Taking over playback control." });
                                }
                            }}
                            title={!canControl ? "Click to Take Control" : "You have control"}
                        >
                            {canControl ? (
                                <>
                                    <Cast className="h-3 w-3" />
                                    <span>Controlling</span>
                                </>
                            ) : (
                                <>
                                    <Eye className="h-3 w-3" />
                                    <span>Viewing</span>
                                </>
                            )}
                        </div>
                        <ModeToggle />
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
                                        <h4 className="font-medium leading-none">Settings</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Configure playback settings.
                                        </p>
                                    </div>
                                    <div className="grid gap-2">
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <Label htmlFor="cookie">Cookie</Label>
                                            <Input
                                                id="cookie"
                                                value={cookie}
                                                onChange={(e) => saveCookie(e.target.value)}
                                                className="col-span-2 h-8"
                                                type="password"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <Label htmlFor="nickname">Display Name</Label>
                                            <Input
                                                id="nickname"
                                                value={nickname}
                                                onChange={(e) => saveNickname(e.target.value)}
                                                placeholder="Enter a display name"
                                                className="col-span-2 h-8"
                                            />
                                        </div>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="w-full">View Debug Logs</Button>
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
                                                toast({ title: "Identity Reset", description: "Reloading..." });
                                                setTimeout(() => window.location.reload(), 500);
                                            }}
                                        >
                                            {resetConfirm ? "Click again to CONFIRM" : "Reset Identity (New User)"}
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Video Section */}
                <div className="lg:col-span-3 space-y-4">
                    <div
                        ref={containerRef}
                        className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group border border-border/50 transition-all duration-300"
                    >
                        {videoSrc ? (
                            <video
                                key={videoSrc}
                                ref={videoRef}
                                controls
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
                                <p className="text-sm font-medium">Enter a Quark link and click Play to start</p>
                            </div>
                        )}

                        {currentSubtitle && (
                            <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none px-8 z-20">
                                <div
                                    className="bg-black/80 text-white px-6 py-2 rounded-lg text-lg lg:text-3xl text-center break-words max-w-[90%] shadow-2xl border border-white/10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                                    dangerouslySetInnerHTML={{ __html: currentSubtitle.replace(/\n/g, '<br/>') }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <aside className="space-y-6">
                    <Card className="flex flex-col h-[500px] lg:h-[calc(100vh-12rem)] shadow-lg overflow-hidden border-border/50">
                        <Tabs defaultValue="playlist" className="flex flex-col h-full">
                            <CardHeader className="py-2 px-4 border-b bg-muted/30">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="playlist">Playlist</TabsTrigger>
                                    <TabsTrigger value="chat">
                                        <div className="flex items-center gap-1.5">
                                            <span>Chat</span>
                                        </div>
                                    </TabsTrigger>
                                    <TabsTrigger value="members">Members</TabsTrigger>
                                </TabsList>
                            </CardHeader>

                            <CardContent className="flex-1 overflow-hidden p-0 bg-background/50 block">
                                <TabsContent value="playlist" className="flex-1 flex flex-col min-h-0 m-0">
                                    <div className="p-3 border-b bg-muted/30 flex gap-2 shrink-0">
                                        <Input
                                            placeholder="Quark URL or ID"
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
                                                <p>Queue is empty.</p>
                                                <p className="text-xs opacity-70">Add videos to play them sequentially.</p>
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
                                                <p className="text-sm">No messages yet.</p>
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
                                                placeholder="Type a message..."
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
                                                <div className="text-center text-muted-foreground text-sm opacity-70 mt-4">No members info.</div>
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
                                                                        {m.userId === currentUserId ? `${displayName} (You)` : displayName}
                                                                    </span>
                                                                    <div className={`h-1.5 w-1.5 rounded-full ${m.isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-zinc-700'}`} title={m.isOnline ? "Online" : "Offline"} />
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
            </main >
        </div >
    );
}
