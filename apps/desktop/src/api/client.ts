import { API_BASE } from './config';

export interface Room {
    id: string;
    ownerId: string;
    members: any[];
}

export class ApiClient {
    static async listRooms(userId: string): Promise<Room[]> {
        const res = await fetch(`${API_BASE}/rooms?userId=${userId}`);
        if (!res.ok) throw new Error('Failed to list rooms');
        const data = await res.json();
        return data.rooms;
    }

    static async createRoom(userId: string): Promise<Room> {
        const res = await fetch(`${API_BASE}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });
        if (!res.ok) throw new Error('Failed to create room');
        const data = await res.json();
        return data.room;
    }

    static async deleteRoom(id: string, userId: string): Promise<void> {
        const res = await fetch(`${API_BASE}/rooms/${id}?userId=${userId}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to delete room');
        }
    }

    static async grantLease(deviceId: string): Promise<{ id: string, expiresAt: number }> {
        const res = await fetch(`${API_BASE}/leases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId }),
        });
        if (!res.ok) throw new Error('Failed to grant lease');
        const data = await res.json();
        return data.lease;
    }

    static async resolveVideo(fileId: string, roomId?: string): Promise<any> {
        const res = await fetch(`${API_BASE}/playback/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, roomId }),
        });
        if (!res.ok) throw new Error('Failed to resolve video');
        const data = await res.json();
        return { source: data.source, cookie: data.cookie };
    }
}
