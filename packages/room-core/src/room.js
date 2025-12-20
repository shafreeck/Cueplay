"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
class Room {
    state;
    constructor(id, ownerId, initialState) {
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
    static fromJSON(json) {
        const state = JSON.parse(json);
        return new Room(state.id, state.ownerId, state);
    }
    get id() { return this.state.id; }
    get ownerId() { return this.state.ownerId; }
    get members() { return [...this.state.members]; }
    get media() { return this.state.media; }
    get controllerId() { return this.state.controllerId; }
    get playlist() { return this.state.playlist || []; }
    get quarkCookie() { return this.state.quarkCookie || ''; }
    addMember(member) {
        const existingIndex = this.state.members.findIndex(m => m.userId === member.userId);
        if (existingIndex !== -1) {
            // Update existing member info (e.g. name, joinedAt if needed)
            this.state.members[existingIndex] = { ...this.state.members[existingIndex], ...member };
        }
        else {
            this.state.members.push(member);
        }
    }
    removeMember(userId) {
        this.state.members = this.state.members.filter(m => m.userId !== userId);
    }
    setMedia(media) {
        this.state.media = media;
    }
    setController(userId) {
        this.state.controllerId = userId;
    }
    setPlaylist(playlist) {
        this.state.playlist = playlist;
    }
    setQuarkCookie(cookie) {
        this.state.quarkCookie = cookie;
    }
    toJSON() {
        return { ...this.state };
    }
}
exports.Room = Room;
//# sourceMappingURL=room.js.map