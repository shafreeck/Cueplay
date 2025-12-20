import { FastifyInstance } from 'fastify';
import { QuarkProvider } from '@cueplay/playback-core';
import { ConfigStore } from '../config/store';
import { RoomManager } from '../room/manager';

const provider = new QuarkProvider();

export async function playbackRoutes(fastify: FastifyInstance) {
    fastify.post('/playback/resolve', async (req, reply) => {
        const body = req.body as { fileId: string, roomId?: string };

        if (!body.fileId) {
            return reply.code(400).send({ error: 'fileId is required' });
        }

        try {
            // Cookie Priority:
            // 1. Room Cookie (if roomId provided)
            // 2. Global Fallback Cookie
            let cookie = '';

            if (body.roomId) {
                const room = RoomManager.getRoom(body.roomId);
                if (room && room.quarkCookie) {
                    cookie = room.quarkCookie;
                }
            }

            if (!cookie) {
                cookie = ConfigStore.getGlobalCookie() || '';
            }

            const source = await provider.resolvePlayableSource(body.fileId, {
                cookie
            });

            fastify.log.info({ msg: 'Resolved source', fileId: body.fileId, source });
            return { source, cookie };
        } catch (e: any) {
            fastify.log.error({ msg: 'Resolve failed', error: e.message });
            return reply.code(500).send({ error: 'Failed to resolve video' });
        }
    });
}
