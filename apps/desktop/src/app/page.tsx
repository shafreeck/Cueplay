'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiClient, Room } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from "@/components/ui/use-toast";

import { ModeToggle } from '@/components/mode-toggle';
import { UserProfile } from '@/components/user-profile';
import { Shield, Trash2, History, Home as HomeIcon } from 'lucide-react';
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

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation('common');
  const [userId, setUserId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [visitedRooms, setVisitedRooms] = useState<VisitedRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    // Generate or load user ID
    let stored = localStorage.getItem('cueplay_userid');
    if (!stored) {
      stored = 'user-' + Math.random().toString(36).substring(7);
      localStorage.setItem('cueplay_userid', stored);
    }
    setUserId(stored);
    loadRooms(stored);
    loadVisited();
  }, []);

  const loadVisited = () => {
    setVisitedRooms(RoomHistory.getVisitedRooms());
  };

  const loadRooms = async (uid: string) => {
    try {
      const list = await ApiClient.listRooms(uid);
      setRooms(list);
    } catch (e) {
      console.error(e);
    }
  };

  const createRoom = async () => {
    setLoading(true);
    try {
      const room = await ApiClient.createRoom(userId);
      toast({ title: t('room_created_title'), description: t('room_created_desc', { id: room.id }) });
      router.push(`/room?id=${room.id}`);
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: t('create_failed_title'), description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = () => {
    if (!joinId) return;
    router.push(`/room?id=${joinId}`);
  };

  const handleDeleteRoom = async () => {
    if (!deleteId) return;
    try {
      await ApiClient.deleteRoom(deleteId, userId);
      toast({ title: t('room_deleted_title'), description: t('room_deleted_desc') });
      setRooms(prev => prev.filter(r => r.id !== deleteId));

      // Also remove from visited if present
      RoomHistory.removeVisitedRoom(deleteId);
      loadVisited();
    } catch (e: any) {
      toast({ variant: "destructive", title: t('delete_failed_title'), description: e.message });
    } finally {
      setDeleteId(null);
    }
  };

  const otherVisitedRooms = visitedRooms.filter(r => r.ownerId !== userId);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="container mx-auto p-8 flex-1">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">{t('rooms')}</h1>
            <LanguageToggle />
            <ModeToggle />
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('enter_room_id')}
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              className="w-40"
            />
            <Button onClick={joinRoom} variant="outline" disabled={!joinId}>{t('join')}</Button>
            <Button onClick={createRoom} disabled={loading}>
              {loading ? t('creating') : t('create_room')}
            </Button>
            <div className="ml-2 pl-2 border-l border-border/50">
              <UserProfile userId={userId} />
            </div>
          </div>
        </div>

        <div className="space-y-12">
          {/* My Rooms Section */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-xl font-semibold">
              <HomeIcon className="w-5 h-5 text-primary" />
              <h2>{t('my_rooms')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <Card key={room.id} className="hover:shadow-lg transition-shadow relative group">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center text-lg">
                      <span>{t('room_title', { id: room.id })}</span>
                      {room.ownerId === userId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setDeleteId(room.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{t('members_count', { count: room.members.length })}</p>
                    <Link href={`/room?id=${room.id}`}>
                      <Button className="w-full" variant="secondary">
                        {t('enter_room')}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}

              {rooms.length === 0 && (
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
                  <Card key={room.id} className="hover:shadow-lg transition-shadow relative group">
                    <CardHeader>
                      <CardTitle className="flex justify-between items-center text-lg">
                        <span>{t('room_title', { id: room.id })}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
                        <Button variant="secondary" className="w-full">{t('rejoin')}</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
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
      </main>

      <footer className="py-8 border-t border-border/30 text-center text-sm text-muted-foreground flex items-center justify-center gap-4 bg-background">
        <span>{t('copyright')}</span>
        <Link href="/admin" className="opacity-20 hover:opacity-100 transition-opacity" title={t('system_admin')}>
          <Shield className="w-4 h-4" />
        </Link>
      </footer>
    </div>
  );
}
