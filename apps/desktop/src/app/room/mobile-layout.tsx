
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
import { PlaylistItemRenderer } from './components/playlist-item';
import { ChatMessageItem } from './components/chat-message-item';
import { MemberItem } from './components/member-item';

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

function MobilePlaylistItemWrapper({ item, index, playingItemId, onPlay, onRemove, level = 0 }: {
    item: PlaylistItem,
    index: number,
    playingItemId: string | null,
    onPlay: (fid: string, id: string) => void,
    onRemove: (id: string) => void,
    level?: number
}) {
    const isFolder = item.type === 'folder';
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
                                        <MobilePlaylistItemWrapper
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
                                <ChatMessageItem
                                    key={msg.id}
                                    message={msg}
                                    currentUserId={currentUserId}
                                />
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
                            {members.map((m: any, idx: number) => (
                                <MemberItem
                                    key={`${m.userId || 'unknown'}-${idx}`}
                                    member={m}
                                    currentUserId={currentUserId}
                                    controllerId={controllerId}
                                    ownerId={ownerId}
                                    videoDuration={videoRef.current?.duration || 1}
                                    controllerProgress={members.find((mem: any) => mem.userId === controllerId)?.currentProgress}
                                />
                            ))}
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
