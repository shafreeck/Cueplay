import { EventEmitter } from 'events';
import { PlayableSource } from '../provider/types';
export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';
export declare class StreamController extends EventEmitter {
    private _state;
    private _source;
    private _currentTime;
    private _duration;
    constructor();
    get state(): PlaybackState;
    get source(): PlayableSource | null;
    get currentTime(): number;
    get duration(): number;
    load(source: PlayableSource): Promise<void>;
    play(): void;
    pause(): void;
    seek(time: number): void;
    updateTime(time: number): void;
}
//# sourceMappingURL=controller.d.ts.map