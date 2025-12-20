export interface BaseEvent {
    type: string;
    payload: any;
}

export type EventType = 'JOIN_ROOM' | 'LEAVE_ROOM' | 'SYNC_TIME' | 'PLAYER_STATE' | 'MEDIA_CHANGE';

export interface JoinRoomEvent extends BaseEvent {
    type: 'JOIN_ROOM';
    payload: {
        roomId: string;
        userId: string;
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
