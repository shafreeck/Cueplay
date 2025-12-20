import { FastifyInstance } from 'fastify';
import { ConfigStore } from '../config/store';

export async function adminRoutes(fastify: FastifyInstance) {
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'; // Default fallback

    // Auth Middleware (Simplistic for now)
    const requireAuth = async (req: any, reply: any) => {
        const authHeader = req.headers['authorization'];
        if (authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
            reply.code(401).send({ error: 'Unauthorized' });
            return;
        }
    };

    fastify.post('/admin/auth', async (req, reply) => {
        const body = req.body as { password: string };
        if (body.password === ADMIN_PASSWORD) {
            return { token: ADMIN_PASSWORD }; // In real app, issue JWT
        }
        return reply.code(401).send({ error: 'Invalid password' });
    });

    fastify.get('/admin/config/cookie', async (req, reply) => {
        await requireAuth(req, reply);
        const cookie = ConfigStore.getGlobalCookie();
        return { cookie: cookie || '' };
    });

    fastify.post('/admin/config/cookie', async (req, reply) => {
        await requireAuth(req, reply);
        const body = req.body as { cookie: string };
        await ConfigStore.save({ globalQuarkCookie: body.cookie });
        return { success: true };
    });
}
