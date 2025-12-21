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

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
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
      toast({ title: "Room Created", description: `Joined room ${room.id}` });
      router.push(`/room?id=${room.id}`);
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Failed to create room", description: e.message });
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
      toast({ title: "Room Deleted", description: "The room has been successfully deleted." });
      setRooms(prev => prev.filter(r => r.id !== deleteId));

      // Also remove from visited if present
      RoomHistory.removeVisitedRoom(deleteId);
      loadVisited();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to delete room", description: e.message });
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
            <h1 className="text-3xl font-bold">Rooms</h1>
            <ModeToggle />
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter Room ID"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              className="w-40"
            />
            <Button onClick={joinRoom} variant="outline" disabled={!joinId}>Join</Button>
            <Button onClick={createRoom} disabled={loading}>
              {loading ? 'Creating...' : 'Create Room'}
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
              <h2>My Rooms</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <Card key={room.id} className="hover:shadow-lg transition-shadow relative group">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center text-lg">
                      <span>Room {room.id}</span>
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
                    <p className="text-sm text-muted-foreground mb-4">Members: {room.members.length}</p>
                    <Link href={`/room?id=${room.id}`}>
                      <Button className="w-full" variant="secondary">
                        Enter Room
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}

              {rooms.length === 0 && (
                <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  <p>You haven't created any rooms yet.</p>
                  <Button variant="link" onClick={createRoom} className="mt-2">Create your first room</Button>
                </div>
              )}
            </div>
          </section>

          {/* Visited Rooms Section - Only show if there are rooms */}
          {otherVisitedRooms.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4 text-xl font-semibold mt-8 border-t pt-8">
                <History className="w-5 h-5 text-primary" />
                <h2>Visited Rooms</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherVisitedRooms.map((room) => (
                  <Card key={room.id} className="hover:shadow-lg transition-shadow relative group">
                    <CardHeader>
                      <CardTitle className="flex justify-between items-center text-lg">
                        <span>Room {room.id}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove from history"
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
                        {room.lastVisited ? `Visited: ${new Date(room.lastVisited).toLocaleDateString()}` : 'Visited recently'}
                      </p>
                      <Link href={`/room?id=${room.id}`}>
                        <Button variant="secondary" className="w-full">Rejoin</Button>
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
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the room and remove all members.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button onClick={handleDeleteRoom} variant="destructive">
                Delete Room
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <footer className="py-8 border-t border-border/30 text-center text-sm text-muted-foreground flex items-center justify-center gap-4 bg-background">
        <span>© 2025 CuePlay</span>
        <Link href="/admin" className="opacity-20 hover:opacity-100 transition-opacity" title="System Admin">
          <Shield className="w-4 h-4" />
        </Link>
      </footer>
    </div>
  );
}
