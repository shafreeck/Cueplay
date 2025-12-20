import { FastifyInstance } from 'fastify';
import { QuarkProvider } from '@cueplay/playback-core';

const provider = new QuarkProvider();

export async function playbackRoutes(fastify: FastifyInstance) {
    fastify.post('/playback/resolve', async (req, reply) => {
        const body = req.body as { fileId: string, cookie?: string };

        if (!body.fileId) {
            return reply.code(400).send({ error: 'fileId is required' });
        }

        try {
            // QuarkProvider expects { cookie } in context
            // In a real app, this cookie might come from DB (user account) or client
            const source = await provider.resolvePlayableSource(body.fileId, {
                cookie: body.cookie || ''
            });

            fastify.log.info({ msg: 'Resolved source', fileId: body.fileId, source });
            return { source };
        } catch (e: any) {
            fastify.log.error({ msg: 'Resolve failed', error: e.message });
            return reply.code(500).send({ error: 'Failed to resolve video' });
        }
    });
}
