export interface Member {
    userId: string;
    name?: string;
    joinedAt: number;
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
}

export class Room {
    private state: RoomState;

    constructor(id: string, ownerId: string) {
        this.state = {
            id,
            ownerId,
            members: [],
            controllerId: ownerId, // Owner starts as controller
            playlist: [], // Initialize empty playlist
        };
        // Add owner as first member
        this.addMember({ userId: ownerId, joinedAt: Date.now() });
    }

    get id() { return this.state.id; }
    get ownerId() { return this.state.ownerId; }
    get members() { return [...this.state.members]; }
    get media() { return this.state.media; }
    get controllerId() { return this.state.controllerId; }
    get playlist() { return this.state.playlist || []; }

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

    toJSON() {
        return { ...this.state };
    }
}
