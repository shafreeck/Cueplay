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
    private static DOWNLOAD_URL = 'https://drive-pc.quark.cn/1/clouddrive/file/download?pr=ucpro&fr=pc';
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

        // Optimized path for Audio files: Skip the video play API (which fails with 400) and go straight to download
        if (context.isAudio) {
            console.log('[Quark] Audio file detected, using download API directly.');
            const downloadResponse = await fetch(QuarkProvider.DOWNLOAD_URL, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Origin': 'https://pan.quark.cn',
                    'Referer': 'https://pan.quark.cn/',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    fids: [fileId],
                    share_id: context.shareId,
                })
            });

            if (downloadResponse.ok) {
                const dlData = await downloadResponse.json() as any;
                if ((dlData.code === 0 || dlData.code === 200) && dlData.data?.download_url) {
                    return {
                        id: fileId,
                        url: dlData.data.download_url,
                        type: 'audio',
                        headers: {
                            'User-Agent': headers['User-Agent'],
                            'Referer': 'https://pan.quark.cn/',
                            'Cookie': headers['Cookie']
                        },
                        meta: dlData.data
                    };
                }
            }
            // If direct download fails, we fall through to try standard video API (unlikely to help, but safe)
            console.warn('[Quark] Direct audio download failed, falling back to standard flow.');
        }

        // Assuming POST based on typical file/v2/play endpoints, but could be GET.
        const body = JSON.stringify({
            fid: fileId,
            share_id: context.shareId, // Optional
        });

        const response = await fetch(QuarkProvider.API_URL, {
            method: 'POST',
            headers,
            body
        });

        // If not OK and not 400 (which we handle as fallback), throw error
        if (!response.ok && response.status !== 400) {
            const headerObj: Record<string, string> = {};
            response.headers.forEach((v, k) => { headerObj[k] = v; });
            console.error('[Quark] API Request Failed:', {
                status: response.status,
                statusText: response.statusText,
                headers: headerObj
            });
            throw new Error(`Quark API failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;

        // If standard play endpoint fails (code != 0/200), try fallback to download endpoint
        // This often happens for audio files which don't support the video play endpoint
        if (data.code !== 0 && data.code !== 200) {
            console.warn(`[Quark] Play endpoint failed (code ${data.code}), trying download endpoint fallback...`);
            
            const downloadResponse = await fetch(QuarkProvider.DOWNLOAD_URL, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Origin': 'https://pan.quark.cn',
                    'Referer': 'https://pan.quark.cn/',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    fids: [fileId], // Use fids array
                    share_id: context.shareId,
                })
            });

            if (downloadResponse.ok) {
                const dlData = await downloadResponse.json() as any;
                if ((dlData.code === 0 || dlData.code === 200) && dlData.data?.download_url) {
                    // Use download URL as direct playback URL
                    return {
                        id: fileId,
                        url: dlData.data.download_url,
                        type: 'audio', // Assume audio/file for download links
                        headers: {
                            'User-Agent': headers['User-Agent'],
                            'Referer': 'https://pan.quark.cn/',
                            'Cookie': headers['Cookie']
                        },
                        meta: dlData.data
                    };
                }
            }

            // If fallback also fails, log and throw original error
            console.error('[Quark] API Error Response:', JSON.stringify(data, null, 2));
            throw new Error(`Quark API error: ${JSON.stringify(data)}`);
        }

        // Capture new cookies (e.g. Video-Auth) from the response to use for playback
        const newCookies = (response.headers as any).getSetCookie
            ? (response.headers as any).getSetCookie().map((c: string) => c.split(';')[0]).join('; ')
            : (response.headers.get('set-cookie') ? this.parseCookieHeader(response.headers.get('set-cookie')!) : '');

        let playUrl = data.data?.url;
        let resolutions: Array<{ id: string; name: string; url: string; width?: number; height?: number }> = [];

        // Handle video_list response (new format)
        if (data.data?.video_list && Array.isArray(data.data.video_list)) {
            const list = data.data.video_list;

            // Map resolutions
            resolutions = list
                .filter((v: any) => v.video_info?.url)
                .map((v: any) => ({
                    id: v.resolution || v.video_info?.resolution || 'unknown',
                    name: v.resolution || v.video_info?.resolution || 'Unknown',
                    url: v.video_info.url,
                    width: v.video_info.width,
                    height: v.video_info.height,
                    format_type: v.video_info?.format_type
                }));

            // Strategy: Find first with channels=2. If not found, fallback to first.
            if (!playUrl) {
                const stereoStream = list.find((v: any) => v.video_info?.audio?.channels === 2 && v.video_info?.url);

                if (stereoStream) {
                    playUrl = stereoStream.video_info.url;
                } else if (resolutions.length > 0) {
                    // Fallback to the first available URL (usually the highest quality or first in list)
                    playUrl = resolutions[0].url;
                }
            }
        }

        // Detect type (audio or mp4/hls)
        // If there's no resolution info but we have a playUrl, it might be an audio file
        let sourceType: 'mp4' | 'hls' | 'dash' | 'audio' = 'mp4';
        if (playUrl && playUrl.includes('.m3u8')) {
            sourceType = 'hls';
        } else if (data.data?.audio_info || (!data.data?.video_list && data.data?.url)) {
            // Simplified heuristic for audio
            sourceType = 'audio';
        }

        if (!playUrl) {
            throw new Error(`Could not find play URL in Quark response: ${JSON.stringify(data)}`);
        }

        return {
            id: fileId,
            url: playUrl,
            type: sourceType,
            headers: {
                'User-Agent': headers['User-Agent'], // Important for playing the stream
                'Referer': 'https://pan.quark.cn/',
                'Cookie': newCookies ? `${headers.Cookie}; ${newCookies}` : headers.Cookie
            },
            meta: data.data, // Keep full data for debug/refresh
            resolutions
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

        let allFiles: DriveFile[] = [];
        let page = 1;
        const size = 100;
        let hasMore = true;

        while (hasMore) {
            const query = new URLSearchParams({
                pr: 'ucpro',
                fr: 'pc',
                uc_param_str: '',
                pdir_fid: parentId,
                _page: page.toString(),
                _size: size.toString(),
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
            const total = data.data?.total || 0;

            const mappedFiles: DriveFile[] = list.map((item: any) => ({
                id: item.fid,
                name: item.file_name,
                type: item.dir === true ? 'folder' : 'file',
                mimeType: item.mime_type,
                size: item.size,
                updatedAt: item.updated_at,
                thumbnail: item.thumbnail
            }));

            allFiles = [...allFiles, ...mappedFiles];

            if ((total > 0 && allFiles.length >= total) || list.length === 0) {
                hasMore = false;
            } else {
                page++;
            }
        }

        return allFiles;
    }

    async saveShareLink(shareLink: string, options?: { passCode?: string; targetDirId?: string; cookie?: string }): Promise<{ success: boolean }> {
        const cookie = options?.cookie;
        if (!cookie) {
            throw new Error('No cookie provided for saveShareLink');
        }

        // 1. Parse pwd_id from shareLink
        // Format: https://pan.quark.cn/s/396d16ce617b
        const match = shareLink.match(/\/s\/([a-zA-Z0-9]+)/);
        if (!match) {
            throw new Error('Invalid Quark share link format. Expected https://pan.quark.cn/s/...');
        }
        const pwdId = match[1];

        const headers = {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://pan.quark.cn/',
            'Origin': 'https://pan.quark.cn',
            'Content-Type': 'application/json'
        };

        // 2. Get Share Token (stoken)
        const tokenBody = {
            pwd_id: pwdId,
            passcode: options?.passCode || ''
        };

        const tokenRes = await fetch(QuarkProvider.SHARE_TOKEN_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(tokenBody)
        });

        if (!tokenRes.ok) {
            throw new Error(`Failed to get share token: ${tokenRes.status}`);
        }

        const tokenData = await tokenRes.json() as any;
        if (tokenData.code !== 0 && tokenData.code !== 200) {
            throw new Error(`Quark Share Token Error: ${tokenData.message || JSON.stringify(tokenData)}`);
        }

        const stoken = tokenData.data?.stoken;
        
        // 3. Save Files
        const saveBody = {
            pwd_id: pwdId,
            stoken: stoken,
            pdir_fid: '0', // Source parent ID (usually 0 for root of share)
            to_pdir_fid: options?.targetDirId || '0', // Target in My Drive
            pdir_save_all: true,
            scene: 'link'
        };

        const saveRes = await fetch(QuarkProvider.SHARE_SAVE_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(saveBody)
        });

        if (!saveRes.ok) {
            throw new Error(`Failed to save share: ${saveRes.status}`);
        }

        const saveData = await saveRes.json() as any;
        if (saveData.code !== 0 && saveData.code !== 200) {
            throw new Error(`Quark Save Error: ${saveData.message || JSON.stringify(saveData)}`);
        }

        return { success: true };
    }

    /**
     * Generate QR code for login
     */
    async generateQRCode(): Promise<{ token: string; qrcodeUrl: string; cookies: string }> {
        const requestId = this.generateUUID();
        const timestamp = Date.now();
        const url = `${QuarkProvider.QR_TOKEN_URL}?client_id=${QuarkProvider.CLIENT_ID}&v=1.2&request_id=${requestId}&t=${timestamp}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': 'https://pan.quark.cn/',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to generate QR code: ${response.status}`);
        }

        const data = await response.json() as any;

        if (data.status !== 2000000) {
            throw new Error(`QR code generation failed: ${data.message} (${data.status})`);
        }

        const token = data.data?.members?.token;
        if (!token) {
            throw new Error('No token in response');
        }

        const cookies = (response.headers as any).getSetCookie
            ? (response.headers as any).getSetCookie().map((c: string) => c.split(';')[0]).join('; ')
            : (response.headers.get('set-cookie') ? this.parseCookieHeader(response.headers.get('set-cookie')!) : '');

        const qrcodeUrl = `https://su.quark.cn/4_eMHBJ?token=${token}&client_id=532&ssb=weblogin&uc_param_str=&uc_biz_str=S:custom%7COPT:SAREA@0%7COPT:IMMERSIVE@1%7COPT:BACK_BTN_STYLE@0`;

        return { token, qrcodeUrl, cookies };
    }

    /**
     * Check QR code login status
     */
    async checkQRCodeStatus(token: string, cookies?: string): Promise<{ status: 'pending' | 'success' | 'expired' | 'scanned'; cookie?: string; statusCode?: number }> {
        const requestId = this.generateUUID();
        const timestamp = Date.now();
        const url = `${QuarkProvider.QR_STATUS_URL}?client_id=${QuarkProvider.CLIENT_ID}&v=1.2&token=${token}&request_id=${requestId}&t=${timestamp}`;

        const headers: HeadersInit = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://pan.quark.cn/',
            'Origin': 'https://pan.quark.cn',
            'Accept': 'application/json, text/plain, */*',
            'Sec-Fetch-Site': 'same-site',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
        };

        if (cookies) {
            headers['Cookie'] = cookies;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
        });

        if (!response.ok) {
            throw new Error(`Failed to check QR code status: ${response.status}`);
        }

        const data = await response.json() as any;

        if (data.status === 50004001) {
            return { status: 'pending', statusCode: data.status };
        }

        if (data.status === 50004002) {
            return { status: 'scanned', statusCode: data.status };
        }

        if (data.status === 2000000 && data.data?.members?.service_ticket) {
            const setCookieHeader = (response.headers as any).getSetCookie
                ? (response.headers as any).getSetCookie().map((c: string) => c.split(';')[0]).join('; ')
                : (response.headers.get('set-cookie') ? this.parseCookieHeader(response.headers.get('set-cookie')!) : '');

            let currentCookies = cookies ? `${cookies}; ${setCookieHeader}` : setCookieHeader;
            const ticket = data.data.members.service_ticket;

            try {
                const commonHeaders = {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
                    'Referer': 'https://pan.quark.cn/',
                };

                const extractCookies = (res: Response) => {
                    const raw = (res.headers as any).getSetCookie
                        ? (res.headers as any).getSetCookie()
                        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
                    return raw.map((c: string) => c.split(';')[0]).join('; ');
                };

                const accountInfoUrl = `https://pan.quark.cn/account/info?st=${ticket}&lw=scan`;
                const accountRes = await fetch(accountInfoUrl, {
                    method: 'GET',
                    headers: {
                        ...commonHeaders,
                        'accept': 'application/json, text/plain, */*',
                        'sec-ch-ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not_A Brand";v="24"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"macOS"',
                        'sec-ch-ua-full-version-list': '"Microsoft Edge";v="143.0.3650.80", "Chromium";v="143.0.7499.110", "Not_A Brand";v="24.0.0.0"',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'Cookie': currentCookies
                    }
                });

                const step1Cookies = extractCookies(accountRes);
                if (step1Cookies) {
                    currentCookies = currentCookies ? `${currentCookies}; ${step1Cookies}` : step1Cookies;
                }

                const configUrl = 'https://drive-pc.quark.cn/1/clouddrive/config?pr=ucpro&fr=pc&uc_param_str=';
                const configRes = await fetch(configUrl, {
                    method: 'GET',
                    headers: {
                        ...commonHeaders,
                        'Origin': 'https://pan.quark.cn',
                        'accept': 'application/json, text/plain, */*',
                        'sec-ch-ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not_A Brand";v="24"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"macOS"',
                        'sec-fetch-site': 'same-site',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'Cookie': currentCookies
                    }
                });

                const step2Cookies = extractCookies(configRes);
                if (step2Cookies) {
                    currentCookies = currentCookies ? `${currentCookies}; ${step2Cookies}` : step2Cookies;
                }

            } catch (error: any) {
                console.error('[Quark] Failed to exchange service ticket for cookies:', error);
            }

            return {
                status: 'success',
                cookie: currentCookies || `service_ticket=${ticket}`,
                statusCode: data.status
            };
        }

        console.warn(`[Quark] Check Status Error: ${data.status} ${data.message}`);
        return { status: 'expired', statusCode: data.status };
    }

    async getAccountInfo(cookie: string): Promise<{ nickname?: string; avatar?: string; id?: string }> {
        const url = 'https://pan.quark.cn/account/info?fr=pc&platform=pc';
        const headers = {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
            'Referer': 'https://pan.quark.cn/',
            'Origin': 'https://pan.quark.cn',
            'Accept': 'application/json, text/plain, */*',
            'sec-ch-ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin'
        };

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                console.warn(`[Quark] getAccountInfo HTTP ${response.status}`);
                throw new Error(`Failed to get account info: ${response.status}`);
            }

            const data = await response.json() as any;
            if (data.code !== 0 && data.code !== 200 && data.code !== 'OK') {
                console.warn('[Quark] Failed to get account info API error:', data);
                return {};
            }

            const user = data.data;
            return {
                nickname: user.nickname,
                avatar: user.avatar || user.avatarUri,
                id: user.id
            };
        } catch (e) {
            console.error('[Quark] getAccountInfo exception:', e);
            return {};
        }
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    private parseCookieHeader(setCookieHeader: string): string {
        const cookies: string[] = [];
        const items = setCookieHeader.split(/,(?=\s*[a-zA-Z0-9_-]+=)/);

        for (const item of items) {
            const cookiePart = item.trim().split(';')[0];
            if (cookiePart) {
                cookies.push(cookiePart);
            }
        }

        return cookies.join('; ');
    }
}
