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
        playingItemId?: string;
    };
    controllerId: string | null;
    playlist?: any[];
    quarkCookie?: string;
    title?: string;
    description?: string;
}

export class Room {
    private state: RoomState;

    constructor(id: string, ownerId: string, initialState?: Partial<RoomState>) {
        this.state = {
            id,
            ownerId,
            members: [],
            controllerId: ownerId, // Owner starts as controller
            playlist: [], // Initialize empty playlist
            quarkCookie: '', // Explicitly initialize
            ...initialState
        };
        // Add owner as member only if members list is empty
        if (this.state.members.length === 0) {
            this.addMember({ userId: ownerId, joinedAt: Date.now() });
        }
    }

    static fromJSON(json: string): Room {
        const state = JSON.parse(json) as RoomState;
        return new Room(state.id, state.ownerId, state);
    }

    get id() { return this.state.id; }
    get ownerId() { return this.state.ownerId; }
    get members() { return [...this.state.members]; }
    get media() { return this.state.media; }
    get controllerId() { return this.state.controllerId; }
    get playlist() { return this.state.playlist || []; }
    get quarkCookie() { return this.state.quarkCookie || ''; }
    get title() { return this.state.title || ''; }
    get description() { return this.state.description || ''; }

    addMember(member: Member) {
        const existingIndex = this.state.members.findIndex(m => m.userId === member.userId);
        if (existingIndex !== -1) {
            // Update existing member info (e.g. name, joinedAt if needed)
            this.state.members[existingIndex] = { ...this.state.members[existingIndex], ...member };
        } else {
            this.state.members.push(member);
        }
    }

    removeMember(userId: string) {
        this.state.members = this.state.members.filter(m => m.userId !== userId);
    }

    setMedia(media: RoomState['media']) {
        this.state.media = media;
    }

    setController(userId: string) {
        this.state.controllerId = userId;
    }

    setPlaylist(playlist: any[]) {
        this.state.playlist = playlist;
    }

    setQuarkCookie(cookie: string) {
        this.state.quarkCookie = cookie;
    }

    setTitle(title: string) {
        this.state.title = title;
    }

    setDescription(description: string) {
        this.state.description = description;
    }

    toJSON() {
        return { ...this.state };
    }
}
