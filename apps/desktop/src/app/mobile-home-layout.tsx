
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
        <div className="relative overflow-hidden rounded-xl border bg-card group">
            {/* Delete Action (Underlay) */}
            <button
                className="absolute inset-y-0 right-0 w-20 bg-destructive flex items-center justify-center text-white active:bg-destructive/80 transition-colors z-0"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                    // Small delay before resetting to avoid click bleed-through
                    setTimeout(() => setCurrentX(0), 100);
                }}
            >
                <div className="flex flex-col items-center gap-1">
                    <Trash2 className="w-5 h-5" />
                    <span className="text-[10px] font-bold">{deleteLabel}</span>
                </div>
            </button>

            {/* Main Content (Overlay) */}
            <Link
                href={href}
                className="block relative z-10 bg-card active:bg-zinc-900 transition-colors"
                onClick={(e) => {
                    if (currentX !== 0) {
                        e.preventDefault();
                        setCurrentX(0);
                    }
                }}
                style={{
                    transform: `translateX(${currentX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="p-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="font-medium text-base truncate">{title}</div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                            {subtitle}
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
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
        <div className="h-[100dvh] bg-background flex flex-col overflow-hidden no-scrollbar">
            {/* Header - Native Look */}
            <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-2xl border-b px-4 h-[44px] shrink-0 flex items-center justify-between pt-safe box-content">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary rounded-lg shadow-lg shadow-primary/20">
                        <Clapperboard className="w-4 h-4 text-white" />
                    </div>
                    <h1 className="font-bold text-[17px] tracking-tight">{t('rooms')}</h1>
                </div>
                <div className="flex items-center gap-3">
                    <LanguageToggle />
                    <UserProfile userId={userId} />
                </div>
            </header>

            <main className="flex-1 p-4 space-y-6 overflow-y-auto no-scrollbar">
                {/* Quick Join */}
                <div className="bg-card/50 rounded-2xl p-4 border shadow-sm">
                    <h2 className="text-sm font-medium text-muted-foreground mb-3">{t('join_room')}</h2>
                    <div className="flex gap-2">
                        <Input
                            placeholder={t('enter_room_id')}
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && joinId.trim() && !isCreatingRoom) {
                                    joinRoom(joinId);
                                }
                            }}
                            className="bg-background"
                        />
                        <Button
                            onClick={(e) => {
                                e.preventDefault();
                                joinRoom(joinId);
                            }}
                            disabled={!joinId.trim() || isCreatingRoom}
                            size="icon"
                            className="rounded-xl"
                        >
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* My Rooms */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-lg font-semibold">
                            <Home className="w-5 h-5 text-primary" />
                            <h2>{t('my_rooms')}</h2>
                        </div>
                        {isLoadingRooms && <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />}
                    </div>

                    {error && (
                        <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm flex items-center justify-between">
                            <span>{error}</span>
                            <Button variant="ghost" size="sm" onClick={() => loadRooms(userId)}>{t('retry')}</Button>
                        </div>
                    )}

                    {!isLoadingRooms && rooms.length === 0 && !error ? (
                        <div className="text-center py-10 bg-muted/20 rounded-2xl border-dashed border-2">
                            <Archive className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                            <p className="text-muted-foreground">{t('no_rooms_yet')}</p>
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
                    <div className="space-y-4 pb-20">
                        <div className="flex items-center gap-2 text-lg font-semibold border-t pt-6">
                            <History className="w-5 h-5 text-primary" />
                            <h2>{t('visited_rooms')}</h2>
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
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    onClick={createRoom}
                    disabled={isCreatingRoom}
                    className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground border border-white/10"
                >
                    {isCreatingRoom ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Plus className="w-8 h-8" />
                    )}
                </Button>
            </div>
        </div>
    );
}
