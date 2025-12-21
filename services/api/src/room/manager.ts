import { Room } from '@cueplay/room-core';
import prisma from '../prisma';

// In-memory cache for active rooms
const cache: Map<string, Room> = new Map();

export class RoomManager {
    static async createRoom(ownerId: string): Promise<Room> {
        let id = Math.random().toString(36).substring(7);
        let retries = 5;

        while (retries > 0) {
            const existing = await prisma.room.findUnique({ where: { id } });
            if (!existing) break;
            id = Math.random().toString(36).substring(7);
            retries--;
        }

        if (retries === 0) {
            throw new Error('Failed to generate unique room ID');
        }

        const room = new Room(id, ownerId);

        await prisma.room.create({
            data: {
                id,
                ownerId,
                controllerId: room.controllerId,
                quarkCookie: room.quarkCookie,
                playlist: JSON.stringify(room.playlist),
                members: {
                    create: {
                        userId: ownerId,
                        joinedAt: new Date()
                    }
                }
            }
        });

        cache.set(id, room);
        console.log(`[RoomManager] Created room ${id} for ${ownerId} in DB`);
        return room;
    }

    static async deleteRoom(id: string, userId: string): Promise<void> {
        const room = await this.getRoom(id);
        if (!room) return;

        if (room.ownerId !== userId) {
            throw new Error('Only the owner can delete the room');
        }

        // Remove from DB (members will be cascade deleted if configured, effectively ensuring cleanup)
        // Note: Prisma schema should ideally have onDelete: Cascade for members relation, 
        // but even if not, we can delete manually if needed. 
        // Assuming standard setup, or we clean up members first.

        // Manual cleanup to be safe if cascade isn't set
        await prisma.member.deleteMany({ where: { roomId: id } });
        await prisma.room.delete({ where: { id } });

        cache.delete(id);
        console.log(`[RoomManager] Deleted room ${id} by ${userId}`);
    }

    static async getRoom(id: string): Promise<Room | undefined> {
        // Return from cache if available
        if (cache.has(id)) return cache.get(id);

        const dbRoom = await prisma.room.findUnique({
            where: { id },
            include: { members: true }
        });

        if (!dbRoom) {
            console.log(`[RoomManager] Room ${id} not found in DB`);
            return undefined;
        }

        const room = new Room(dbRoom.id, dbRoom.ownerId, {
            controllerId: dbRoom.controllerId || undefined,
            media: dbRoom.media ? JSON.parse(dbRoom.media) : undefined,
            playlist: dbRoom.playlist ? JSON.parse(dbRoom.playlist) : [],
            quarkCookie: dbRoom.quarkCookie || '',
            members: dbRoom.members.map(m => ({
                userId: m.userId,
                name: m.name || undefined,
                joinedAt: m.joinedAt.getTime(),
                currentProgress: m.currentProgress || undefined
            }))
        });

        cache.set(id, room);
        console.log(`[RoomManager] Rehydrated room ${id} from DB`);
        return room;
    }

    static async joinRoom(id: string, userId: string, name?: string): Promise<Room> {
        let room = await this.getRoom(id);
        if (!room) {
            console.log(`[RoomManager] Room ${id} not found, auto-creating for ${userId}`);
            room = await this.createRoom(userId);
            if (name) room.addMember({ userId, name, joinedAt: Date.now() });
        } else {
            room.addMember({ userId, name, joinedAt: Date.now() });
        }

        await this.persist(room);
        console.log(`[RoomManager] User ${userId} (${name}) joined room ${id}`);
        return room;
    }

    static async listRooms(userId: string): Promise<Room[]> {
        const dbRooms = await prisma.room.findMany({
            where: { ownerId: userId },
            include: { members: true }
        });

        return Promise.all(dbRooms.map(async (dr) => {
            const cached = cache.get(dr.id);
            if (cached) return cached;

            const r = new Room(dr.id, dr.ownerId, {
                controllerId: dr.controllerId || undefined,
                media: dr.media ? JSON.parse(dr.media) : undefined,
                playlist: dr.playlist ? JSON.parse(dr.playlist) : [],
                quarkCookie: dr.quarkCookie || '',
                members: dr.members.map(m => ({
                    userId: m.userId,
                    name: m.name || undefined,
                    joinedAt: m.joinedAt.getTime(),
                    currentProgress: m.currentProgress || undefined
                }))
            });
            cache.set(r.id, r);
            return r;
        }));
    }

    /**
     * Persist current room state to database
     */
    static async persist(room: Room) {
        const json = room.toJSON();
        await prisma.room.update({
            where: { id: room.id },
            data: {
                controllerId: json.controllerId || null,
                media: json.media ? JSON.stringify(json.media) : null,
                playlist: JSON.stringify(json.playlist),
                quarkCookie: json.quarkCookie || '',
            }
        });

        // Sync members
        for (const member of json.members) {
            await prisma.member.upsert({
                where: { roomId_userId: { roomId: room.id, userId: member.userId } },
                update: {
                    name: member.name,
                    currentProgress: member.currentProgress
                },
                create: {
                    roomId: room.id,
                    userId: member.userId,
                    name: member.name,
                    joinedAt: new Date(member.joinedAt || Date.now()),
                    currentProgress: member.currentProgress
                }
            });
        }
    }
}
