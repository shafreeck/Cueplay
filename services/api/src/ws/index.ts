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
                            room.setController(pUserId);
                            await RoomManager.persist(room);
                            fastify.log.info({ msg: 'User took control', roomId: currentRoomId, userId: pUserId });
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
                        const payload = event.payload; // { time: number, playingItemId?: string, duration?: number }

                        // Update individual progress
                        await RoomManager.updateMemberProgress(currentRoomId, pUserId, payload.time);

                        // If controller, update room's authoritative progress
                        const room = await RoomManager.getRoom(currentRoomId);
                        if (room && room.controllerId === pUserId && payload.playingItemId && payload.duration) {
                            await RoomManager.updateRoomProgress(currentRoomId, payload.playingItemId, payload.time, payload.duration);
                        }

                        // Broadcast progress to others so they can update their UI (Member list & Playlist)
                        const clients = roomConnections.get(currentRoomId);
                        if (clients) {
                            const progMsg = JSON.stringify({
                                type: 'MEMBER_PROGRESS',
                                payload: {
                                    userId: pUserId,
                                    time: payload.time,
                                    playingItemId: payload.playingItemId
                                }
                            });
                            for (const [uid, client] of clients.entries()) {
                                if (uid !== pUserId && client.readyState === 1) {
                                    client.send(progMsg);
                                }
                            }
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
                    // Auto-handoff controller if they left
                    if (room.controllerId === pUserId) {
                        const nextUserId = clients.keys().next().value;
                        room.setController(nextUserId || null);
                        await RoomManager.persist(room);
                        fastify.log.info({ msg: 'Controller left, handoff to next', roomId: currentRoomId, nextUserId });
                    }
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
