import { PlayableProvider, PlayableSource } from './types';
interface QuarkContext {
    cookie: string;
    userAgent?: string;
    shareId?: string;
}
export declare class QuarkProvider implements PlayableProvider {
    private static API_URL;
    resolvePlayableSource(fileId: string, context: QuarkContext): Promise<PlayableSource>;
    refreshPlayableSource(source: PlayableSource, context: QuarkContext): Promise<PlayableSource>;
}
export {};
//# sourceMappingURL=quark.d.ts.map