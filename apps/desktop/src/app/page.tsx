'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiClient, Room } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";

import { ModeToggle } from '@/components/mode-toggle';
import { UserProfile } from '@/components/user-profile';
import { Shield, Trash2, History, Home as HomeIcon, Clapperboard, Sparkles, Search, Archive, ChevronRight, Plus, ArrowRight } from 'lucide-react';
import { RoomHistory, VisitedRoom } from '@/utils/history';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/language-toggle';



interface RoomItemProps {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  onDelete: () => void;
  deleteLabel: string;
}

function RoomItem({
  id,
  title,
  subtitle,
  href,
  onDelete,
  deleteLabel
}: RoomItemProps) {
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
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

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation('common');
  // Hydration Fix: Initialize state as empty/null. Do not read localStorage during render.
  const [userId, setUserId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [visitedRooms, setVisitedRooms] = useState<VisitedRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinId, setJoinId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);


  useEffect(() => {
    // Client-side only initialization
    let currentId = '';

    // 1. Get or Generate User ID (Client-side only)
    try {
      currentId = localStorage.getItem('cueplay_userid') || '';
      if (!currentId) {
        currentId = 'user-' + Math.random().toString(36).substring(7);
        localStorage.setItem('cueplay_userid', currentId);
      }
      setUserId(currentId);
    } catch (e) {
      console.error("Failed to access localStorage", e);
      setIsInitializing(false);
      return;
    }

    // 2. Load visited rooms
    setVisitedRooms(RoomHistory.getVisitedRooms());

    // 3. Load rooms from API with timeout protection
    if (currentId) {
      const timeoutId = setTimeout(() => {
        console.error('loadRooms timeout after 10s');
        setError('Failed to load rooms: timeout');
        setIsInitializing(false);
      }, 10000);

      loadRooms(currentId)
        .finally(() => {
          clearTimeout(timeoutId);
          setIsInitializing(false);
        });
    } else {
      setError("Failed to initialize user identity.");
      setIsInitializing(false);
    }
  }, []);

  const loadVisited = () => {
    setVisitedRooms(RoomHistory.getVisitedRooms());
  };

  const loadRooms = async (uid: string) => {
    setIsLoadingRooms(true);
    setError(null);
    try {
      const list = await ApiClient.listRooms(uid);
      setRooms(list);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load rooms");
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const createRoom = async () => {
    setIsCreatingRoom(true);
    try {
      const room = await ApiClient.createRoom(userId);
      toast({ title: t('room_created_title'), description: t('room_created_desc', { id: room.id }) });
      router.push(`/room?id=${room.id}`);
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: t('create_failed_title'), description: e.message });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const joinRoom = (id?: string) => {
    const targetId = (id || joinId).trim();
    if (targetId) {
      router.push(`/room?id=${targetId}`);
      setJoinId('');
    }
  };

  const deleteRoom = async (id: string) => {
    try {
      await ApiClient.deleteRoom(id, userId);
      toast({ title: t('room_deleted_title'), description: t('room_deleted_desc') });
      setRooms(prev => prev.filter(r => r.id !== id));
      RoomHistory.removeVisitedRoom(id);
      loadVisited();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('delete_failed_title'), description: e.message });
    }
  };

  const handleDeleteRoom = async () => {
    if (!deleteId) return;
    await deleteRoom(deleteId);
    setDeleteId(null);
  };

  const otherVisitedRooms = visitedRooms.filter(r => r.ownerId !== userId);

  // const isMobile = useIsMobile(); // Removed conditional
  return (
    <>
      <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-50 bg-black/40 backdrop-blur-2xl border-b border-white/5 px-4 h-[56px] shrink-0 flex items-center justify-between pt-safe box-content">
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

        <main className="container mx-auto p-4 md:p-8 flex-1 animate-fade-in pb-24 md:pb-8">
          {/* Desktop Header Row */}
          <div className="hidden md:flex flex-row items-center justify-between gap-4 mb-8 animate-fade-in relative z-50">
            {/* Left: Brand & Title */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="p-2.5 bg-primary rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.4)] ring-1 ring-white/20">
                <Clapperboard className="w-5 h-5 text-white fill-white/20" />
              </div>
              <div className="flex items-center gap-3 bg-white/10 p-1 pl-4 pr-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-sm">
                <h1 className="text-lg font-bold tracking-tight text-white mr-2 shadow-black drop-shadow-md">
                  {t('rooms')}
                </h1>
                <div className="h-4 w-px bg-white/20" />
                <div className="flex gap-0.5">
                  <LanguageToggle />
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              {/* Join Group - Dark Pill */}
              <div className="flex items-center bg-black/20 p-1 pl-4 rounded-full border border-white/5 backdrop-blur-sm shadow-sm ring-1 ring-white/5 transition-colors hover:bg-black/30 hover:border-white/10">
                <Input
                  placeholder={t('enter_room_id')}
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') joinRoom();
                  }}
                  className="w-24 md:w-32 h-8 bg-transparent border-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground/50 text-sm transition-all"
                />
                <div className="h-4 w-px bg-white/10 mx-2" />
                <Button
                  onClick={() => joinRoom()}
                  disabled={!joinId}
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
                >
                  {t('join')}
                </Button>
              </div>

              {/* Create Button - Primary Pill */}
              <Button
                onClick={createRoom}
                disabled={isCreatingRoom}
                className="h-10 rounded-full px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-all duration-300 border border-white/10"
              >
                {isCreatingRoom ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span className="hidden md:inline">{t('creating')}</span>
                  </span>
                ) : (
                  <span className="font-semibold text-sm">{t('create_room')}</span>
                )}
              </Button>

              {/* Profile - Circle */}
              <div className="ml-1">
                <UserProfile userId={userId} autoOpen={!isInitializing} />
              </div>
            </div>
          </div>

          <div className="space-y-8 md:space-y-12">
            {/* Mobile Quick Join */}
            <div className="md:hidden glass border-white/10 rounded-3xl p-5 shadow-xl ring-1 ring-white/5 relative overflow-hidden group mb-8">
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
            {/* My Rooms Section */}
            <section>
              <div className="flex items-center gap-2 mb-4 text-xl font-semibold">
                <HomeIcon className="w-5 h-5 text-primary" />
                <h2>{t('my_rooms')}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* State 1: Global Loading (Initial or Reloading) */}
                {(isInitializing || (isLoadingRooms && rooms.length === 0)) && (
                  <div className="col-span-full py-12 flex justify-center items-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      <p className="text-muted-foreground animate-pulse">{t('loading_rooms')}</p>
                    </div>
                  </div>
                )}

                {/* State 2: Error with Retry */}
                {!isInitializing && error && (
                  <div className="col-span-full py-12 flex justify-center items-center">
                    <div className="flex flex-col items-center gap-4 text-center max-w-md bg-destructive/10 p-6 rounded-2xl border border-destructive/20">
                      <p className="text-destructive font-semibold">{t('failed_to_load')}</p>
                      <p className="text-sm text-muted-foreground">{error}</p>
                      <Button variant="outline" onClick={() => loadRooms(userId)} className="mt-2">
                        {t('retry')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* State 3: Success List (Responsive) */}
                {!isInitializing && !error && rooms.map((room) => (
                  <div key={room.id} className="contents">
                    {/* Mobile Item */}
                    <div className="md:hidden">
                      <RoomItem
                        id={room.id}
                        title={room.title || t('room_title', { id: room.id })}
                        subtitle={room.description || t('members_count', { count: room.members.length })}
                        href={`/room?id=${room.id}`}
                        onDelete={() => setDeleteId(room.id)}
                        deleteLabel={t('delete')}
                      />
                    </div>

                    {/* Desktop Card */}
                    <Card className="hidden md:flex flex-col glass border-white/5 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-300 relative group overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <CardHeader>
                        <CardTitle className="flex justify-between items-center text-lg">
                          <span className="truncate" title={room.title || `Room ${room.id}`}>{room.title || t('room_title', { id: room.id })}</span>
                          {room.ownerId === userId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={() => setDeleteId(room.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">
                          {room.description || t('members_count', { count: room.members.length })}
                        </p>
                        <Link href={`/room?id=${room.id}`}>
                          <Button className="w-full bg-primary/20 hover:bg-primary/40 text-primary-foreground border-primary/20" variant="outline">
                            {t('enter_room')}
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                ))}

                {/* State 4: Empty List */}
                {!isInitializing && !error && !isLoadingRooms && rooms.length === 0 && (
                  <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                    <p>{t('no_rooms_yet')}</p>
                    <Button variant="link" onClick={createRoom} className="mt-2">{t('create_first_room')}</Button>
                  </div>
                )}
              </div>
            </section>

            {/* Visited Rooms Section - Only show if there are rooms */}
            {otherVisitedRooms.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4 text-xl font-semibold mt-8 border-t pt-8">
                  <History className="w-5 h-5 text-primary" />
                  <h2>{t('visited_rooms')}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {otherVisitedRooms.map((room) => (
                    <div key={room.id} className="contents">
                      {/* Mobile Item */}
                      <div className="md:hidden">
                        <RoomItem
                          id={room.id}
                          title={t('room_title', { id: room.id })}
                          subtitle={room.lastVisited ? new Date(room.lastVisited).toLocaleDateString() : t('visited_recently')}
                          href={`/room?id=${room.id}`}
                          onDelete={() => {
                            RoomHistory.removeVisitedRoom(room.id);
                            loadVisited();
                          }}
                          deleteLabel={t('delete')}
                        />
                      </div>

                      {/* Desktop Card */}
                      <Card className="hidden md:flex flex-col glass border-white/5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01] transition-all duration-300 relative group overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                          <CardTitle className="flex justify-between items-center text-lg">
                            <span className="truncate pr-4">{t('room_title', { id: room.id })}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              title={t('remove_history')}
                              onClick={(e) => {
                                e.preventDefault();
                                RoomHistory.removeVisitedRoom(room.id);
                                loadVisited();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            {room.lastVisited ? t('visited_date', { date: new Date(room.lastVisited).toLocaleDateString() }) : t('visited_recently')}
                          </p>
                          <Link href={`/room?id=${room.id}`}>
                            <Button className="w-full bg-white/5 hover:bg-white/10 text-foreground border-white/10" variant="outline">
                              {t('rejoin')}
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>

        <footer className="hidden md:flex py-8 border-t border-border/30 text-center text-sm text-muted-foreground items-center justify-center gap-4 bg-background">
          <span>{t('copyright')}</span>
          <Link href="/admin" className="opacity-50 hover:opacity-100 transition-opacity" title={t('system_admin')}>
            <Shield className="w-4 h-4 text-primary fill-primary" />
          </Link>
        </footer>

        {/* Mobile FAB */}
        <div className="md:hidden fixed bottom-8 right-6 z-50">
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

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirm_delete_title')}</DialogTitle>
            <DialogDescription>
              {t('confirm_delete_desc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t('cancel')}</Button>
            <Button onClick={handleDeleteRoom} variant="destructive">
              {t('delete_room')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
