import { PlayableProvider, PlayableSource } from './types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

interface QuarkContext {
    cookie: string;
    userAgent?: string;
    shareId?: string;
}



function logLogin(msg: string) {
    try {
        fs.appendFileSync('/tmp/quark_login.txt', msg + '\n');
    } catch (e) { }
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
    private static getBaseUrl(fr: string = 'pc') {
        if (fr === 'mac') return 'https://drive.quark.cn';
        return 'https://drive-pc.quark.cn';
    }

    private static getPlayUrl(fr: string = 'pc') {
        return `${QuarkProvider.getBaseUrl(fr)}/1/clouddrive/file/v2/play`;
    }

    private static getDownloadUrl(fr: string = 'pc') {
        return `${QuarkProvider.getBaseUrl(fr)}/1/clouddrive/file/download`;
    }

    private static getListUrl(fr: string = 'pc') {
        return `${QuarkProvider.getBaseUrl(fr)}/1/clouddrive/file/sort`;
    }
    private static QR_TOKEN_URL = 'https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin';
    private static QR_STATUS_URL = 'https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken';
    private static SHARE_TOKEN_URL = `${QuarkProvider.getBaseUrl('pc')}/1/clouddrive/share/sharepage/token`;
    private static SHARE_SAVE_URL = `${QuarkProvider.getBaseUrl('pc')}/1/clouddrive/share/sharepage/save`;
    private static ACCOUNT_INFO_URL = `${QuarkProvider.getBaseUrl('pc')}/1/clouddrive/user/info`;
    private static CLIENT_ID = '532';

    private getQuarkQueryParams(fr: string = 'pc') {
        const query: any = {
            pr: 'ucpro',
            fr: fr,
            uc_param_str: 'dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt',
            vcode: Date.now().toString()
        };

        if (fr === 'mac') {
            query.bi = '999';
            // Use the exact channel from user's working curl
            query.ch = 'pcquark@clouddrive_share2';
            query.device_model = 'Mac mini';
            query.la = 'zh-CN';
            query.nt = '99';
            query.nw = '0';
            query.pf = '6001';
            query.sys = 'darwin';
            query.ve = '6.4.0.728';
            query.where_entry = 'task_init';
        }

        return query;
    }

    private getQuarkHeaders(cookie: string, fr: string = 'pc'): Record<string, string> {
        const headers: any = {
            'Cookie': cookie,
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        };
        // Use v0.2.1 compatible Macintosh User-Agent
        headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        headers['Origin'] = 'https://pan.quark.cn';
        headers['Referer'] = 'https://pan.quark.cn/';

        return headers;
    }

    async resolvePlayableSource(fileId: string, context: QuarkContext): Promise<PlayableSource> {
        console.log(`[Quark] Hybrid: Resolving ${fileId}. Cookie Length: ${context.cookie?.length || 0}.`);
        if (!context.cookie) {
            throw new Error('QuarkProvider requires a cookie in context');
        }

        // Warming session if __uus is missing
        if (!context.cookie.includes('__uus')) {
            console.log('[Quark] Local cookie missing __uus. Attempting session warming...');
            try {
                context.cookie = await this.ensureSession(context.cookie);
                console.log('[Quark] Session warmed. New cookie length:', context.cookie.length);
            } catch (e) {
                console.warn('[Quark] Session warming failed:', e);
            }
        }

        // Fetch basic metadata first to get file name etc
        let meta: any = {};
        try {
            const query = new URLSearchParams(this.getQuarkQueryParams('pc'));
            const infoUrl = `${QuarkProvider.getBaseUrl('pc')}/1/clouddrive/file/get?fid=${fileId}&${query.toString()}`;
            const infoRes = await fetch(infoUrl, {
                method: 'GET',
                headers: this.getQuarkHeaders(context.cookie, 'pc') as any
            });
            if (infoRes.ok) {
                const infoData = await infoRes.json() as any;
                if (infoData.code === 0 || infoData.code === 200) {
                    meta = infoData.data || {};
                }
            }
        } catch (e) {
            console.warn('[Quark] Metadata pre-fetch failed, continuing with limited info.');
        }

        return this.resolve(fileId, context, meta);
    }

    async resolve(fileId: string, context: QuarkContext, meta: any): Promise<PlayableSource> {
        console.log(`[Quark] V9 Hybrid: Resolving ${fileId}. (Video Only)`);

        // First attempt: PC API (Browser headers) - most stable for general use
        try {
            return await this.resolveVideoPC(fileId, context, meta);
        } catch (pcErr: any) {
            console.error(`[Quark] PC Resolution failed: ${pcErr.message}`);
            // Let the frontend surface the correct error (e.g. 31001 for required login) 
            // instead of silently failing and attempting a broken method
            throw pcErr;
        }
    }

    private async resolveVideoPC(fileId: string, context: QuarkContext, meta: any): Promise<PlayableSource> {
        console.log('[Quark V9] Video (PC)...');
        const query = new URLSearchParams(this.getQuarkQueryParams('pc'));
        const headers = this.getQuarkHeaders(context.cookie, 'pc');

        const response = await fetch(`${QuarkProvider.getPlayUrl('pc')}?${query.toString()}`, {
            method: 'POST',
            headers: headers as any,
            body: JSON.stringify({
                fid: fileId,
                share_id: context.shareId || '', // Essential: Empty string if not share
                video_type: 'original'
            })
        });

        const text = await response.text();
        if (!response.ok || text.includes('31001') || text.includes('Invalid CORS request')) {
            throw new Error(`Quark Video (PC) failed: ${text.substring(0, 100)}`);
        }

        const data = JSON.parse(text);
        if (data.code !== 0 && data.code !== 200) {
            throw new Error(`Quark Video (PC) error code ${data.code}: ${text.substring(0, 50)}`);
        }

        const videoInfo = data.data || {};

        // Comprehensive parsing for both PC and MAC response formats
        // PC (v0.2.1 compatible): data.data.video_list[i].video_info.url
        // MAC: data.data.video_stream_list[i].video_url
        let resolutions: any[] = [];

        if (videoInfo.video_list && Array.isArray(videoInfo.video_list)) {
            resolutions = videoInfo.video_list
                .filter((v: any) => v.video_info?.url)
                .map((v: any) => ({
                    id: v.resolution || 'unknown',
                    name: v.resolution || 'Unknown',
                    url: v.video_info.url
                }));
        } else if (videoInfo.video_stream_list && Array.isArray(videoInfo.video_stream_list)) {
            resolutions = videoInfo.video_stream_list.map((s: any) => ({
                id: s.video_type,
                name: s.video_type,
                url: s.video_url
            }));
        }

        const bestRes = resolutions.find((r: any) => r.id === 'original' || r.id === '1080P') || resolutions[0];
        if (!bestRes || !bestRes.url) throw new Error('Quark Video (PC) returned no valid resolutions');

        const newCookie = this.mergeCookies(context.cookie, response.headers);

        return {
            id: fileId,
            url: bestRes.url,
            type: 'mp4',
            headers: {
                ...headers,
                'Cookie': newCookie,
            },
            resolutions,
            meta: {
                ...meta,
                ...videoInfo,
                title: videoInfo.file_name || meta.title || '',
                duration: videoInfo.duration ? Math.floor(videoInfo.duration / 1000) : 0,
            }
        };
    }



    async refreshPlayableSource(source: PlayableSource, context: QuarkContext): Promise<PlayableSource> {
        return this.resolvePlayableSource(source.id, context);
    }

    async listDirectory(parentId: string = '0', context: QuarkContext): Promise<DriveFile[]> {
        const cookie = context.cookie;
        if (!cookie) throw new Error('No cookie');
        const headers = this.getQuarkHeaders(cookie);
        let allFiles: DriveFile[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const query = new URLSearchParams({
                ...this.getQuarkQueryParams('pc'),
                pdir_fid: parentId,
                _page: page.toString(),
                _size: '100',
                _fetch_total: '1'
            });
            const response = await fetch(`${QuarkProvider.getListUrl('pc')}?${query.toString()}`, { method: 'GET', headers });
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
        const clientId = '532';
        const v = '1.2';
        const requestId = this.generateUUID();
        const t = Date.now();
        const url = `https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin?client_id=${clientId}&v=${v}&request_id=${requestId}&t=${t}`;

        console.log('[Quark] Generating QR Token...');
        const res = await fetch(url, {
            headers: {
                'Referer': 'https://pan.quark.cn/'
            }
        });
        const data = await res.json() as any;

        if (data.status !== 2000000) {
            throw new Error(`Failed to get QR token: ${data.message}`);
        }

        const token = data.data.members.token;
        // The official QR code content discovered via browser research
        const qrcodeUrl = `https://su.quark.cn/4_eMHBJ?token=${token}&client_id=${clientId}&ssb=weblogin&uc_param_str=&uc_biz_str=S:custom|OPT:SAREA@0|OPT:IMMERSIVE@1|OPT:BACK_BTN_STYLE@0`;
        const cookies = this.parseCookieHeader(res.headers.get('set-cookie') || '');

        return { token, qrcodeUrl, cookies };
    }

    async checkQRCodeStatus(token: string, cookies?: string): Promise<any> {
        const clientId = '532';
        const v = '1.2';
        const requestId = this.generateUUID();
        const t = Date.now();
        const url = `https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken?client_id=${clientId}&v=${v}&token=${token}&request_id=${requestId}&t=${t}`;

        const res = await fetch(url, {
            headers: {
                'Referer': 'https://pan.quark.cn/',
                'Cookie': cookies || ''
            }
        });
        const data = await res.json() as any;
        logLogin(`[CheckStatus] Response Data: ${JSON.stringify(data)}`);

        const extractCookies = (fetchRes: Response) => {
            let cookies: string[] = [];
            if (typeof (fetchRes.headers as any).getSetCookie === 'function') {
                cookies = (fetchRes.headers as any).getSetCookie();
            } else {
                const val = fetchRes.headers.get('set-cookie');
                if (val) cookies = [val];
            }
            return cookies.map(c => c.split(';')[0]).join('; ');
        };

        // Capture initial CAS cookies
        let currentCookies = cookies || '';
        const initialCookies = extractCookies(res);
        if (initialCookies) {
            currentCookies = this.mergeCookies(currentCookies, initialCookies);
        }

        if (data.status === 2000000) {
            const ticket = data.data?.members?.service_ticket || data.data?.ticket;
            if (!ticket) {
                return { status: 'expired', statusCode: data.status };
            }

            try {
                const commonHeaders = {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
                    'Referer': 'https://pan.quark.cn/',
                    'Origin': 'https://pan.quark.cn',
                    'Accept': 'application/json, text/plain, */*'
                };

                // Step 1: Account Info
                const accountUrl = `https://pan.quark.cn/account/info?st=${ticket}&lw=scan`;
                const accountRes = await fetch(accountUrl, {
                    method: 'GET',
                    headers: {
                        ...commonHeaders,
                        'Cookie': currentCookies
                    }
                });

                const step1Cookies = extractCookies(accountRes);
                if (step1Cookies) currentCookies = this.mergeCookies(currentCookies, step1Cookies);

                // Step 2: Config
                const configUrl = 'https://drive-pc.quark.cn/1/clouddrive/config?pr=ucpro&fr=pc&uc_param_str=';
                const configRes = await fetch(configUrl, {
                    method: 'GET',
                    headers: {
                        ...commonHeaders,
                        'Cookie': currentCookies
                    }
                });

                const step2Cookies = extractCookies(configRes);
                if (step2Cookies) currentCookies = this.mergeCookies(currentCookies, step2Cookies);

                logLogin(`[CheckStatus] Login Complete. Final Cookies: ${currentCookies}`);
            } catch (error: any) {
                console.error('[Quark] Failed to exchange ticket:', error);
            }

            return {
                status: 'success',
                cookie: currentCookies,
                statusCode: data.status
            };
        } else if (data.status === 50004001 || data.status === 50004002 || data.status === 0 || data.status === 200) {
            return { status: 'pending', statusCode: data.status };
        }

        return { status: 'expired', statusCode: data.status };
    }

    async getAccountInfo(cookie: string): Promise<{ nickname?: string; avatar?: string; id?: string }> {
        const url = 'https://pan.quark.cn/account/info?fr=pc&platform=pc';
        const headers = {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
            'Referer': 'https://pan.quark.cn/',
            'Origin': 'https://pan.quark.cn',
            'Accept': 'application/json, text/plain, */*'
        };

        try {
            const response = await fetch(url, { method: 'GET', headers });
            const data = await response.json() as any;
            if (data.code !== 0 && data.code !== 200) return {};
            const user = data.data || {};
            return {
                nickname: user.nickname,
                avatar: user.avatar || user.avatarUri,
                id: user.id
            };
        } catch (e) {
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
            if (cookiePart) cookies.push(cookiePart);
        }
        return cookies.join('; ');
    }

    private mergeCookies(oldCookie: string | undefined, newCookie: string | undefined | Headers): string {
        const cookieMap = new Map<string, string>();
        if (oldCookie) {
            oldCookie.split(';').forEach(part => {
                const [key, val] = part.trim().split('=');
                if (key && val) cookieMap.set(key, val);
            });
        }

        if (newCookie) {
            if (typeof newCookie === 'string') {
                newCookie.split(';').forEach(part => {
                    const [key, val] = part.trim().split('=');
                    if (key && val) cookieMap.set(key, val);
                });
            } else if (typeof (newCookie as any).getSetCookie === 'function') {
                (newCookie as any).getSetCookie().forEach((c: string) => {
                    const firstPart = c.split(';')[0];
                    const [key, val] = firstPart.trim().split('=');
                    if (key && val) cookieMap.set(key, val);
                });
            }
        }
        return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    }

    private async ensureSession(cookie: string): Promise<string> {
        let currentCookies = cookie;
        try {
            const headers = this.getQuarkHeaders(currentCookies);
            const accountRes = await fetch('https://pan.quark.cn/account/info?fr=pc&platform=pc', { method: 'GET', headers });
            const s1 = accountRes.headers.get('set-cookie');
            if (s1) currentCookies = this.mergeCookies(currentCookies, s1);

            const configRes = await fetch('https://drive-pc.quark.cn/1/clouddrive/config?pr=ucpro&fr=pc&uc_param_str=', { method: 'GET', headers: this.getQuarkHeaders(currentCookies) });
            const s2 = configRes.headers.get('set-cookie');
            if (s2) currentCookies = this.mergeCookies(currentCookies, s2);
        } catch (e) { }
        return currentCookies;
    }

    private cleanCookies(cookie: string): string {
        const ALLOWED_PREFIXES = ['__kuus', '__uus', '__puus', 'video_auth', 'v_auth', 'token'];
        return cookie.split(';').filter(c => {
            const key = c.trim().split('=')[0].toLowerCase();
            return ALLOWED_PREFIXES.some(prefix => key.includes(prefix));
        }).join('; ');
    }
}

