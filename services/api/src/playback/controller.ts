
import { FastifyInstance } from 'fastify';
import { QuarkProvider } from '@cueplay/playback-core';
import { ConfigStore } from '../config/store';
import { RoomManager } from '../room/manager';
import * as fs from 'fs';
import * as path from 'path';

import prisma from '../prisma';

const provider = new QuarkProvider();

export async function playbackRoutes(fastify: FastifyInstance) {
    fastify.post('/playback/resolve', async (req, reply) => {
        const body = req.body as { fileId: string, roomId?: string, authCode?: string };

        if (!body.fileId) {
            return reply.code(400).send({ error: 'fileId is required' });
        }

        try {
            // Cookie Priority:
            // 1. Room Cookie (if roomId provided)
            // 2. User Cookie (Room Owner)
            // 3. Global Fallback Cookie (Requires Auth Code)
            let cookie = '';

            if (body.roomId) {
                const room = await RoomManager.getRoom(body.roomId);
                if (room) {
                    if (room.quarkCookie) {
                        cookie = room.quarkCookie;
                    } else if (room.ownerId) {
                        // Check User Cookie
                        const user = await prisma.user.findUnique({ where: { id: room.ownerId } });
                        if (user && user.quarkCookie) {
                            cookie = user.quarkCookie;
                        }
                    }
                }
            }

            // High Priority: Drive ID (Specific authorization for this resource)
            // This overrides room/user cookies because the resource explicitly belongs to this drive.
            if ((req.body as any).driveId) {
                const { DriveService } = await import('../drive/drive-service');
                const driveCookie = await DriveService.getCookieForDrive((req.body as any).driveId);
                if (driveCookie) {
                    cookie = driveCookie;
                }
            }

            if (!cookie) {
                const globalAuthCode = ConfigStore.getGlobalAuthCode();
                if (globalAuthCode && globalAuthCode !== body.authCode) {
                    return reply.code(403).send({ error: 'system_login_required' });
                }
                cookie = ConfigStore.getGlobalCookie() || '';
            }

            if (cookie) cookie = cookie.trim();

            if (!cookie) {
                fastify.log.warn({ msg: 'No cookie found for playback', fileId: body.fileId });
                return reply.code(401).send({ error: 'No authorization cookie available. Please log in or set a system cookie.' });
            }

            fastify.log.info({ msg: 'Resolving with cookie', length: cookie.length });

            const source = await provider.resolvePlayableSource(body.fileId, {
                cookie
            });

            fastify.log.info({ msg: 'Resolved source', fileId: body.fileId, source });

            // Return the cookie from source headers which may include fresh Video-Auth tokens
            const finalCookie = source.headers?.['Cookie'] || cookie;
            return { source, cookie: finalCookie };
        } catch (e: any) {
            const logMsg = `[${new Date().toISOString()}] Resolve failed for ${body.fileId}: ${e.message}\n`;
            try {
                fs.appendFileSync(path.join(process.cwd(), 'api-debug.log'), logMsg);
            } catch (err) { /* ignore */ }

            fastify.log.error({ msg: 'Resolve failed', error: e.message });
            // Return detailed error to client for debugging
            return reply.code(500).send({ error: `Failed to resolve video: ${e.message}` });
        }
    });
}
