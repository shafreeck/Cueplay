export interface Member {
    userId: string;
    name?: string;
    joinedAt: number;
    currentProgress?: number;
}
export interface RoomState {
    id: string;
    ownerId: string;
    members: Member[];
    media?: {
        fileId: string;
        title?: string;
        provider: string;
    };
    controllerId: string | null;
    playlist?: any[];
    quarkCookie?: string;
}
export declare class Room {
    private state;
    constructor(id: string, ownerId: string, initialState?: Partial<RoomState>);
    static fromJSON(json: string): Room;
    get id(): string;
    get ownerId(): string;
    get members(): Member[];
    get media(): {
        fileId: string;
        title?: string;
        provider: string;
    } | undefined;
    get controllerId(): string | null;
    get playlist(): any[];
    get quarkCookie(): string;
    addMember(member: Member): void;
    removeMember(userId: string): void;
    setMedia(media: RoomState['media']): void;
    setController(userId: string): void;
    setPlaylist(playlist: any[]): void;
    setQuarkCookie(cookie: string): void;
    toJSON(): {
        id: string;
        ownerId: string;
        members: Member[];
        media?: {
            fileId: string;
            title?: string;
            provider: string;
        };
        controllerId: string | null;
        playlist?: any[];
        quarkCookie?: string;
    };
}
//# sourceMappingURL=room.d.ts.map