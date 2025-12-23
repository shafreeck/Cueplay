import { RoomManager } from '../room/manager';
import { ConfigStore } from '../config/store';

// Map roomId -> Map<userId, WebSocket>
export const roomConnections = new Map<string, Map<string, any>>();

export async function broadcastRoomUpdate(roomId: string, excludeUserId?: string) {
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
            quarkCookie: room.quarkCookie,
            title: room.title,
            description: room.description,
            hasGlobalCookie: !!ConfigStore.getGlobalCookie()
        }
    };

    console.log(`[WS Manager] Broadcasting ROOM_UPDATE for ${roomId}:`, {
        title: event.payload.title,
        description: event.payload.description,
        memberCount: event.payload.members.length
    });

    const msg = JSON.stringify(event);
    for (const [uid, client] of clients.entries()) {
        if (uid !== excludeUserId && client.readyState === 1) {
            client.send(msg);
        }
    }
}
