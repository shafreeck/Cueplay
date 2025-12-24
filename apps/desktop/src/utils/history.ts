import { Room } from '@/api/client';

const HISTORY_KEY = 'cueplay_visited_rooms';

export interface VisitedRoom {
    id: string;
    ownerId: string;
    lastVisited: number;
    memberCount?: number; // Optional snapshot
    title?: string;
    description?: string;
}

export const RoomHistory = {
    addVisitedRoom: (room: Room) => {
        const history = RoomHistory.getVisitedRooms();
        const existingIndex = history.findIndex(r => r.id === room.id);

        const entry: VisitedRoom = {
            id: room.id,
            ownerId: room.ownerId || 'unknown',
            lastVisited: Date.now(),
            memberCount: room.members?.length,
            title: room.title,
            description: room.description
        };

        if (existingIndex !== -1) {
            history[existingIndex] = entry;
        } else {
            history.unshift(entry);
        }

        // Limit history to 50 items
        if (history.length > 50) {
            history.length = 50;
        }

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    },

    getVisitedRooms: (): VisitedRoom[] => {
        try {
            const json = localStorage.getItem(HISTORY_KEY);
            return json ? JSON.parse(json) : [];
        } catch (e) {
            console.error('Failed to parse visited rooms history', e);
            return [];
        }
    },

    removeVisitedRoom: (roomId: string) => {
        let history = RoomHistory.getVisitedRooms();
        history = history.filter(r => r.id !== roomId);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        return history;
    },

    clear: () => {
        localStorage.removeItem(HISTORY_KEY);
    }
};
