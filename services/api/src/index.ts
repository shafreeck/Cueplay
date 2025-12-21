import fastify from 'fastify';
// @ts-ignore
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { websocketRoutes } from './ws';
import { roomRoutes } from './room/controller';
import { leaseRoutes } from './lease/controller';
import { playbackRoutes } from './playback/controller';
import { adminRoutes } from './admin/controller';
import { ConfigStore } from './config/store';
// import { proxyRoutes } from './stream/proxy';

const server = fastify({ logger: true });

server.register(cors, {
    origin: true, // Allow all origins (for dev)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});
server.register(websocket);
server.register(websocketRoutes);
server.register(roomRoutes);
server.register(leaseRoutes);
server.register(playbackRoutes);
server.register(adminRoutes);
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
