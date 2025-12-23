
'use client';

import { PlaylistItem, ChatMessage } from './types';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, List, Users, ArrowLeft, ArrowRight, MoreVertical, PlayCircle, Settings, FolderSearch, ChevronDown, ChevronRight, Folder, Trash2, Plus, Cast, Crown } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MobileRoomLayoutProps {
    roomId: string | null;
    videoRef: React.RefObject<HTMLVideoElement>;
    containerRef: React.RefObject<HTMLDivElement>;
    videoSrc: string;
    playlist: PlaylistItem[];
    playingItemId: string | null;
    messages: ChatMessage[];
    members: any[];
    chatInput: string;
    setChatInput: (val: string) => void;
    sendChatMessage: () => void;
    onPlay: (fileId: string, id: string) => void;
    onRemoveFromPlaylist: (id: string) => void;
    addToPlaylist: () => void;
    inputValue: string;
    setInputValue: (val: string) => void;
    toggleFullscreen: () => void;
    setIsLibraryOpen: (isOpen: boolean) => void;
    onEnded: () => void;
    isResolving: boolean;
    currentUserId: string | null;
    ownerId: string;
    controllerId: string | null;
}

function MobilePlaylistItem({ item, index, playingItemId, onPlay, onRemove, level = 0 }: {
    item: PlaylistItem,
    index: number,
    playingItemId: string | null,
    onPlay: (fid: string, id: string) => void,
    onRemove: (id: string) => void,
    level?: number
}) {
    const isFolder = item.type === 'folder';
    // Logic for finding playing child - same as desktop
    const playingChild = isFolder ? item.children?.find(c => c.id === playingItemId) : null;
    const isPlaying = item.id === playingItemId || !!playingChild;

    const [expanded, setExpanded] = useState(false);

    const handlePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (isFolder) {
            const targetId = item.lastPlayedId || item.children?.[0]?.id;
            const targetChild = item.children?.find(c => c.id === targetId) || item.children?.[0];
            if (targetChild) {
                onPlay(targetChild.fileId, targetChild.id);
                setExpanded(true);
            }
        } else {
            onPlay(item.fileId, item.id);
        }
    };

    return (
        <div className="select-none mb-2 px-2">
            <div
                className={cn(
                    "flex items-center gap-2 p-3 rounded-xl border transition-all",
                    isPlaying
                        ? "bg-primary/20 border-primary/50"
                        : "bg-white/5 border-white/5 active:bg-white/10"
                )}
                style={{ marginLeft: `${level * 16}px` }}
                onClick={() => {
                    if (isFolder) setExpanded(!expanded);
                }}
            >
                {/* Left Group: Index, Chevron, Icon */}
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground w-4 text-center">
                        {level === 0 ? `#${index + 1}` : ''}
                    </span>

                    {isFolder ? (
                        <div
                            className="p-1 -m-1"
                            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                        >
                            {expanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                        </div>
                    ) : (
                        <div className="w-4" /> // Spacer for alignment
                    )}

                    {isFolder ? (
                        <Folder className="w-4 h-4 text-primary" />
                    ) : (
                        // File icon usually not shown in desktop if there's an index, but we can keep alignment
                        <span className="w-0" />
                    )}
                </div>

                {/* Middle Group: Title, Now Playing, Progress */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 ml-1">
                    <div className="flex items-center gap-2">
                        <span className={cn("font-medium text-sm truncate", isPlaying ? "text-foreground" : "text-foreground")}>
                            {item.title || "Untitled"}
                        </span>
                    </div>

                    {/* Now Playing Subtext for Folder */}
                    {playingChild && (
                        <div className="flex items-center gap-1.5 text-[10px] text-green-500 font-medium truncate animate-in fade-in">
                            <PlayCircle className="w-3 h-3 shrink-0" />
                            <span className="truncate">Now Playing: {playingChild.title}</span>
                        </div>
                    )}

                    {/* "Playing" Indicator for direct file */}
                    {!isFolder && isPlaying && (
                        <div className="flex items-center gap-1.5 text-[10px] text-green-500 font-bold">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            Playing
                        </div>
                    )}

                    {/* Progress Bar */}
                    {/* For Folder: Avg progress */}
                    {isFolder && item.children && item.children.some(c => c.progress) && (
                        <div className="h-1 w-full max-w-[150px] bg-white/10 rounded-full overflow-hidden">
                            {(() => {
                                const total = item.children.length;
                                const currentSum = item.children.reduce((acc, c) => acc + (c.progress && c.duration ? (c.progress / c.duration) : 0), 0);
                                const avg = total > 0 ? (currentSum / total) * 100 : 0;
                                return <div className="h-full bg-primary/60" style={{ width: `${avg}%` }} />;
                            })()}
                        </div>
                    )}

                    {/* For File */}
                    {!isFolder && item.progress && item.duration && (
                        <div className="h-1 w-full max-w-[100px] bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary/60 transition-all rounded-full"
                                style={{ width: `${(item.progress / item.duration) * 100}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* Right Group: Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-foreground/80 hover:text-primary hover:bg-white/10"
                        onClick={handlePlay}
                    >
                        <PlayCircle className="w-5 h-5" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(item.id);
                        }}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Children */}
            {isFolder && expanded && item.children && (
                <div className="ml-8 mt-1.5 space-y-1 border-l-2 border-white/10 pl-3 animate-in slide-in-from-left-2 duration-200">
                    {item.children.map((child, childIdx) => (
                        <div
                            key={child.id}
                            className={`flex items-center justify-between p-2 rounded-md text-xs group/child transition-all ${child.id === playingItemId ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}
                        >
                            <div className="flex items-center gap-2 min-w-0 mr-2 flex-1">
                                <span className="font-mono opacity-40 tabular-nums">{index + 1}.{childIdx + 1}</span>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="truncate" title={child.title}>{child.title}</span>
                                    {child.progress && child.duration && (
                                        <div className="mt-1 h-0.5 w-full max-w-[80px] bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary/60 transition-all duration-300" style={{ width: `${(child.progress / child.duration) * 100}%` }} />
                                        </div>
                                    )}
                                </div>
                                {child.id === playingItemId && (
                                    <div className="flex gap-0.5 h-3 items-end pb-0.5">
                                        <div className="w-0.5 bg-primary animate-[music-bar_0.6s_ease-in-out_infinite]" style={{ height: '60%' }}></div>
                                        <div className="w-0.5 bg-primary animate-[music-bar_0.8s_ease-in-out_infinite]" style={{ height: '100%' }}></div>
                                        <div className="w-0.5 bg-primary animate-[music-bar_0.7s_ease-in-out_infinite]" style={{ height: '80%' }}></div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover/child:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onPlay(child.fileId, child.id)}>
                                    <PlayCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/70 hover:text-destructive" onClick={() => onRemove(child.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function MobileRoomLayout({
    roomId,
    videoRef,
    containerRef,
    videoSrc,
    playlist,
    playingItemId,
    messages,
    members,
    chatInput,
    setChatInput,
    sendChatMessage,
    onPlay,
    onRemoveFromPlaylist,
    addToPlaylist,
    inputValue,
    setInputValue,
    toggleFullscreen,
    setIsLibraryOpen,
    onEnded,
    isResolving,
    currentUserId,
    ownerId,
    controllerId
}: MobileRoomLayoutProps) {
    const { t } = useTranslation('common');
    const [activeTab, setActiveTab] = useState('playlist');
    const [isInputFocused, setIsInputFocused] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const lastTapRef = useRef<number>(0);

    const handleTouchStart = (e: React.TouchEvent) => {
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

    // Auto-scroll chat
    useEffect(() => {
        if (activeTab === 'chat' && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, activeTab]);

    return (
        <div className="h-[100dvh] flex flex-col bg-black text-white overflow-hidden">
            <style>{styles}</style>
            {/* Header - Coordinated with Home Page */}
            <header className="relative z-50 bg-black/80 backdrop-blur-2xl border-b border-white/5 px-4 h-[44px] shrink-0 flex items-center justify-between pt-safe box-content">
                <div className="flex-1 -ml-1">
                    <Link href="/" className="flex items-center text-primary active:opacity-50 transition-opacity p-2 -m-2">
                        <ChevronRight className="w-6 h-6 rotate-180" strokeWidth={2.5} />
                    </Link>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2">
                    <h1 className="text-[17px] font-bold text-foreground tracking-tight">{roomId}</h1>
                </div>
                <div className="flex-1 flex justify-end">
                    {/* Empty for symmetry */}
                </div>
            </header>

            {/* Video Player Container */}
            <div
                ref={containerRef}
                className="w-full aspect-video bg-black relative shrink-0 z-10 shadow-xl group touch-manipulation"
                onTouchStart={handleTouchStart}
            >
                {videoSrc ? (
                    <video
                        ref={videoRef}
                        className="w-full h-full object-contain"
                        controls
                        playsInline
                        src={videoSrc}
                        onEnded={onEnded}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                        <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center border border-white/5 animate-pulse">
                            <PlayCircle className="w-8 h-8 opacity-50" />
                        </div>
                        <p className="text-sm font-medium">{t('enter_quark_link')}</p>
                    </div>
                )}
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="playlist" className="flex-1 flex flex-col min-h-0 bg-transparent" onValueChange={setActiveTab}>
                {/* Content Area */}
                <div className="flex-1 min-h-0 relative w-full overflow-hidden">
                    {/* Playlist View */}
                    <TabsContent value="playlist" className="absolute inset-0 flex flex-col m-0 data-[state=inactive]:hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 border-b border-white/5 flex gap-2 shrink-0 z-10 bg-zinc-950/50 backdrop-blur-sm">
                            <Button
                                onClick={() => setIsLibraryOpen(true)}
                                size="icon"
                                variant="outline"
                                className="h-10 w-10 shrink-0 border-dashed border-white/20 hover:border-primary/50 bg-transparent"
                            >
                                <FolderSearch className="w-5 h-5 text-muted-foreground" />
                            </Button>

                            <div className="relative flex-1">
                                <Input
                                    placeholder={t('quark_url_or_id')}
                                    className="h-10 bg-zinc-900/50 border-white/10 text-sm rounded-full px-4"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addToPlaylist()}
                                />
                            </div>

                            <Button
                                onClick={addToPlaylist}
                                size="icon"
                                variant="secondary"
                                className="h-10 w-10 shrink-0 rounded-full"
                                disabled={isResolving}
                            >
                                {isResolving ? <span className="animate-spin">⌛</span> : <Plus className="w-5 h-5" />}
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 no-scrollbar">
                            {playlist.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center opacity-50">
                                    <List className="w-12 h-12 mb-3 stroke-[1.5]" />
                                    <p className="text-sm">{t('queue_empty')}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-transparent space-y-1 p-2 pb-40">
                                    {playlist.map((item, idx) => (
                                        <MobilePlaylistItem
                                            key={item.id}
                                            item={item}
                                            index={idx}
                                            playingItemId={playingItemId}
                                            onPlay={onPlay}
                                            onRemove={onRemoveFromPlaylist}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Chat View */}
                    <TabsContent value="chat" className="absolute inset-0 flex flex-col m-0 data-[state=inactive]:hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-48">
                            {messages.map((msg) => (
                                <div key={msg.id} className={cn("flex flex-col gap-1 max-w-[85%]", msg.isSystem ? "mx-auto items-center text-center max-w-full" : "items-start")}>
                                    {msg.isSystem ? (
                                        <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{msg.content}</span>
                                    ) : (
                                        <>
                                            {msg.senderName && <span className="text-[10px] text-muted-foreground ml-1">{msg.senderName}</span>}
                                            <div className="px-3 py-2 bg-zinc-800 rounded-2xl rounded-tl-none text-sm break-words shadow-sm">
                                                {msg.content}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        {/* Floating Chat Input Container - Sitting exactly above the Nav Pill */}
                        <div className={cn(
                            "absolute left-6 right-6 z-[60] transition-all duration-300",
                            isInputFocused
                                ? "bottom-4"
                                : "bottom-[calc(1.5rem+env(safe-area-inset-bottom)+3.5rem+0.75rem)]"
                        )}>
                            <div className="flex gap-2 p-2 bg-zinc-900/90 backdrop-blur-3xl border border-white/10 rounded-full shadow-2xl">
                                <Input
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                                    onFocus={() => setIsInputFocused(true)}
                                    onBlur={() => setIsInputFocused(false)}
                                    placeholder={t('type_message')}
                                    className="h-10 bg-transparent border-0 rounded-full pl-4 ring-0 focus-visible:ring-0 text-[16px] placeholder:text-zinc-500"
                                />
                                <Button size="icon" onClick={sendChatMessage} className="h-10 w-10 rounded-full aspect-square shrink-0 bg-primary hover:bg-primary/90 text-white border-0 shadow-lg shadow-primary/20">
                                    <ArrowRight className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Members View */}
                    <TabsContent value="members" className="absolute inset-0 flex flex-col m-0 data-[state=inactive]:hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 space-y-3 overflow-y-auto no-scrollbar pb-40">
                            {members.map((m: any, idx: number) => {
                                // Color logic
                                const colors = [
                                    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
                                    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
                                    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
                                    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
                                    'bg-rose-500'
                                ];
                                const colorIndex = parseInt(m.userId?.substring(0, 8) || '0', 36) % colors.length;
                                const colorClass = colors[colorIndex];

                                const displayName = m.name || t('anonymous');
                                const initial = displayName[0]?.toUpperCase() || 'U';

                                // Progress logic
                                const myTime = m.currentProgress || 0;
                                const duration = videoRef.current?.duration || 1;
                                const percent = Math.min(100, Math.max(0, (myTime / duration) * 100));

                                // Sync status color
                                let progressColor = 'bg-emerald-500/80';
                                // Simple sync check logic visualization

                                return (
                                    <div key={`${m.userId || 'unknown'}-${idx}`} className="relative flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
                                        <div className="flex items-center gap-3 relative z-10">
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ${colorClass} bg-opacity-90`}>
                                                {initial}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium leading-none text-foreground/90">
                                                        {m.userId === currentUserId ? `${displayName} (${t('you')})` : displayName}
                                                    </span>
                                                    <div className={`h-1.5 w-1.5 rounded-full ${m.isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-zinc-700'}`} />
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    {m.name && <span className="text-[11px] text-muted-foreground font-mono leading-none opacity-70">{m.userId}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 relative z-10">
                                            {m.userId === controllerId && <span title="Controlling"><Cast className="h-4 w-4 text-primary animate-pulse" /></span>}
                                            {m.userId === ownerId && <span title="Owner"><Crown className="h-4 w-4 text-yellow-500" /></span>}
                                        </div>

                                        {/* Progress Bar Background */}
                                        {m.isOnline && m.currentProgress !== undefined && (
                                            <div
                                                className={`absolute bottom-0 left-0 h-0.5 transition-all duration-1000 ease-linear ${progressColor}`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </TabsContent>
                </div>

                {/* Bottom Navigation Bar - Modern Floating Pill */}
                <div className={cn(
                    "fixed left-6 right-6 z-50 flex flex-col gap-2 transition-all duration-300",
                    isInputFocused
                        ? "translate-y-32 opacity-0 pointer-events-none" // Hide navigation bar when keyboard is up
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

                {/* Bottom Safety Area Background - Ensures consistency with system bar */}
                <div className="fixed bottom-0 left-0 right-0 h-[env(safe-area-inset-bottom)] bg-black z-[40]" />
            </Tabs>
        </div>
    );
}

const styles = `
.pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 20px);
}
.pt-safe {
    padding-top: env(safe-area-inset-top, 0px);
}
`;
