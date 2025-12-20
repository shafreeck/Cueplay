'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiClient, Room } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function Home() {
  const [userId, setUserId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

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
      await ApiClient.createRoom(userId);
      await loadRooms(userId);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Rooms</h1>
        <Button onClick={createRoom} disabled={loading}>
          {loading ? 'Creating...' : 'Create Room'}
        </Button>
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
                <Link href={`/rooms/${room.id}`}>
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
  );
}
