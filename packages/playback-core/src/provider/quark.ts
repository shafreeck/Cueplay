import { PlayableProvider, PlayableSource } from './types';

interface QuarkContext {
    cookie: string;
    userAgent?: string;
    shareId?: string; // If playing from a share
}

export interface DriveFile {
    id: string;
    name: string;
    type: 'folder' | 'file';
    mimeType?: string;
    size?: number;
    updatedAt?: number;
    thumbnail?: string;
}

export class QuarkProvider implements PlayableProvider {
    private static API_URL = 'https://drive-pc.quark.cn/1/clouddrive/file/v2/play?pr=ucpro&fr=pc';
    private static LIST_URL = 'https://drive-pc.quark.cn/1/clouddrive/file/sort';

    async resolvePlayableSource(fileId: string, context: QuarkContext): Promise<PlayableSource> {
        if (!context.cookie) {
            throw new Error('QuarkProvider requires a cookie in context');
        }

        const headers = {
            'Cookie': context.cookie,
            'User-Agent': context.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Content-Type': 'application/json'
        };

        // Assuming POST based on typical file/v2/play endpoints, but could be GET.
        // Usually play endpoints take file_id in body or query. Given the URL has params, it might be a POST with body.
        // Let's assume POST with body for now as it's common for these drives.
        const body = JSON.stringify({
            fid: fileId,
            share_id: context.shareId, // Optional
        });

        const response = await fetch(QuarkProvider.API_URL, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok) {
            throw new Error(`Quark API failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;

        if (data.code !== 0 && data.code !== 200) { // Assuming 0 or 200 is success
            throw new Error(`Quark API error: ${JSON.stringify(data)}`);
        }

        // Attempt to extract HLS URL. The structure varies, usually in data.data.play_url or similar.
        // I will look for common fields or update based on user feedback/error.
        // Commonly: data.data.video_info.play_url or data.data.m3u8_url
        // Let's look for a likely candidate.

        let playUrl = data.data?.url;

        // Handle video_list response (new format)
        if (!playUrl && data.data?.video_list && Array.isArray(data.data.video_list)) {
            const list = data.data.video_list;

            // Strategy: Find first with channels=2. If not found, fallback to first.
            const stereoStream = list.find((v: any) => v.video_info?.audio?.channels === 2 && v.video_info?.url);

            if (stereoStream) {
                playUrl = stereoStream.video_info.url;
            } else {
                // Fallback to the first available URL
                const target = list.find((v: any) => v.video_info?.url);
                if (target) {
                    playUrl = target.video_info.url;
                }
            }
        }

        if (!playUrl) {
            throw new Error(`Could not find play URL in Quark response: ${JSON.stringify(data)}`);
        }

        return {
            id: fileId,
            url: playUrl,
            type: 'mp4', // The URL provided in the log is mp4, but sometimes m3u8. Check format extension if needed.
            headers: {
                'User-Agent': headers['User-Agent'], // Important for playing the stream
                'Referer': 'https://pan.quark.cn/'
            },
            meta: data.data // Keep full data for debug/refresh
        };
    }

    async refreshPlayableSource(source: PlayableSource, context: QuarkContext): Promise<PlayableSource> {
        // Re-resolve using the same ID
        return this.resolvePlayableSource(source.id, context);
    }

    async listDirectory(parentId: string = '0', context: QuarkContext): Promise<DriveFile[]> {
        const cookie = context.cookie;
        if (!cookie) {
            throw new Error('No cookie provided for QuarkProvider');
        }

        const headers = {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://pan.quark.cn/',
            'Origin': 'https://pan.quark.cn'
        };

        const query = new URLSearchParams({
            pr: 'ucpro',
            fr: 'pc',
            uc_param_str: '',
            pdir_fid: parentId,
            _page: '1',
            _size: '50',
            _fetch_total: '1',
            _fetch_sub_dirs: '0',
            _sort: 'file_type:asc,file_name:asc',
            fetch_all_file: '1',
            fetch_risk_file_name: '1'
        });

        const response = await fetch(`${QuarkProvider.LIST_URL}?${query.toString()}`, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            throw new Error(`Quark List API failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;

        if (data.code !== 0 && data.code !== 200) {
            throw new Error(`Quark List API error: ${JSON.stringify(data)}`);
        }

        const list = data.data?.list || [];

        return list.map((item: any) => ({
            id: item.fid,
            name: item.file_name,
            type: item.dir === true ? 'folder' : 'file',
            mimeType: item.mime_type,
            size: item.size,
            updatedAt: item.updated_at,
            thumbnail: item.thumbnail
        }));
    }
}
