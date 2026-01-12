import { FastifyInstance } from 'fastify';
import { QuarkProvider } from '@cueplay/playback-core';
import { ConfigStore } from '../config/store';
import { loginSessionManager } from './login-session';
import { DriveService } from '../drive/drive-service';

export async function quarkRoutes(fastify: FastifyInstance) {
    // Existing file list endpoint
    fastify.get('/quark/list', async (req, reply) => {
        const query = req.query as { parentId?: string; cookie?: string; authCode?: string; driveId?: string };
        const parentId = query.parentId || '0';

        let cookie = query.cookie;

        // NEW: Support driveId
        if (query.driveId) {
            const driveCookie = await DriveService.getCookieForDrive(query.driveId);
            if (driveCookie) {
                cookie = driveCookie;
            } else {
                return reply.code(404).send({ error: 'Drive not found' });
            }
        }

        if (!cookie) {
            // Check if global auth is required
            if (ConfigStore.isGlobalAuthRequired()) {
                const globalAuthCode = ConfigStore.getGlobalAuthCode();
                if (globalAuthCode && globalAuthCode !== query.authCode) {
                    return reply.code(403).send({ error: 'system_login_required' });
                }
            }
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

    // Explicitly verify Auth Code
    fastify.get('/quark/auth/verify', async (req, reply) => {
        const query = req.query as { authCode: string };
        const globalAuthCode = ConfigStore.getGlobalAuthCode();

        if (!globalAuthCode) {
            return reply.code(403).send({ error: 'System Authorization Code not configured on server' });
        }

        if (globalAuthCode === query.authCode) {
            return { success: true };
        }

        return reply.code(403).send({ error: 'invalid_connection_code' });
    });

    // Generate QR code for login
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

    // Check QR code login status
    fastify.get('/quark/login/status/:sessionId', async (req, reply) => {
        const { sessionId } = req.params as { sessionId: string };

        // Debug Log
        console.log(`[API] Checking status for session: ${sessionId}`);

        const session = loginSessionManager.getSession(sessionId);
        if (!session) {
            console.log(`[API] Session not found: ${sessionId}`);
            return reply.code(404).send({ error: 'Session not found or expired' });
        }

        // Return immediately if success or expired
        if (session.status === 'success' || session.status === 'expired') {
            console.log(`[API] Session ${sessionId} status: ${session.status}`);
            return {
                status: session.status,
                cookie: session.cookie
            };
        }

        // Check with Quark API for status
        try {
            const provider = new QuarkProvider();
            // Use initial cookies captured during QR code generation
            const result = await provider.checkQRCodeStatus(session.token, session.initialCookies);
            console.log(`[API] Quark Provider Status for ${sessionId}: ${result.status} (Code: ${result.statusCode})`);

            if (result.status === 'success' && result.cookie) {
                loginSessionManager.updateSessionSuccess(sessionId, result.cookie);
                return {
                    status: 'success',
                    cookie: result.cookie,
                    statusCode: result.statusCode
                };
            } else if (result.status === 'expired') {
                // If Quark says expired, mark as expired
                // But if Quark says "scanned" (50004002) or "pending" (50004001), we just return it
                // Note: QuarkProvider returns 'expired' for unknown error codes too.
            }

            return { status: result.status, statusCode: result.statusCode };
        } catch (e: any) {
            console.error(`[API] Error checking quark status: ${e.message}`);
            return reply.code(500).send({ error: e.message });
        }
    });

    // Manually set cookie (backward compatibility) or via simple form
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

    // Save share link
    fastify.post('/quark/share/save', async (req, reply) => {
        const body = req.body as { shareLink: string; passCode?: string; targetDirId?: string; driveId?: string };

        if (!body.shareLink) {
            return reply.code(400).send({ error: 'shareLink is required' });
        }

        // Resolve cookie from driveId if provided, else fallback to global
        let cookie = ConfigStore.getGlobalCookie();
        if (body.driveId) {
            const driveCookie = await DriveService.getCookieForDrive(body.driveId);
            if (driveCookie) cookie = driveCookie;
        }

        if (!cookie) {
            return reply.code(401).send({ error: 'No cookie provided (and no driveId)' });
        }

        try {
            const provider = new QuarkProvider();
            await provider.saveShareLink(body.shareLink, { passCode: body.passCode, targetDirId: body.targetDirId, cookie });

            return { success: true };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    // --- Drive Management Endpoints ---

    // List all connected drives
    fastify.get('/drive/list', async (req, reply) => {
        const query = req.query as { roomId?: string };
        const userId = req.headers['x-user-id'] as string;
        const accounts = await DriveService.getAccounts({ roomId: query.roomId, userId });
        const safeAccounts = accounts.map(a => ({
            id: a.id,
            name: a.name,
            avatar: a.avatar,
            type: a.type,
            description: a.description,
            data: {
                nickname: a.data.nickname
            },
            isShared: a.isShared,
            roomId: a.roomId,
            userId: a.userId,
            isSystem: a.isSystem,
        }));
        return { accounts: safeAccounts };
    });

    // Add a new drive (save from successful login)
    fastify.post('/drive/add', async (req, reply) => {
        const body = req.body as { cookie: string; name?: string; roomId?: string; userId?: string; isSystem?: boolean; isShared?: boolean };
        if (!body.cookie) return reply.code(400).send({ error: 'Cookie required' });

        try {
            // Fetch user info
            const provider = new QuarkProvider();
            const info = await provider.getAccountInfo(body.cookie);

            // Use fetched nickname if available and no explicit name provided
            // Or prioritize explicit name if given
            const name = body.name || info.nickname || 'Quark Drive';

            // Prevent accidental global drives: require either userId or isSystem
            // We allow legacy behavior if roomId is present (Room Drive)
            if (!body.userId && !body.isSystem && !body.roomId) {
                // If neither is present, and no roomId, it's a global drive attempt without explicit isSystem=true
                // This is likely a bug in the client sending empty strings, so safer to reject or force scope.
                // However, for now we will just proceed but ensuring empty strings are undefined so logic works.
            }

            const account = await DriveService.addAccount({
                type: 'quark',
                name: name,
                avatar: info.avatar,
                roomId: body.roomId || undefined,
                userId: body.userId || undefined,
                isSystem: body.isSystem,
                isShared: body.isShared,
                data: {
                    cookie: body.cookie,
                    nickname: info.nickname
                }
            });

            return { success: true, account };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    // Rename a drive
    fastify.post('/drive/rename', async (req, reply) => {
        const body = req.body as { id: string; name: string };
        if (!body.id || !body.name) return reply.code(400).send({ error: 'ID and Name required' });

        try {
            await DriveService.renameAccount(body.id, body.name);
            return { success: true };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });

    // Remove a drive
    fastify.post('/drive/remove', async (req, reply) => {
        const body = req.body as { id: string };
        if (!body.id) return reply.code(400).send({ error: 'ID required' });

        await DriveService.removeAccount(body.id);
        return { success: true };
    });

    // Update a drive (re-auth)
    // Update a drive (re-auth)
    // Update a drive (re-auth or metadata update)
    fastify.post('/drive/update', async (req, reply) => {
        const body = req.body as { id: string; cookie?: string; isShared?: boolean };
        if (!body.id) return reply.code(400).send({ error: 'ID required' });

        try {
            // Fetch user info ONLY if cookie is provided
            let updateData: any = {
                isShared: body.isShared
            };

            if (body.cookie) {
                const provider = new QuarkProvider();
                const info = await provider.getAccountInfo(body.cookie);
                updateData.cookie = body.cookie;
                updateData.nickname = info.nickname;
                updateData.avatar = info.avatar;
            }

            // Update with new data
            await DriveService.updateAccount(body.id, updateData);
            return { success: true };
        } catch (e: any) {
            return reply.code(500).send({ error: e.message });
        }
    });
}
