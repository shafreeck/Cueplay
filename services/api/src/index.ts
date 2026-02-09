import fastify from 'fastify';
// @ts-ignore
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { websocketRoutes } from './ws';
import { roomRoutes } from './room/controller';
import { leaseRoutes } from './lease/controller';
import { playbackRoutes } from './playback/controller';
import { adminRoutes } from './admin/controller';
import { userRoutes } from './user/controller';
import { quarkRoutes } from './quark/controller';
import { ConfigStore } from './config/store';
// import { proxyRoutes } from './stream/proxy';

const server = fastify({ logger: true });
console.log('[API Server] Starting V6 (Quark Resolution Fixed)...');

server.register(cors, {
    origin: (origin, cb) => {
        // Log the origin to see what's actually being sent
        console.log('[CORS] Request from origin:', origin);
        cb(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: '*', // Allow all headers
    preflight: true,
    strictPreflight: false
});
server.register(websocket);
server.register(websocketRoutes);
server.register(roomRoutes);
server.register(leaseRoutes);
server.register(playbackRoutes);
server.register(adminRoutes);
server.register(userRoutes);
server.register(quarkRoutes);
// server.register(proxyRoutes);

server.get('/ping', async (request, reply) => {
    return { pong: 'it works' };
});

const start = async () => {
    try {
        await ConfigStore.load();
        const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
        await server.listen({ port, host: '0.0.0.0' });
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
