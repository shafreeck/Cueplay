import { FastifyInstance } from 'fastify';
import { QuarkProvider } from '@cueplay/playback-core';
import { ConfigStore } from '../config/store';
import { loginSessionManager } from './login-session';

export async function quarkRoutes(fastify: FastifyInstance) {
    // Existing file list endpoint
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

    // New: Generate QR code for login
    fastify.post('/quark/login/qrcode', async (req, reply) => {
        try {
            const provider = new QuarkProvider();
            const { token, qrcodeUrl, cookies } = await provider.generateQRCode();

            // Create a session to track this login
            const session = loginSessionManager.createSession(token, cookies);

            return {
                sessionId: session.sessionId,
                qrcodeUrl,
                expiresAt: session.expiresAt,
            };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    // New: Check QR code login status
    fastify.get('/quark/login/status/:sessionId', async (req, reply) => {
        const { sessionId } = req.params as { sessionId: string };
        const { saveGlobal } = req.query as { saveGlobal?: string };

        const session = loginSessionManager.getSession(sessionId);
        if (!session) {
            return reply.code(404).send({ error: 'Session not found or expired' });
        }

        // If already successful, return the status
        if (session.status === 'success') {
            return {
                status: 'success',
                cookie: session.cookie,
            };
        }

        // Check with Quark API for status
        try {
            const provider = new QuarkProvider();
            // Use initial cookies captured during QR code generation
            const result = await provider.checkQRCodeStatus(session.token, session.initialCookies);

            if (result.status === 'success' && result.cookie) {
                // Update session
                loginSessionManager.updateSessionSuccess(sessionId, result.cookie);

                return {
                    status: 'success',
                    cookie: result.cookie,
                };
            }

            return { status: result.status };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    // New: Manually set cookie (backward compatibility)
    fastify.post('/quark/login/cookie', async (req, reply) => {
        const body = req.body as { cookie: string };

        if (!body.cookie) {
            return reply.code(400).send({ error: 'Cookie is required' });
        }

        try {
            // Validate cookie by trying to list directory
            const provider = new QuarkProvider();
            await provider.listDirectory('0', { cookie: body.cookie });

            // Save if valid
            await ConfigStore.save({ globalQuarkCookie: body.cookie });

            return { success: true };
        } catch (e: any) {
            return reply.code(400).send({ error: 'Invalid cookie: ' + e.message });
        }
    });
}
