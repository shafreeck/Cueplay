import { FastifyInstance } from 'fastify';
import { RoomManager } from './manager';
import { z } from 'zod';

export async function roomRoutes(fastify: FastifyInstance) {
    fastify.get('/rooms', async (req, reply) => {
        const query = req.query as { userId?: string };
        if (!query.userId) {
            return reply.code(400).send({ error: 'userId query param required' });
        }
        const rooms = RoomManager.listRooms(query.userId);
        return { rooms: rooms.map(r => r.toJSON()) };
    });

    fastify.post('/rooms', async (req, reply) => {
        // Mock user ID from header or body for now
        // In real app, this comes from auth middleware
        const body = req.body as { userId: string };
        const userId = body?.userId || 'anon-' + Math.random().toString(36).substring(7);

        const room = RoomManager.createRoom(userId);
        return { room: room.toJSON() };
    });

    fastify.post('/rooms/:id/join', async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = req.body as { userId: string };
        const userId = body?.userId || 'anon-' + Math.random().toString(36).substring(7);

        const room = RoomManager.joinRoom(id, userId);
        if (!room) {
            return reply.code(404).send({ error: 'Room not found' });
        }
        return { room: room.toJSON() };
    });
}
