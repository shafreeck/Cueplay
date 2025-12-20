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
}

export class Room {
    private state: RoomState;

    constructor(id: string, ownerId: string) {
        this.state = {
            id,
            ownerId,
            members: [],
        };
        // Add owner as first member
        this.addMember({ userId: ownerId, joinedAt: Date.now() });
    }

    get id() { return this.state.id; }
    get ownerId() { return this.state.ownerId; }
    get members() { return [...this.state.members]; }
    get media() { return this.state.media; }

    addMember(member: Member) {
        if (!this.state.members.find(m => m.userId === member.userId)) {
            this.state.members.push(member);
        }
    }

    removeMember(userId: string) {
        this.state.members = this.state.members.filter(m => m.userId !== userId);
    }

    setMedia(media: RoomState['media']) {
        this.state.media = media;
    }

    toJSON() {
        return { ...this.state };
    }
}
