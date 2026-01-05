import { FastifyInstance } from 'fastify';
import { JoinRoomEvent, PlayerStateEvent, MediaChangeEvent, EventType } from '@cueplay/protocol';
import { RoomManager } from '../room/manager';
import { roomConnections, broadcastRoomUpdate } from './manager';

export async function websocketRoutes(fastify: FastifyInstance) {
    fastify.get('/ws', { websocket: true }, (connection: any, req) => {
        const socket = connection.socket || connection;

        if (!socket || !socket.on) {
            fastify.log.error({ msg: 'Invalid socket object', connection });
            return;
        }

        let currentRoomId: string | null = null;
        let pUserId: string | null = null;

        socket.on('message', async (message: any) => {
            try {
                const raw = message.toString();
                const event = JSON.parse(raw) as { type: EventType, payload: any };

                if (event.type === 'JOIN_ROOM') {
                    const payload = event.payload as any;
                    // Use joinRoom to register member in Room model
                    const room = await RoomManager.joinRoom(payload.roomId, payload.userId, payload.name);
                    if (room) {
                        currentRoomId = payload.roomId;
                        pUserId = payload.userId;

                        if (currentRoomId) {
                            if (!roomConnections.has(currentRoomId)) {
                                roomConnections.set(currentRoomId, new Map());
                            }
                            roomConnections.get(currentRoomId)!.set(pUserId!, socket);
                        }

                        fastify.log.info({ msg: 'User joined room', roomId: currentRoomId, userId: pUserId });

                        socket.send(JSON.stringify({ type: 'ack', payload: { status: 'joined', roomId: currentRoomId } }));

                        if (room.media) {
                            socket.send(JSON.stringify({ type: 'MEDIA_CHANGE', payload: room.media }));
                        }

                        // Send current playlist to new joiner
                        if (room.playlist && room.playlist.length > 0) {
                            socket.send(JSON.stringify({ type: 'PLAYLIST_UPDATE', payload: { playlist: room.playlist } }));
                        }

                        // Broadcast member update
                        if (currentRoomId) await broadcastRoomUpdate(currentRoomId);
                    } else {
                        socket.send(JSON.stringify({ type: 'error', payload: { msg: 'Room not found' } }));
                    }
                } else if (event.type === 'MEDIA_CHANGE') {
                    const payload = event.payload as MediaChangeEvent['payload'];
                    if (currentRoomId && roomConnections.has(currentRoomId)) {
                        const room = await RoomManager.getRoom(currentRoomId);
                        if (room) {
                            room.setMedia(payload);
                            await RoomManager.persist(room);
                            const clients = roomConnections.get(currentRoomId)!;
                            for (const client of clients.values()) {
                                if (client !== socket && client.readyState === 1) {
                                    client.send(JSON.stringify({ type: 'MEDIA_CHANGE', payload }));
                                }
                            }
                        }
                    }
                } else if (event.type === 'TAKE_CONTROL') {
                    if (currentRoomId && pUserId && roomConnections.has(currentRoomId)) {
                        const room = await RoomManager.getRoom(currentRoomId);
                        if (room) {
                            // Lock Check: Only owner can take control if room is locked
                            if (room.isLocked && room.ownerId !== pUserId) {
                                socket.send(JSON.stringify({ type: 'error', payload: { msg: 'Control is locked by owner' } }));
                                return;
                            }
                            room.setController(pUserId);
                            await RoomManager.persist(room);
                            fastify.log.info({ msg: 'User took control', roomId: currentRoomId, userId: pUserId });
                            await broadcastRoomUpdate(currentRoomId);
                        }
                    }
                } else if (event.type === 'UPDATE_ROOM') {
                    if (currentRoomId && pUserId && roomConnections.has(currentRoomId)) {
                        const room = await RoomManager.getRoom(currentRoomId);
                        if (room) {
                            if (room.ownerId !== pUserId) {
                                socket.send(JSON.stringify({ type: 'error', payload: { msg: 'Only owner can update room settings' } }));
                                return;
                            }
                            const { title, description, isLocked } = event.payload;
                            if (title !== undefined) room.setTitle(title);
                            if (description !== undefined) room.setDescription(description);
                            if (isLocked !== undefined) room.setIsLocked(isLocked);

                            await RoomManager.persist(room);
                            fastify.log.info({ msg: 'Room settings updated', roomId: currentRoomId, userId: pUserId });
                            await broadcastRoomUpdate(currentRoomId);
                        }
                    }
                } else if (event.type === 'PLAYER_STATE') {
                    if (currentRoomId && roomConnections.has(currentRoomId)) {
                        const payload = event.payload as PlayerStateEvent['payload'];
                        const clients = roomConnections.get(currentRoomId)!;
                        for (const client of clients.values()) {
                            if (client !== socket && client.readyState === 1) {
                                client.send(JSON.stringify({ type: 'PLAYER_STATE', payload }));
                            }
                        }
                    }

                } else if (event.type === 'VIDEO_PROGRESS') {
                    if (currentRoomId && pUserId && roomConnections.has(currentRoomId)) {
                        const payload = event.payload; // { time: number, playingItemId?: string, duration?: number, sentAt?: number }
                        // console.log(`[VIDEO_PROGRESS] User ${pUserId} sent progress ${payload.time} for item ${payload.playingItemId}`);

                        // Update individual progress
                        await RoomManager.updateMemberProgress(currentRoomId, pUserId, payload.time);

                        // If sender is controller, update room progress
                        const room = await RoomManager.getRoom(currentRoomId);
                        if (room && room.controllerId === pUserId && payload.playingItemId) {
                            // console.log(`[VIDEO_PROGRESS] Controller ${pUserId} triggering persistence for ${payload.playingItemId}`);
                            await RoomManager.updateRoomProgress(currentRoomId, payload.playingItemId, payload.time, payload.duration || 0);
                        } else if (!room) {
                            console.log(`[VIDEO_PROGRESS] Room ${currentRoomId} not found`);
                        } else if (room.controllerId !== pUserId) {
                            // console.log(`[VIDEO_PROGRESS] User ${pUserId} is not controller (${room.controllerId}), skipping persistence`);
                        } else if (!payload.playingItemId) {
                            console.log(`[VIDEO_PROGRESS] Missing playingItemId from controller ${pUserId}`);
                        }

                        // Broadcast progress to others so they can update their UI (Member list & Playlist)
                        const clients = roomConnections.get(currentRoomId);
                        if (clients) {
                            const progMsg = JSON.stringify({
                                type: 'MEMBER_PROGRESS',
                                payload: {
                                    userId: pUserId,
                                    time: payload.time,
                                    playingItemId: payload.playingItemId,
                                    duration: payload.duration
                                }
                            });
                            for (const [uid, client] of clients.entries()) {
                                if (uid !== pUserId && client.readyState === 1) {
                                    client.send(progMsg);
                                }
                            }
                        }
                    }
                } else if (event.type === 'PLAYLIST_UPDATE') {
                    fastify.log.info({ msg: 'Received PLAYLIST_UPDATE', roomId: currentRoomId });
                    if (currentRoomId && roomConnections.has(currentRoomId)) {
                        const payload = event.payload;

                        // Update Room State
                        const room = await RoomManager.getRoom(currentRoomId);
                        if (room) {
                            room.setPlaylist(payload.playlist);
                            await RoomManager.persist(room);

                            const clients = roomConnections.get(currentRoomId)!;
                            for (const client of clients.values()) {
                                if (client !== socket && client.readyState === 1) {
                                    client.send(JSON.stringify({ type: 'PLAYLIST_UPDATE', payload }));
                                }
                            }
                            fastify.log.info({ msg: 'Broadcasted PLAYLIST_UPDATE', roomId: currentRoomId });
                        }
                    }

                } else if (event.type === 'SET_ROOM_COOKIE') {
                    if (currentRoomId && pUserId && roomConnections.has(currentRoomId)) {
                        const room = await RoomManager.getRoom(currentRoomId);
                        if (room) {
                            if (room.ownerId !== pUserId) {
                                socket.send(JSON.stringify({ type: 'error', payload: { msg: 'Only owner can set room cookie' } }));
                            } else {
                                room.setQuarkCookie(event.payload.cookie);
                                await RoomManager.persist(room);
                                fastify.log.info({ msg: 'Room cookie updated via WS', roomId: currentRoomId });
                                await broadcastRoomUpdate(currentRoomId);
                            }
                        }
                    }
                } else if (event.type === 'CHAT_MESSAGE') {
                    if (currentRoomId && roomConnections.has(currentRoomId)) {
                        const payload = event.payload;
                        const clients = roomConnections.get(currentRoomId)!;
                        for (const client of clients.values()) {
                            if (client.readyState === 1) {
                                client.send(JSON.stringify({ type: 'CHAT_MESSAGE', payload }));
                            }
                        }
                    }
                }
            } catch (e) {
                fastify.log.error(e);
            }
        });

        socket.on('close', async () => {
            if (currentRoomId && pUserId && roomConnections.has(currentRoomId)) {
                const clients = roomConnections.get(currentRoomId)!;
                clients.delete(pUserId);

                const room = await RoomManager.getRoom(currentRoomId);
                if (room) {
                    // Auto-handoff removed: Keep controllerId persisted to allow reconnection.
                    // If the user is gone forever, others can explicitly Take Control.
                    /*
                    if (room.controllerId === pUserId) {
                        const nextUserId = clients.keys().next().value;
                        room.setController(nextUserId || null);
                        await RoomManager.persist(room);
                        fastify.log.info({ msg: 'Controller left, handoff to next', roomId: currentRoomId, nextUserId });
                    }
                    */

                    // Remove member from room on disconnect
                    await RoomManager.removeMember(currentRoomId, pUserId);
                }

                if (clients.size === 0) {
                    roomConnections.delete(currentRoomId);
                } else {
                    await broadcastRoomUpdate(currentRoomId);
                }
            }
        });
    });
}
