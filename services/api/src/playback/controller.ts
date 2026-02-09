
import { FastifyInstance } from 'fastify';
import { QuarkProvider } from '@cueplay/playback-core';
import { ConfigStore } from '../config/store';
import { RoomManager } from '../room/manager';
import * as fs from 'fs';
import * as path from 'path';

import prisma from '../prisma';

const provider = new QuarkProvider();

// Force restart trigger
export async function playbackRoutes(fastify: FastifyInstance) {
    fastify.post('/playback/resolve', async (req, reply) => {
        const body = req.body as { fileId: string, roomId?: string, authCode?: string, isAudio?: boolean };

        if (!body.fileId) {
            return reply.code(400).send({ error: 'fileId is required' });
        }

        try {
            // Cookie Priority:
            // 1. Drive ID Cookie (Specific authorization for this resource)
            // 2. Room Cookie (if roomId provided)
            // 3. User Cookie (Room Owner)
            // 4. Global Fallback Cookie (Requires Auth Code)
            let cookie = '';

            // High Priority: Drive ID (Specific authorization for this resource)
            // This overrides room/user cookies because the resource explicitly belongs to this drive.
            if ((req.body as any).driveId) {
                fastify.log.info({ msg: 'Attempting Drive cookie', driveId: (req.body as any).driveId });
                const { DriveService } = await import('../drive/drive-service');
                const driveCookie = await DriveService.getCookieForDrive((req.body as any).driveId);
                if (driveCookie) {
                    cookie = driveCookie;
                    fastify.log.info({ msg: 'Selected Drive cookie', length: cookie.length });
                } else {
                    fastify.log.warn({ msg: 'Drive cookie not found', driveId: (req.body as any).driveId });
                }
            }

            if (!cookie && body.roomId) {
                fastify.log.info({ msg: 'Attempting Room/User cookie', roomId: body.roomId });
                const room = await RoomManager.getRoom(body.roomId);
                if (room) {
                    if (room.quarkCookie) {
                        cookie = room.quarkCookie;
                        fastify.log.info({ msg: 'Selected Room cookie', length: cookie.length });
                    } else if (room.ownerId) {
                        // Check User Cookie
                        const user = await prisma.user.findUnique({ where: { id: room.ownerId } });
                        if (user && user.quarkCookie) {
                            cookie = user.quarkCookie;
                            fastify.log.info({ msg: 'Selected User cookie', length: cookie.length });
                        }
                    }
                }
            }

            if (!cookie) {
                fastify.log.info({ msg: 'Attempting Drive accounts fallback' });
                const { DriveService } = await import('../drive/drive-service');
                const accounts = await DriveService.getAccounts();

                // Priority for fallback: 1. System Drives, 2. Shared Drives
                const systemDrive = accounts.find(a => a.isSystem);
                const sharedDrive = accounts.find(a => a.isShared);
                const fallbackDrive = systemDrive || sharedDrive;

                if (fallbackDrive) {
                    cookie = fallbackDrive.data.cookie;
                    fastify.log.info({ msg: 'Selected Fallback Drive cookie', length: cookie.length, driveName: fallbackDrive.name });
                }
            }

            if (!cookie) {
                fastify.log.info({ msg: 'Attempting Legacy Global fallback cookie' });
                const globalAuthCode = ConfigStore.getGlobalAuthCode();
                if (globalAuthCode && globalAuthCode !== body.authCode) {
                    fastify.log.warn({ msg: 'Global auth mismatch', provided: body.authCode });
                    return reply.code(403).send({ error: 'system_login_required' });
                }
                cookie = ConfigStore.getGlobalCookie() || '';
                if (cookie) fastify.log.info({ msg: 'Selected Global cookie', length: cookie.length });
            }

            if (cookie) cookie = cookie.trim();

            if (!cookie) {
                fastify.log.warn({ msg: 'No cookie found for playback', fileId: body.fileId, driveId: (req.body as any).driveId, roomId: body.roomId });
                return reply.code(401).send({ error: 'No authorization cookie available. Please log in or set a system cookie.' });
            }

            fastify.log.info({ msg: 'Final resolution cookie', length: cookie.length });

            const source = await provider.resolvePlayableSource(body.fileId, {
                cookie,
                isAudio: body.isAudio
            });

            fastify.log.info({ msg: 'Resolved source', fileId: body.fileId, source });

            // Return the cookie from source headers which may include fresh Video-Auth tokens
            const finalCookie = source.headers?.['Cookie'] || cookie;

            // Auto-persist cookie back to the source if it changed
            if (finalCookie && finalCookie !== cookie) {
                try {
                    if ((req.body as any).driveId) {
                        const { DriveService } = await import('../drive/drive-service');
                        await DriveService.updateAccount((req.body as any).driveId, { cookie: finalCookie });
                    } else if (body.roomId) {
                        const room = await RoomManager.getRoom(body.roomId);
                        if (room && room.quarkCookie === cookie) {
                            await prisma.room.update({ where: { id: body.roomId }, data: { quarkCookie: finalCookie } });
                        } else {
                            // Check if it was a user cookie
                            const user = await prisma.user.findFirst({ where: { quarkCookie: cookie } });
                            if (user) {
                                await prisma.user.update({ where: { id: user.id }, data: { quarkCookie: finalCookie } });
                            }
                        }
                    } else {
                        // Fallback global update
                        if (ConfigStore.getGlobalCookie() === cookie) {
                            await ConfigStore.save({ globalQuarkCookie: finalCookie });
                        }
                    }
                } catch (saveErr) {
                    fastify.log.warn({ msg: 'Failed to auto-persist updated cookie', error: saveErr });
                }
            }

            // Inject driveId into meta so it can be broadcasted to other clients for sync
            if ((req.body as any).driveId) {
                source.meta = { ...source.meta, driveId: (req.body as any).driveId };
            }

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
