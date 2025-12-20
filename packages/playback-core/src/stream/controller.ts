import { EventEmitter } from 'events';
import { PlayableSource } from '../provider/types';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';

export class StreamController extends EventEmitter {
    private _state: PlaybackState = 'idle';
    private _source: PlayableSource | null = null;
    private _currentTime: number = 0;
    private _duration: number = 0;

    constructor() {
        super();
    }

    get state() { return this._state; }
    get source() { return this._source; }
    get currentTime() { return this._currentTime; }
    get duration() { return this._duration; }

    async load(source: PlayableSource) {
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
        if (!this._source) return;
        this._state = 'playing';
        this.emit('state', this._state);
    }

    pause() {
        if (!this._source) return;
        this._state = 'paused';
        this.emit('state', this._state);
    }

    seek(time: number) {
        if (!this._source) return;
        this._currentTime = time;
        this.emit('seek', time);
    }

    updateTime(time: number) {
        this._currentTime = time;
        this.emit('timeupdate', time);
    }
}
