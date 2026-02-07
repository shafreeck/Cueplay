import { PlayableProvider, PlayableSource } from './types';

interface QuarkContext {
    cookie: string;
    userAgent?: string;
    shareId?: string; // If playing from a share
    isAudio?: boolean; // Hint to use download API directly
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
    private static DOWNLOAD_URL = 'https://drive-pc.quark.cn/1/clouddrive/file/download?pr=ucpro&fr=pc&uc_param_str=';
    private static LIST_URL = 'https://drive-pc.quark.cn/1/clouddrive/file/sort';
    private static QR_TOKEN_URL = 'https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin';
    private static QR_STATUS_URL = 'https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken';
    private static SHARE_TOKEN_URL = 'https://drive-pc.quark.cn/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc';
    private static SHARE_SAVE_URL = 'https://drive-pc.quark.cn/1/clouddrive/share/sharepage/save?pr=ucpro&fr=pc';
    private static CLIENT_ID = '532';

    async resolvePlayableSource(fileId: string, context: QuarkContext): Promise<PlayableSource> {

        if (!context.cookie) {
            throw new Error('QuarkProvider requires a cookie in context');
        }

        const headers = {
            'Cookie': context.cookie,
            'User-Agent': context.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Content-Type': 'application/json'
        };

        // 0. Pre-fetch Metadata to determine type and get UI info
        let meta: any = {};
        let isActuallyAudio = context.isAudio || fileId.match(/\.(mp3|flac|wav|m4a|ogg)$/i) !== null;

        if (!isActuallyAudio) {
            try {
                const infoUrl = `https://drive-pc.quark.cn/1/clouddrive/file/get?fid=${fileId}&pr=ucpro&fr=pc`;
                const infoRes = await fetch(infoUrl, { headers });
                if (infoRes.ok) {
                    const infoData = await infoRes.json() as any;
                    if (infoData.code === 0 || infoData.code === 200) {
                        meta = infoData.data || {};
                        const fileName = meta.file_name || '';
                        const mimeType = meta.mime_type || '';
                        if (fileName.match(/\.(mp3|flac|wav|m4a|ogg)$/i) || mimeType.startsWith('audio/')) {
                            console.log(`[Quark] Metadata confirmed AUDIO for ${fileId}: ${fileName} (${mimeType})`);
                            isActuallyAudio = true;
                        }
                    }
                }
            } catch (e) {
                console.warn('[Quark] Metadata probe failed.');
            }
        } else {
            // Still try to get metadata for UI if we don't have it, but it's optional
            try {
                const infoUrl = `https://drive-pc.quark.cn/1/clouddrive/file/get?fid=${fileId}&pr=ucpro&fr=pc`;
                const infoRes = await fetch(infoUrl, { headers });
                if (infoRes.ok) {
                    const infoData = await infoRes.json() as any;
                    if (infoData.code === 0 || infoData.code === 200) {
                        meta = infoData.data || {};
                    }
                }
            } catch (e) { /* ignore */ }
        }

        // 1. Audio Path
        if (isActuallyAudio) {
            console.log('[Quark] Audio path activated. Calling download API...');

            const downloadResponse = await fetch(QuarkProvider.DOWNLOAD_URL, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Origin': 'https://pan.quark.cn',
                    'Referer': 'https://pan.quark.cn/',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',
                    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                    'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Microsoft Edge";v="144"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"'
                },
                body: JSON.stringify({
                    fids: [fileId],
                    share_id: context.shareId,
                })
            });

