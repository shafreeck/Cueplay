export interface BaseEvent {
    type: string;
    payload: any;
}

export type EventType = 'JOIN_ROOM' | 'LEAVE_ROOM' | 'SYNC_TIME' | 'PLAYER_STATE' | 'MEDIA_CHANGE' | 'ROOM_UPDATE' | 'TAKE_CONTROL' | 'VIDEO_PROGRESS' | 'PLAYLIST_UPDATE';

export interface RoomUpdateEvent extends BaseEvent {
    type: 'ROOM_UPDATE';
    payload: {
        roomId: string;
        members: { userId: string, joinedAt: number, isOnline: boolean, name?: string, currentProgress?: number }[];
        ownerId: string;
        controllerId: string | null;
    };
}

export interface JoinRoomEvent extends BaseEvent {
    type: 'JOIN_ROOM';
    payload: {
        roomId: string;
        userId: string;
        name?: string;
    };
}

export interface MediaChangeEvent extends BaseEvent {
    type: 'MEDIA_CHANGE';
    payload: {
        fileId: string;
        url: string;
        title?: string;
        provider: 'quark' | 'hls' | 'local';
    };
}

export interface PlayerStateEvent extends BaseEvent {
    type: 'PLAYER_STATE';
    payload: {
        state: 'playing' | 'paused' | 'buffering';
        time: number;
        playbackRate: number;
    };
}

export interface VideoProgressEvent extends BaseEvent {
    type: 'VIDEO_PROGRESS';
    payload: {
        time: number;
    };
}
