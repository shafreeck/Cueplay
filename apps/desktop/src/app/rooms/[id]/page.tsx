'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiClient } from '@/api/client';

export default function RoomDetail() {
    const params = useParams();
    const roomId = params.id as string;
    const [logs, setLogs] = useState<string[]>([]);
    const [videoSrc, setVideoSrc] = useState<string>('');
    const [rawUrl, setRawUrl] = useState<string>('');
    const [duration, setDuration] = useState<number>(3600);
    const [fileId, setFileId] = useState('');
    const [cookie, setCookie] = useState('');
    const [currentSubtitle, setCurrentSubtitle] = useState('');

    const socketRef = useRef<WebSocket | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const isRemoteUpdate = useRef(false);
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
        setVideoSrc(proxyUrl);
        addLog(`Source updated: ${proxyUrl}`);
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

    const handleResolve = async () => {
        if (!fileId) return;
        let fid = fileId;
        const urlMatch = fileId.match(/video\/([a-zA-Z0-9]+)/);
        if (urlMatch) fid = urlMatch[1];

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
                    payload: { fileId, url: source.url, provider: 'quark' }
                }));
            }
        } catch (e: any) {
            addLog(`Resolve error: ${e.message}`);
        }
    };

    // WebSocket Synchronization
    useEffect(() => {
        const wsUrl = 'ws://localhost:3000/ws';
        let userId = localStorage.getItem('cueplay_userid') || `user_${Math.random().toString(36).substring(7)}`;
        localStorage.setItem('cueplay_userid', userId);

        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        const sendState = () => {
            if (isRemoteUpdate.current || !videoRef.current || ws.readyState !== WebSocket.OPEN) return;
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
                const { url, fileId: remoteFileId } = data.payload;
                if (remoteFileId) setFileId(remoteFileId);
                setRawUrl(url);
                setCurrentSubtitle('');
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
                setTimeout(() => { isRemoteUpdate.current = false; }, 100);
            }
        };

        const video = videoRef.current;
        const syncEvents = ['play', 'pause', 'seeked'];
        const handleSync = () => sendState();
        if (video) syncEvents.forEach(e => video.addEventListener(e, handleSync));

        return () => {
            if (video) syncEvents.forEach(e => video.removeEventListener(e, handleSync));
            ws.close();
        };
    }, [roomId]);

    return (
        <div className="dark min-h-screen bg-background text-foreground">
            <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-10">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-hidden shrink-0">
                        <Link href="/">
                            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">← Rooms</Button>
                        </Link>
                        <h1 className="text-xl font-bold truncate">Room: {roomId}</h1>
                    </div>

                    <div className="flex items-center gap-2 flex-1 max-w-2xl justify-end">
                        <Input
                            placeholder="Cookie"
                            value={cookie}
                            onChange={(e) => saveCookie(e.target.value)}
                            className="w-24 shrink-0"
                            type="password"
                        />
                        <Input
                            placeholder="Quark URL or ID"
                            value={fileId}
                            onChange={(e) => setFileId(e.target.value)}
                            className="flex-1"
                        />
                        <Button onClick={handleResolve} size="sm" className="shrink-0">Play</Button>
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
                                className="w-full h-full object-contain"
                                src={videoSrc}
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
                                    className="bg-black/80 text-white px-6 py-2 rounded-lg text-lg lg:text-3xl text-center break-words max-w-[90%] shadow-2xl border border-white/10"
                                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                                    dangerouslySetInnerHTML={{ __html: currentSubtitle.replace(/\n/g, '<br/>') }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Debug UI removed as per request */}
                </div>

                {/* Sidebar */}
                <aside className="space-y-6">
                    <Card className="flex flex-col h-[500px] lg:h-[calc(100vh-12rem)] shadow-lg overflow-hidden border-border/50">
                        <CardHeader className="py-4 border-b bg-muted/30">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                System Logs
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-0 bg-zinc-950 font-mono text-[10px] leading-relaxed">
                            <div className="p-3 space-y-1">
                                {logs.map((log, i) => (
                                    <div key={i} className="text-emerald-400 opacity-80 border-b border-white/5 pb-1 last:border-0">
                                        {log}
                                    </div>
                                ))}
                                {logs.length === 0 && <div className="text-zinc-600 italic">No activity recorded...</div>}
                            </div>
                        </CardContent>
                        <div className="p-4 border-t bg-muted/30">
                            <Input placeholder="Team chat..." className="h-9 bg-background" />
                        </div>
                    </Card>
                </aside>
            </main>
        </div>
    );
}
