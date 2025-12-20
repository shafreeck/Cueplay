import { FastifyInstance } from 'fastify';
import { JoinRoomEvent, PlayerStateEvent, MediaChangeEvent, EventType } from '@cueplay/protocol';
import { RoomManager } from '../room/manager';

// Map roomId -> Set<WebSocket> for simple broadcasting
const roomConnections = new Map<string, Set<any>>();

export async function websocketRoutes(fastify: FastifyInstance) {
    fastify.get('/ws', { websocket: true }, (connection: any, req) => {
        fastify.log.info({ msg: 'WS Handler called', connectionKeys: Object.keys(connection), isSocket: !!connection.socket });
        const socket = connection.socket || connection; // Fallback check

        if (!socket || !socket.on) {
            fastify.log.error({ msg: 'Invalid socket object', connection });
            return;
        }

        fastify.log.info({ msg: 'New WebSocket connection', ip: req.ip });

        let currentRoomId: string | null = null;
        let userId: string | null = null;

        socket.on('message', (message: any) => {
            fastify.log.info({ msg: 'Received WS message', data: message.toString() });
            try {
                const raw = message.toString();
                const event = JSON.parse(raw) as { type: EventType, payload: any };

                if (event.type === 'JOIN_ROOM') {
                    const payload = event.payload as JoinRoomEvent['payload'];
                    const room = RoomManager.getRoom(payload.roomId);
                    if (room) {
                        currentRoomId = payload.roomId;
                        userId = payload.userId;

                        // Add to connection map
                        if (!roomConnections.has(currentRoomId)) {
                            roomConnections.set(currentRoomId, new Set());
                        }
                        roomConnections.get(currentRoomId)!.add(socket);

                        fastify.log.info({ msg: 'User joined room', roomId: currentRoomId, userId, count: roomConnections.get(currentRoomId)!.size });

                        // Send ACK
                        socket.send(JSON.stringify({ type: 'ack', payload: { status: 'joined', roomId: currentRoomId } }));

                        // Sync current media if exists
                        if (room.media) {
                            socket.send(JSON.stringify({
                                type: 'MEDIA_CHANGE',
                                payload: room.media
                            }));
                        }
                    } else {
                        fastify.log.warn({ msg: 'Room not found', roomId: payload.roomId });
                        socket.send(JSON.stringify({ type: 'error', payload: { msg: 'Room not found' } }));
                    }
                } else if (event.type === 'MEDIA_CHANGE') {
                    const payload = event.payload as MediaChangeEvent['payload'];
                    if (currentRoomId) {
                        const room = RoomManager.getRoom(currentRoomId);
                        if (room) {
                            room.setMedia(payload);
                            fastify.log.info({ msg: 'Room media updated', roomId: currentRoomId, fileId: payload.fileId });

                            // Broadcast to others
                            for (const client of roomConnections.get(currentRoomId)!) {
                                if (client !== socket && client.readyState === 1) {
                                    client.send(JSON.stringify({ type: 'MEDIA_CHANGE', payload }));
                                }
                            }
                        }
                    }
                } else if (event.type === 'PLAYER_STATE') {
                    // Broadcast to others in the room
                    if (currentRoomId && roomConnections.has(currentRoomId)) {
                        const payload = event.payload as PlayerStateEvent['payload'];
                        fastify.log.info({ msg: 'Broadcasting state', roomId: currentRoomId });

                        for (const client of roomConnections.get(currentRoomId)!) {
                            if (client !== socket && client.readyState === 1) { // 1 = OPEN
                                client.send(JSON.stringify({ type: 'PLAYER_STATE', payload }));
                            }
                        }
                    } else {
                        fastify.log.warn({ msg: 'Broadcast failed', currentRoomId });
                    }
                }
            } catch (e) {
                fastify.log.error(e);
            }
        });

        socket.on('close', () => {
            if (currentRoomId && roomConnections.has(currentRoomId)) {
                roomConnections.get(currentRoomId)!.delete(socket);
                if (roomConnections.get(currentRoomId)!.size === 0) {
                    roomConnections.delete(currentRoomId);
                }
            }
        });
    });
}
