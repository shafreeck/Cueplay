import { FastifyInstance } from 'fastify';
import prisma from '../prisma';

export async function userRoutes(fastify: FastifyInstance) {
    fastify.put('/users/:userId/cookie', async (req, reply) => {
        const { userId } = req.params as { userId: string };
        const { cookie } = req.body as { cookie: string };

        // Allow clearing cookie by sending empty string or null?
        // If cookie is missing in body, maybe error.

        try {
            if (cookie) {
                await prisma.user.upsert({
                    where: { id: userId },
                    update: { quarkCookie: cookie },
                    create: { id: userId, quarkCookie: cookie }
                });
            } else {
                // If explicit empty string/null, delete it?
                // For now assuming we just overwrite with whatever string or empty.
                await prisma.user.upsert({
                    where: { id: userId },
                    update: { quarkCookie: null },
                    create: { id: userId, quarkCookie: null }
                });
            }
            return { success: true };
        } catch (e: any) {
            fastify.log.error(e);
            return reply.code(500).send({ error: 'Failed to update user cookie' });
        }
    });

    fastify.get('/users/:userId/cookie', async (req, reply) => {
        const { userId } = req.params as { userId: string };
        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            return { cookie: user?.quarkCookie || null };
        } catch (e: any) {
            fastify.log.error(e);
            return reply.code(500).send({ error: 'Failed to fetch user cookie' });
        }
    });
}
