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
import { Trash2, PlayCircle, Plus, Settings, Copy } from 'lucide-react';

interface PlaylistItem {
    id: string;
    fileId: string;
    title?: string;
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
    const [resetConfirm, setResetConfirm] = useState(false);

    const socketRef = useRef<WebSocket | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const isRemoteUpdate = useRef(false);
    const isLoadingSource = useRef(false);
    const cookieRef = useRef(cookie);
    const lastTimeRef = useRef(0);

    const addLog = (msg: string) => setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // Update cookie ref for the proxy requests
    useEffect(() => {
        cookieRef.current = cookie;
    }, [cookie]);

    // Load/Save Cookie
    useEffect(() => {
        const stored = localStorage.getItem('quark_cookie');
        if (stored) {
            setCookie(stored);
            cookieRef.current = stored;
        }
    }, []);

    const saveCookie = (val: string) => {
        setCookie(val);
        localStorage.setItem('quark_cookie', val);
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

        ws.onopen = () => ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId, userId } }));
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
                    <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group border border-border/50">
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
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="playlist">Playlist</TabsTrigger>
                                    <TabsTrigger value="members">Members</TabsTrigger>
                                </TabsList>
                            </CardHeader>

                            <CardContent className="flex-1 overflow-hidden p-0 bg-background/50 flex flex-col">
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
                                        {playlist.map((item, i) => (
                                            <div
                                                key={item.id}
                                                className={`group flex items-center justify-between p-2 rounded-md border transition-colors ${item.id === playingItemId ? 'bg-accent border-primary/50' : 'bg-card border-border/50 hover:bg-accent'}`}
                                            >
                                                <div className="flex flex-col flex-1 min-w-0 mr-2">
                                                    <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                                                    <span className="text-sm font-medium truncate" title={item.title || item.fileId}>{item.title || item.fileId}</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => resolveAndPlay(item.fileId, item.id)}>
                                                        <PlayCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeFromPlaylist(item.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="members" className="flex-1 flex flex-col min-h-0 m-0 p-4">
                                    <div className="mb-4">
                                        <Button
                                            variant={controllerId === currentUserId ? "outline" : "default"}
                                            className="w-full"
                                            disabled={controllerId === currentUserId}
                                            onClick={() => {
                                                if (socketRef.current?.readyState === WebSocket.OPEN) {
                                                    socketRef.current.send(JSON.stringify({ type: 'TAKE_CONTROL', payload: { roomId } }));
                                                    toast({ title: "Control Requested", description: "Taking over playback control." });
                                                }
                                            }}
                                        >

                                            {controllerId === currentUserId ? "You have control (🎮)" : "Take Control"}
                                        </Button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-2">
                                        {members.length === 0 && (
                                            <div className="text-center text-muted-foreground text-sm opacity-70 mt-4">No members info.</div>
                                        )}
                                        {members.map((m: any) => (
                                            <div key={m.userId} className="flex items-center justify-between p-2 rounded-md border bg-card/50">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-2 w-2 rounded-full ${m.isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-zinc-700'}`} />
                                                    <span className="text-sm font-medium">
                                                        {m.userId === currentUserId ? `${m.userId} (You)` : m.userId}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {m.userId === controllerId && <span title="Controller" className="text-lg">🎮</span>}
                                                    {m.userId === ownerId && <span title="Owner" className="text-xs">👑</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            </CardContent>
                        </Tabs>
                    </Card>
                </aside>
            </main>
        </div>
    );
}