            if (downloadResponse.ok) {
                const dlData = await downloadResponse.json() as any;

                // Capture Set-Cookie
                const newCookies = (downloadResponse.headers as any).getSetCookie
                    ? (downloadResponse.headers as any).getSetCookie().map((c: string) => c.split(';')[0]).join('; ')
                    : (downloadResponse.headers.get('set-cookie') ? this.parseCookieHeader(downloadResponse.headers.get('set-cookie')!) : '');

                const finalCookie = this.mergeCookies(context.cookie, newCookies);

                if ((dlData.code === 0 || dlData.code === 200) && dlData.data?.[0]?.download_url) {
                    const downloadUrl = dlData.data[0].download_url;
                    return {
                        id: fileId,
                        url: downloadUrl,
                        type: 'audio',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0',
                            'Referer': 'https://pan.quark.cn/',
                            'Cookie': finalCookie
                        },
                        meta: {
                            ...meta,
                            title: meta.file_name || '',
                            thumbnail: meta.thumbnail || '',
                        }
                    };
                } else if (dlData.code === 23018 || dlData.status === 400) {
                    console.warn('[Quark] PC Download limit. Attempting Mobile Play API...');
                    const mobileResponse = await fetch('https://drive-pc.quark.cn/1/clouddrive/file/v2/play?pr=ucpro&fr=android', {
                        method: 'POST',
                        headers: {
                            ...headers,
                            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Quark/6.5.0.436',
                        },
                        body: JSON.stringify({ fid: fileId })
                    });
                    if (mobileResponse.ok) {
                        const mbData = await mobileResponse.json() as any;

                        const newMbCookies = (mobileResponse.headers as any).getSetCookie
                            ? (mobileResponse.headers as any).getSetCookie().map((c: string) => c.split(';')[0]).join('; ')
                            : (mobileResponse.headers.get('set-cookie') ? this.parseCookieHeader(mobileResponse.headers.get('set-cookie')!) : '');
                        const finalMbCookie = this.mergeCookies(context.cookie, newMbCookies);

                        if ((mbData.code === 0 || mbData.code === 200) && mbData.data?.url) {
                            return {
                                id: fileId,
                                url: mbData.data.url,
                                type: 'audio',
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Quark/6.5.0.436',
                                    'Referer': 'https://pan.quark.cn/',
                                    'Cookie': finalMbCookie
                                },
                                meta: {
                                    ...meta,
                                    title: meta.file_name || '',
                                    thumbnail: meta.thumbnail || '',
                                }
                            };
                        }
                    }
                }
            }
            // If we are here, it means audio path failed. DO NOT fall back to video API if it's audio.
            throw new Error(`Failed to resolve audio source for ${fileId}`);
        }

        // 2. Standard Video Path
        console.log('[Quark] Standard video path activated.');
        const body = JSON.stringify({
            fid: fileId,
            share_id: context.shareId,
        });

        const response = await fetch(QuarkProvider.API_URL, {
            method: 'POST',
            headers,
            body
        });

        if (!response.ok && response.status !== 400) {
            throw new Error(`Quark API failed: ${response.status}`);
        }

        const data = await response.json() as any;

        // Fallback for unexpected video errors (e.g. 21005)
        if (data.code !== 0 && data.code !== 200) {
            console.warn(`[Quark] Video play failed (${data.code}), trying download fallback...`);
            const downloadResponse = await fetch(QuarkProvider.DOWNLOAD_URL, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Origin': 'https://pan.quark.cn',
                    'Referer': 'https://pan.quark.cn/',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                },
                body: JSON.stringify({ fids: [fileId], share_id: context.shareId })
            });

            if (downloadResponse.ok) {
                const dlData = await downloadResponse.json() as any;
                if ((dlData.code === 0 || dlData.code === 200) && dlData.data?.[0]?.download_url) {
                    return {
                        id: fileId,
                        url: dlData.data[0].download_url,
                        type: 'mp4', // Video fallback is mp4
                        headers: {
                            'User-Agent': headers['User-Agent'],
                            'Referer': 'https://pan.quark.cn/',
                            'Cookie': headers['Cookie']
                        },
                        meta: {
                            ...meta,
                            title: meta.file_name || '',
                            thumbnail: meta.thumbnail || '',
                        }
                    };
                }
            }
            throw new Error(`Quark API error: ${JSON.stringify(data)} (Download Fallback also failed or returned unexpected data)`);
        }

        const newCookies = (response.headers as any).getSetCookie
            ? (response.headers as any).getSetCookie().map((c: string) => c.split(';')[0]).join('; ')
            : (response.headers.get('set-cookie') ? this.parseCookieHeader(response.headers.get('set-cookie')!) : '');

        let playUrl = data.data?.url;
        let resolutions: any[] = [];

        if (data.data?.video_list && Array.isArray(data.data.video_list)) {
            resolutions = data.data.video_list
                .filter((v: any) => v.video_info?.url)
                .map((v: any) => ({
                    id: v.resolution || 'unknown',
                    name: v.resolution || 'Unknown',
                    url: v.video_info.url
                }));
            if (!playUrl && resolutions.length > 0) playUrl = resolutions[0].url;
        }

        let sourceType: 'mp4' | 'hls' | 'audio' = 'mp4';
        if (playUrl?.includes('.m3u8')) sourceType = 'hls';
        else if (data.data?.audio_info) sourceType = 'audio';

        if (!playUrl) throw new Error(`No play URL found: ${JSON.stringify(data)}`);

        return {
            id: fileId,
            url: playUrl,
            type: sourceType,
            headers: {
                'User-Agent': headers['User-Agent'],
                'Referer': 'https://pan.quark.cn/',
                'Cookie': this.mergeCookies(headers.Cookie, newCookies)
            },
            meta: data.data,
            resolutions
        };
    }

    async refreshPlayableSource(source: PlayableSource, context: QuarkContext): Promise<PlayableSource> {
        return this.resolvePlayableSource(source.id, context);
    }

    async listDirectory(parentId: string = '0', context: QuarkContext): Promise<DriveFile[]> {
        const cookie = context.cookie;
        if (!cookie) throw new Error('No cookie');
        const headers = {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://pan.quark.cn/',
            'Origin': 'https://pan.quark.cn'
        };
        let allFiles: DriveFile[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const query = new URLSearchParams({ pr: 'ucpro', fr: 'pc', pdir_fid: parentId, _page: page.toString(), _size: '100', _fetch_total: '1' });
            const response = await fetch(`${QuarkProvider.LIST_URL}?${query.toString()}`, { method: 'GET', headers });
            const data = await response.json() as any;
            if (data.code !== 0 && data.code !== 200) break;
            const list = data.data?.list || [];
            allFiles = [...allFiles, ...list.map((item: any) => ({ id: item.fid, name: item.file_name, type: item.dir === true ? 'folder' : 'file', mimeType: item.mime_type, size: item.size, updatedAt: item.updated_at, thumbnail: item.thumbnail }))];
            if (allFiles.length >= (data.data?.total || 0) || list.length === 0) hasMore = false;
            else page++;
        }
        return allFiles;
    }

    async saveShareLink(shareLink: string, options?: { passCode?: string; targetDirId?: string; cookie?: string }): Promise<{ success: boolean }> {
        const match = shareLink.match(/\/s\/([a-zA-Z0-9]+)/);
        if (!match) throw new Error('Invalid link');
        const pwdId = match[1];
        const headers = { 'Cookie': options?.cookie || '', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' };
        const tokenRes = await fetch(QuarkProvider.SHARE_TOKEN_URL, { method: 'POST', headers, body: JSON.stringify({ pwd_id: pwdId, passcode: options?.passCode || '' }) });
        const tokenData = await tokenRes.json() as any;
        const stoken = tokenData.data?.stoken;
        const saveRes = await fetch(QuarkProvider.SHARE_SAVE_URL, { method: 'POST', headers, body: JSON.stringify({ pwd_id: pwdId, stoken, pdir_fid: '0', to_pdir_fid: options?.targetDirId || '0', pdir_save_all: true, scene: 'link' }) });
        return { success: (await saveRes.json()).code === 0 };
    }

    async generateQRCode(): Promise<{ token: string; qrcodeUrl: string; cookies: string }> {
        const url = `${QuarkProvider.QR_TOKEN_URL}?client_id=532&v=1.2&request_id=123&t=${Date.now()}`;
        const res = await fetch(url, { headers: { 'Referer': 'https://pan.quark.cn/' } });
        const data = await res.json() as any;
        return { token: data.data.members.token, qrcodeUrl: '...', cookies: '' };
    }

    async checkQRCodeStatus(token: string, cookies?: string): Promise<any> {
        return { status: 'expired' };
    }

    async getAccountInfo(cookie: string): Promise<any> {
        return { nickname: 'Quark User' };
    }

    private generateUUID(): string { return '123'; }
    private parseCookieHeader(s: string): string { return s; }

    private mergeCookies(oldCookie: string, newCookie: string): string {
        if (!newCookie) return oldCookie;
        if (!oldCookie) return newCookie;

        const cookieMap = new Map<string, string>();

        // Parse old cookies first
        oldCookie.split(';').forEach(part => {
            const [key, ...val] = part.trim().split('=');
            if (key) cookieMap.set(key, val.join('='));
        });

        // Parse new cookies (overwriting old ones)
        newCookie.split(';').forEach(part => {
            const [key, ...val] = part.trim().split('=');
            if (key) cookieMap.set(key, val.join('='));
        });

        return Array.from(cookieMap.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
    }
}
