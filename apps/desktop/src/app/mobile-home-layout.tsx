
'use client';

import { Room } from '@/api/client';
import { VisitedRoom, RoomHistory } from '@/utils/history';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { UserProfile } from '@/components/user-profile';
import { LanguageToggle } from '@/components/language-toggle';
import { Clapperboard, Plus, Search, Archive, ArrowRight, ChevronRight, History, Trash2, Home } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ModeToggle } from '@/components/mode-toggle';

interface MobileHomeLayoutProps {
    userId: string;
    rooms: Room[];
    visitedRooms: VisitedRoom[];
    isLoadingRooms: boolean;
    isCreatingRoom: boolean;
    loadRooms: (uid: string) => void;
    createRoom: () => void;
    joinId: string;
    setJoinId: (id: string) => void;
    joinRoom: (id?: string) => void;
    error: string | null;
    deleteRoom: (id: string) => void;
    removeVisitedRoom: (id: string) => void;
}

function RoomItem({
    id,
    title,
    subtitle,
    href,
    onDelete,
    deleteLabel
}: {
    id: string;
    title: string;
    subtitle: string;
    href: string;
    onDelete: () => void;
    deleteLabel: string;
}) {
    const [startX, setStartX] = useState<number | null>(null);
    const [currentX, setCurrentX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const itemRef = useRef<HTMLDivElement>(null);
    const threshold = -80;

    const handleTouchStart = (e: React.TouchEvent) => {
        setStartX(e.touches[0].clientX);
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startX === null) return;
        const diff = e.touches[0].clientX - startX;
        if (diff < 0) {
            setCurrentX(Math.max(diff, -100));
        } else {
            setCurrentX(0);
        }
    };

    const handleTouchEnd = () => {
        if (currentX < threshold) {
            setCurrentX(-80);
        } else {
            setCurrentX(0);
        }
        setStartX(null);
        setIsSwiping(false);
    };

    return (
        <div className="relative overflow-hidden rounded-2xl group transition-all duration-300">
            {/* Delete Action (Background) */}
            <button
                className={`absolute inset-y-0 right-0 w-24 bg-destructive/90 flex items-center justify-center text-white active:bg-destructive transition-all duration-300 z-0 ${currentX !== 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                    setTimeout(() => setCurrentX(0), 100);
                }}
            >
                <div className="flex flex-col items-center gap-1">
                    <Trash2 className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{deleteLabel}</span>
                </div>
            </button>

            {/* Main Content (Foreground) */}
            <Link
                href={href}
                className="block relative z-10 glass border-white/10 active:bg-white/10 transition-colors"
                onClick={(e) => {
                    if (currentX !== 0) {
                        e.preventDefault();
                        setCurrentX(0);
                    }
                }}
                style={{
                    transform: `translateX(${currentX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: currentX !== 0 ? '-10px 0 20px -5px rgba(0,0,0,0.5)' : 'none'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="p-5 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-lg truncate flex items-center gap-2">
                            {title}
                        </div>
                        <div className="text-xs text-muted-foreground/80 mt-1.5 truncate font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 inline-block" />
                            {subtitle}
                        </div>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground/50 border border-white/5">
                        <ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </Link>
        </div>
    );
}

export function MobileHomeLayout({
    userId,
    rooms,
    visitedRooms,
    isLoadingRooms,
    isCreatingRoom,
    loadRooms,
    createRoom,
    joinId,
    setJoinId,
    joinRoom,
    error,
    deleteRoom,
    removeVisitedRoom
}: MobileHomeLayoutProps) {
    const { t } = useTranslation('common');

    return (
        <div className="h-[100dvh] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background flex flex-col overflow-hidden no-scrollbar text-foreground">
            {/* Header - Native Look but with Glass Effect */}
            <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-2xl border-b border-white/5 px-4 h-[56px] shrink-0 flex items-center justify-between pt-safe box-content">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-xl shadow-[0_0_15px_rgba(124,58,237,0.4)] ring-1 ring-white/10">
                        <Clapperboard className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="font-bold text-lg tracking-tight drop-shadow-md">{t('rooms')}</h1>
                </div>
                <div className="flex items-center gap-3">
                    <LanguageToggle />
                    <UserProfile userId={userId} />
                </div>
            </header>

            <main className="flex-1 p-4 space-y-8 overflow-y-auto no-scrollbar">
                {/* Quick Join */}
                <div className="glass border-white/10 rounded-3xl p-5 shadow-xl ring-1 ring-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-50 pointer-events-none" />
                    <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        {t('join_room')}
                    </h2>
                    <div className="flex gap-2 relative z-10">
                        <Input
                            placeholder={t('enter_room_id')}
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && joinId.trim() && !isCreatingRoom) {
                                    joinRoom(joinId);
                                }
                            }}
                            className="bg-black/20 border-white/10 h-10 rounded-xl focus-visible:ring-primary/50"
                        />
                        <Button
                            onClick={(e) => {
                                e.preventDefault();
                                joinRoom(joinId);
                            }}
                            disabled={!joinId.trim() || isCreatingRoom}
                            size="icon"
                            className="rounded-xl h-10 w-10 bg-white/10 hover:bg-white/20 text-foreground border border-white/5"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* My Rooms */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-xl font-bold">
                            <Home className="w-5 h-5 text-primary drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
                            <h2 className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">{t('my_rooms')}</h2>
                        </div>
                        {isLoadingRooms && <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full shadow-[0_0_10px_rgba(124,58,237,0.5)]" />}
                    </div>

                    {error && (
                        <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm flex items-center justify-between border border-destructive/20 shadow-sm">
                            <span>{error}</span>
                            <Button variant="ghost" size="sm" onClick={() => loadRooms(userId)} className="hover:bg-destructive/10">{t('retry')}</Button>
                        </div>
                    )}

                    {!isLoadingRooms && rooms.length === 0 && !error ? (
                        <div className="text-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/10">
                            <Archive className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-muted-foreground font-medium">{t('no_rooms_yet')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {rooms.map(room => (
                                <RoomItem
                                    key={room.id}
                                    id={room.id}
                                    title={t('room_title', { id: room.id })}
                                    subtitle={t('members_count', { count: room.members.length })}
                                    href={`/room?id=${room.id}`}
                                    onDelete={() => deleteRoom(room.id)}
                                    deleteLabel={t('delete')}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Visited Rooms */}
                {visitedRooms.length > 0 && (
                    <div className="space-y-4 pb-24">
                        <div className="flex items-center gap-2 text-xl font-bold border-t border-white/5 pt-8 px-1">
                            <History className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                            <h2 className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">{t('visited_rooms')}</h2>
                        </div>
                        <div className="space-y-3">
                            {visitedRooms.filter(r => r.ownerId !== userId).map(room => (
                                <RoomItem
                                    key={room.id}
                                    id={room.id}
                                    title={t('room_title', { id: room.id })}
                                    subtitle={room.lastVisited ? new Date(room.lastVisited).toLocaleDateString() : t('visited_recently')}
                                    href={`/room?id=${room.id}`}
                                    onDelete={() => removeVisitedRoom(room.id)}
                                    deleteLabel={t('delete')}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* FAB */}
            <div className="fixed bottom-8 right-6 z-50">
                <Button
                    onClick={createRoom}
                    disabled={isCreatingRoom}
                    className="h-14 w-14 rounded-full shadow-[0_0_30px_rgba(124,58,237,0.5)] bg-primary hover:bg-primary/90 text-primary-foreground border border-white/20 transition-transform active:scale-90"
                >
                    {isCreatingRoom ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Plus className="w-7 h-7" />
                    )}
                </Button>
            </div>
        </div>
    );
}
