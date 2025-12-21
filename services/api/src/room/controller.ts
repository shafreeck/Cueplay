import { FastifyInstance } from 'fastify';
import { RoomManager } from './manager';
import { z } from 'zod';

export async function roomRoutes(fastify: FastifyInstance) {
    fastify.get('/rooms', async (req, reply) => {
        const query = req.query as { userId?: string };
        if (!query.userId) {
            return reply.code(400).send({ error: 'userId query param required' });
        }
        const rooms = await RoomManager.listRooms(query.userId);
        return { rooms: rooms.map(r => r.toJSON()) };
    });

    fastify.post('/rooms', async (req, reply) => {
        // Mock user ID from header or body for now
        // In real app, this comes from auth middleware
        const body = req.body as { userId: string };
        const userId = body?.userId || 'anon-' + Math.random().toString(36).substring(7);

        const room = await RoomManager.createRoom(userId);
        return { room: room.toJSON() };
    });

    fastify.post('/rooms/:id/join', async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = req.body as { userId: string };
        const userId = body?.userId || 'anon-' + Math.random().toString(36).substring(7);

        const room = await RoomManager.joinRoom(id, userId);
        if (!room) {
            return reply.code(404).send({ error: 'Room not found' });
        }
        return { room: room.toJSON() };
    });

    fastify.post('/rooms/:id/config/cookie', async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = req.body as { userId: string, cookie: string };

        const room = await RoomManager.getRoom(id);
        if (!room) {
            return reply.code(404).send({ error: 'Room not found' });
        }

        if (room.ownerId !== body.userId) {
            return reply.code(403).send({ error: 'Only the room owner can set the room cookie.' });
        }

        room.setQuarkCookie(body.cookie);
        await RoomManager.persist(room);
        console.log(`[RoomManager] Updated cookie for room ${id}`);
        return { success: true };
    });

    fastify.delete('/rooms/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const query = req.query as { userId: string }; // Ideally from auth, using query/body for now as per minimal setup

        // Check both query param and body for userId flexibility, 
        // though standard DELETE doesn't use body often. using query param for auth user id here.
        const userId = query.userId;

        if (!userId) {
            return reply.code(400).send({ error: 'userId required' });
        }

        try {
            await RoomManager.deleteRoom(id, userId);
            return { success: true };
        } catch (e: any) {
            console.error(e);
            if (e.message.includes('Only the owner')) {
                return reply.code(403).send({ error: e.message });
            }
            return reply.code(500).send({ error: 'Failed to delete room' });
        }
    });
}
