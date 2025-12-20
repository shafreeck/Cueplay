"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamController = void 0;
const events_1 = require("events");
class StreamController extends events_1.EventEmitter {
    _state = 'idle';
    _source = null;
    _currentTime = 0;
    _duration = 0;
    constructor() {
        super();
    }
    get state() { return this._state; }
    get source() { return this._source; }
    get currentTime() { return this._currentTime; }
    get duration() { return this._duration; }
    async load(source) {
        this._state = 'loading';
        this.emit('state', this._state);
        this._source = source;
        // In a real browser environment, this would attach to a <video> element or HLS.js
        // For core logic (shared), we just manage the abstract state or interacting with a "Driver"
        // Simulating load
        this._state = 'paused'; // Ready to play
        this.emit('state', this._state);
        this.emit('loaded', source);
    }
    play() {
        if (!this._source)
            return;
        this._state = 'playing';
        this.emit('state', this._state);
    }
    pause() {
        if (!this._source)
            return;
        this._state = 'paused';
        this.emit('state', this._state);
    }
    seek(time) {
        if (!this._source)
            return;
        this._currentTime = time;
        this.emit('seek', time);
    }
    updateTime(time) {
        this._currentTime = time;
        this.emit('timeupdate', time);
    }
}
exports.StreamController = StreamController;
//# sourceMappingURL=controller.js.map