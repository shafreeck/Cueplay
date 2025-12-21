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
import { Shield } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const [userId, setUserId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [joinId, setJoinId] = useState('');

  useEffect(() => {
    // Generate or load user ID
    let stored = localStorage.getItem('cueplay_userid');
    if (!stored) {
      stored = 'user-' + Math.random().toString(36).substring(7);
      localStorage.setItem('cueplay_userid', stored);
    }
    setUserId(stored);
    loadRooms(stored);
  }, []);

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

  return (
    <div className="min-h-screen flex flex-col">
      <main className="container mx-auto p-8 flex-1">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">My Rooms</h1>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <Card key={room.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Room {room.id}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Owner: {room.ownerId}</p>
                <p className="text-sm text-muted-foreground">Members: {room.members.length}</p>
                <div className="mt-4">
                  <Link href={`/room?id=${room.id}`}>
                    <Button variant="outline" className="w-full">Join Room</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}

          {rooms.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No rooms found. Create one to get started!
            </div>
          )}
        </div>
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
