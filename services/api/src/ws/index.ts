import { FastifyInstance } from 'fastify';
import { JoinRoomEvent, PlayerStateEvent, MediaChangeEvent, EventType } from '@cueplay/protocol';
import { RoomManager } from '../room/manager';

// Map roomId -> Map<userId, WebSocket>
const roomConnections = new Map<string, Map<string, any>>();

export async function websocketRoutes(fastify: FastifyInstance) {
    fastify.get('/ws', { websocket: true }, (connection: any, req) => {
        const socket = connection.socket || connection;

        if (!socket || !socket.on) {
            fastify.log.error({ msg: 'Invalid socket object', connection });
            return;
        }

        let currentRoomId: string | null = null;
        let pUserId: string | null = null;

        const broadcastRoomUpdate = async (roomId: string) => {
            const room = await RoomManager.getRoom(roomId);
            const clients = roomConnections.get(roomId);
            if (!room || !clients) return;

            const members = room.members.map((m: any) => ({
                ...m,
                isOnline: clients.has(m.userId) && clients.get(m.userId)!.readyState === 1
            }));

            const event = {
                type: 'ROOM_UPDATE',
                payload: {
                    roomId,
                    members,
                    ownerId: room.ownerId,
                    controllerId: room.controllerId,
                    quarkCookie: room.quarkCookie
                }
            };

            const msg = JSON.stringify(event);
            for (const client of clients.values()) {
                if (client.readyState === 1) client.send(msg);
            }
        };

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
                } else if (event.type === 'VIDEO_PROGRESS') {
                    if (currentRoomId && pUserId && roomConnections.has(currentRoomId)) {
                        const payload = event.payload; // { time: number }
                        const room = await RoomManager.getRoom(currentRoomId);
                        if (room) {
                            room.addMember({
                                userId: pUserId,
                                currentProgress: payload.time
                            } as any);
                            await RoomManager.persist(room);
                            await broadcastRoomUpdate(currentRoomId);
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

        socket.on('close', () => {
            if (currentRoomId && pUserId && roomConnections.has(currentRoomId)) {
                const clients = roomConnections.get(currentRoomId)!;
                clients.delete(pUserId);
                if (clients.size === 0) {
                    roomConnections.delete(currentRoomId);
                } else {
                    broadcastRoomUpdate(currentRoomId);
                }
            }
        });
    });
}
