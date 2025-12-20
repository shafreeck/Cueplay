import { Room } from '@cueplay/room-core';

// In-memory store for now
const rooms: Map<string, Room> = new Map();

export class RoomManager {
    static createRoom(ownerId: string): Room {
        const id = Math.random().toString(36).substring(7); // Simple ID
        const room = new Room(id, ownerId);
        rooms.set(id, room);
        console.log(`[RoomManager] Created room ${id} for ${ownerId}. Total rooms: ${rooms.size}`);
        return room;
    }

    static getRoom(id: string): Room | undefined {
        const room = rooms.get(id);
        console.log(`[RoomManager] Getting room ${id}: ${!!room}`);
        return room;
    }

    static joinRoom(id: string, userId: string): Room {
        let room = rooms.get(id);
        if (!room) {
            console.log(`[RoomManager] Room ${id} not found, auto-creating for ${userId}`);
            room = new Room(id, userId);
            rooms.set(id, room);
        }

        room.addMember({ userId, joinedAt: Date.now() });
        console.log(`[RoomManager] User ${userId} joined room ${id}`);
        return room;
    }

    static listRooms(ownerId: string): Room[] {
        return Array.from(rooms.values()).filter(r => r.ownerId === ownerId);
    }
}
