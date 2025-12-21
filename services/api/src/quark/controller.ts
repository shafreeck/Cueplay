import { FastifyInstance } from 'fastify';
import { QuarkProvider } from '@cueplay/playback-core';
import { ConfigStore } from '../config/store';

export async function quarkRoutes(fastify: FastifyInstance) {
    fastify.get('/quark/list', async (req, reply) => {
        const query = req.query as { parentId?: string; cookie?: string };
        const parentId = query.parentId || '0';

        let cookie = query.cookie;
        if (!cookie) {
            cookie = ConfigStore.getGlobalCookie();
        }

        if (!cookie) {
            return reply.code(401).send({ error: 'No cookie provided and no global cookie set' });
        }

        try {
            const provider = new QuarkProvider();
            const list = await provider.listDirectory(parentId, { cookie });
            return { list };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });
}
