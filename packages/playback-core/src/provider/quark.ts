import { PlayableProvider, PlayableSource } from './types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

interface QuarkContext {
    cookie: string;
    userAgent?: string;
    shareId?: string;
    isAudio?: boolean;
}

const UA_MAC_PHASE1 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.4.0.728 quark-cloud-drive/2.5.40';
const UA_MAC_PHASE2 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.4.0.728 quark-cloud-drive/2.5.40';
const SIG_KPS = 'NxR/DbHcJ1xA4KX07QAmK+aPRaqUNIn1fXutykpEFv7LzORm2cTmjJRD6el+aI+lSRqhn4LIo4Jys2xc85braEuzl0YI3oel+GWBWHjG9ZMgTA==';
const SIG_SIGN = 'NxTZqd9r8ynwC+l20lEk+azDnbHVhv7itBG8ZV2LfcdUTuYC1tFCWp+9LbUq8lwoz14=';
const SIG_VCODE = '1770624659600';

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

    private static getPlayUrl(fr: string = 'mac') {
        return `${QuarkProvider.getBaseUrl(fr)}/1/clouddrive/file/v2/play`;
    }

    private static getDownloadUrl(fr: string = 'mac') {
        return `${QuarkProvider.getBaseUrl(fr)}/1/clouddrive/file/download`;
    }

    private static getListUrl(fr: string = 'mac') {
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

        if (fr === 'mac') {
            // Match the User-Agent from user's working curl Phase 1 (API)
            headers['User-Agent'] = UA_MAC_PHASE1;
            headers['Referer'] = 'https://drive.quark.cn/';
            headers['sec-ch-ua-platform'] = '"macOS"';

            // Critical headers from user's working curl
            headers['x-u-kps-wg'] = SIG_KPS;
            headers['x-u-sign-wg'] = SIG_SIGN;
            headers['x-u-vcode'] = SIG_VCODE;
        } else {
            headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            headers['Origin'] = 'https://drive-pc.quark.cn';
            headers['Referer'] = 'https://drive-pc.quark.cn/static/pc/index.html';
            headers['x-u-vcode'] = Date.now().toString();
        }
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
        const isAudioFile = !!fileId.match(/\.(mp3|flac|wav|m4a|ogg)$/i);
        const isActuallyAudioNow = context.isAudio || isAudioFile;

        console.log(`[Quark] V9 Hybrid: Resolving ${fileId}. (Audio: ${isActuallyAudioNow})`);

        // First attempt: PC API (Browser headers) - most stable for general use
        try {
            if (isActuallyAudioNow) {
                return await this.resolveAudioPC(fileId, context, meta);
            } else {
                return await this.resolveVideoPC(fileId, context, meta);
            }
        } catch (pcErr: any) {
            console.warn(`[Quark] PC Resolution failed, falling back to MAC: ${pcErr.message}`);

            // Fallback attempt: Mac API (V8 Header Fix) - handles large files and specific resolutions
            try {
                if (isActuallyAudioNow) {
                    return await this.resolveAudioMac(fileId, context, meta);
                } else {
                    return await this.resolveVideoMac(fileId, context, meta);
                }
            } catch (macErr: any) {
                console.error(`[Quark] V9 Hybrid: Both PC and MAC failed.`);
                throw macErr;
            }
        }
    }

    private async resolveAudioPC(fileId: string, context: QuarkContext, meta: any): Promise<PlayableSource> {
        console.log('[Quark V9] Audio (PC)...');
        const query = new URLSearchParams(this.getQuarkQueryParams('pc'));
        const headers = this.getQuarkHeaders(context.cookie, 'pc');

        const response = await fetch(`${QuarkProvider.getDownloadUrl('pc')}?${query.toString()}`, {
            method: 'POST',
            headers: headers as any,
            body: JSON.stringify({
                fids: [fileId],
                share_id: context.shareId || '', // Essential: Empty string if not share
                cn_sw: 'open',
                ab_tag: '_'
            })
        });

        const text = await response.text();
        if (!response.ok || text.includes('31001') || text.includes('Invalid CORS request')) {
            throw new Error(`Quark Audio (PC) failed: ${text.substring(0, 100)}`);
        }

        const dlData = JSON.parse(text);
        if (dlData.code !== 0 && dlData.code !== 200) {
            throw new Error(`Quark Audio (PC) error code ${dlData.code}: ${text.substring(0, 50)}`);
        }

        const fileList = dlData.data || [];
        if (fileList.length === 0) throw new Error('Quark Audio (PC) returned empty file list');

        const fileInfo = fileList[0];
        if (!fileInfo.download_url) throw new Error('Quark Audio (PC) missing download URL');

        const newCookie = this.mergeCookies(context.cookie, response.headers);

        return {
            id: fileId,
            url: fileInfo.download_url,
            type: 'audio',
            headers: {
                ...headers,
                'Cookie': newCookie,
            },
            meta: {
                ...meta,
                ...fileInfo,
                title: fileInfo.file_name || meta.title || '',
            }
        };
    }

    private async resolveAudioMac(fileId: string, context: QuarkContext, meta: any): Promise<PlayableSource> {
        console.log('[Quark V9] Audio (MAC)...');
        const query = new URLSearchParams(this.getQuarkQueryParams('mac'));
        const headers = this.getQuarkHeaders(context.cookie, 'mac');

        const response = await fetch(`${QuarkProvider.getDownloadUrl('mac')}?${query.toString()}`, {
            method: 'POST',
            headers: headers as any,
            body: JSON.stringify({
                fids: [fileId],
                share_id: context.shareId || '',
                cn_sw: 'open',
                ab_tag: '_'
            })
        });

        const text = await response.text();
        if (!response.ok || text.includes('31001') || text.includes('Invalid CORS request')) {
            throw new Error(`Quark Audio (MAC) failed: ${text.substring(0, 100)}`);
        }

        const dlData = JSON.parse(text);
        if (dlData.code !== 0 && dlData.code !== 200) {
            throw new Error(`Quark Audio (MAC) error code ${dlData.code}: ${text.substring(0, 50)}`);
        }

        const fileList = dlData.data || [];
        if (fileList.length === 0) throw new Error('Quark Audio (MAC) returned empty file list');

        const fileInfo = fileList[0];
        if (!fileInfo.download_url) throw new Error('Quark Audio (MAC) missing download URL');

        const newCookie = this.mergeCookies(context.cookie, response.headers);

        return {
            id: fileId,
            url: fileInfo.download_url,
            type: 'audio',
            headers: {
                ...headers,
                'Cookie': newCookie,
            },
            meta: {
                ...meta,
                ...fileInfo,
                title: fileInfo.file_name || meta.title || '',
            }
        };
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
        const resolutions = (videoInfo.video_stream_list || []).map((s: any) => ({
            id: s.video_type,
            name: s.video_type,
            url: s.video_url
        }));

        const bestRes = resolutions.find((r: any) => r.id === 'original') || resolutions[0];
        if (!bestRes) throw new Error('Quark Video (PC) returned no valid resolutions');

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

    private async resolveVideoMac(fileId: string, context: QuarkContext, meta: any): Promise<PlayableSource> {
        console.log('[Quark V9] Video (MAC)...');
        const query = new URLSearchParams(this.getQuarkQueryParams('mac'));
        const headers = this.getQuarkHeaders(context.cookie, 'mac');

        const response = await fetch(`${QuarkProvider.getPlayUrl('mac')}?${query.toString()}`, {
            method: 'POST',
            headers: headers as any,
            body: JSON.stringify({
                fid: fileId,
                share_id: context.shareId || '',
                video_type: 'original'
            })
        });

        const text = await response.text();
        if (!response.ok || text.includes('31001') || text.includes('Invalid CORS request')) {
            throw new Error(`Quark Video (MAC) failed: ${text.substring(0, 100)}`);
        }

        const data = JSON.parse(text);
        if (data.code !== 0 && data.code !== 200) {
            throw new Error(`Quark Video (MAC) error code ${data.code}: ${text.substring(0, 50)}`);
        }

        const videoInfo = data.data || {};
        const resolutions = (videoInfo.video_stream_list || []).map((s: any) => ({
            id: s.video_type,
            name: s.video_type,
            url: s.video_url
        }));

        const bestRes = resolutions.find((r: any) => r.id === 'original') || resolutions[0];
        if (!bestRes) throw new Error('Quark Video (MAC) returned no valid resolutions');

        const newCookie = this.mergeCookies(context.cookie, response.headers);

        return {
            id: fileId,
            url: bestRes.url,
            type: bestRes.url.includes('.m3u8') ? 'hls' : 'mp4',
            headers: {
                ...headers,
                'User-Agent': UA_MAC_PHASE2,
                'Referer': 'https://drive-pc.quark.cn/',
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
        // Corrected parameter name to 'token' based on browser research and verify-quark.js
        const url = `https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken?client_id=${clientId}&v=${v}&token=${token}&request_id=${requestId}&t=${t}`;

        const res = await fetch(url, {
            headers: {
                'Referer': 'https://pan.quark.cn/',
                'Cookie': cookies || ''
            }
        });
        const data = await res.json() as any;
        logLogin(`[CheckStatus] Response Data: ${JSON.stringify(data)}`);
        logLogin(`[CheckStatus] Status: ${data.status}, Message: ${data.message}`);

        const commonHeaders = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
            'Referer': 'https://pan.quark.cn/',
            'Origin': 'https://pan.quark.cn',
            'Accept': 'application/json, text/plain, */*'
        };

        const extractCookies = (fetchRes: Response) => {
            let cookies: string[] = [];
            // Node 18+ / Undici supports getSetCookie()
            if (typeof (fetchRes.headers as any).getSetCookie === 'function') {
                cookies = (fetchRes.headers as any).getSetCookie();
            } else {
                // Fallback
                const val = fetchRes.headers.get('set-cookie');
                if (val) cookies = [val];
            }

            // Log raw cookies for debugging
            logLogin(`[CheckStatus] Raw Set-Cookie: ${JSON.stringify(cookies)}`);

            // Join and parse
            return cookies.map(c => c.split(';')[0]).join('; ');
        };

        // data.status === 2000000 is the general response success code
        if (data.status === 2000000) {
            // Fix: Ticket is nested in data.data.members.service_ticket
            const ticket = data.data?.members?.service_ticket || data.data?.ticket;
            logLogin(`[CheckStatus] Got ticket: ${ticket}`);
            let currentCookies = cookies;

            if (!ticket) {
                console.error('[Quark] Ticket not found in response');
                logLogin('[CheckStatus] Error: Ticket missing from response');
                return { status: 'expired', statusCode: data.status };
            }

            try {
                // Step 1: Account Info to get initial cookies using ticket (v0.2.0 Flow)
                const accountUrl = `https://pan.quark.cn/account/info?st=${ticket}&lw=scan`;
                const accountRes = await fetch(accountUrl, {
                    method: 'GET',
                    headers: {
                        ...commonHeaders,
                        'sec-ch-ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not_A Brand";v="24"',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'Cookie': currentCookies || ''
                    }
                });

                const step1Cookies = extractCookies(accountRes);
                logLogin(`[CheckStatus] Step 1 Account Cookies: ${step1Cookies}`);
                if (step1Cookies) {
                    currentCookies = currentCookies ? `${currentCookies}; ${step1Cookies}` : step1Cookies;
                }

                // Step 2: Config to get __puus using PC endpoint
                const configUrl = 'https://drive-pc.quark.cn/1/clouddrive/config?pr=ucpro&fr=pc&uc_param_str=';
                logLogin(`[CheckStatus] Requesting Config: ${configUrl}`);
                const configRes = await fetch(configUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
                        'Referer': 'https://pan.quark.cn/',
                        'Origin': 'https://pan.quark.cn',
                        'accept': 'application/json, text/plain, */*',
                        'sec-ch-ua': '"Microsoft Edge";v="143", "Chromium";v="143", "Not_A Brand";v="24"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"macOS"',
                        'sec-ch-ua-full-version-list': '"Microsoft Edge";v="143.0.3650.80", "Chromium";v="143.0.7499.110", "Not_A Brand";v="24.0.0.0"',
                        'sec-fetch-site': 'same-site',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'Cookie': currentCookies || ''
                    }
                });

                logLogin(`[CheckStatus] Step 2 Config Status: ${configRes.status}`);
                // Only read text if error or empty cookies to debug
                // But we need to use getSetCookie first
                const step2Cookies = extractCookies(configRes);
                logLogin(`[CheckStatus] Step 2 Config Cookies: ${step2Cookies}`);

                if (!step2Cookies && !configRes.ok) {
                    const text = await configRes.text();
                    logLogin(`[CheckStatus] Step 2 Error Body: ${text.substring(0, 200)}`);
                }
                if (step2Cookies) {
                    currentCookies = currentCookies ? `${currentCookies}; ${step2Cookies}` : step2Cookies;
                }

                console.log('[Quark] Login Complete. Captured cookies length:', currentCookies?.length || 0);
                logLogin(`[CheckStatus] Final Cookies: ${currentCookies}`);
            } catch (error: any) {
                console.error('[Quark] Failed to exchange service ticket for cookies:', error);
                logLogin(`[CheckStatus] Error in exchange: ${error.message} \nStack: ${error.stack}`);
            }

            return {
                status: 'success',
                cookie: currentCookies || `service_ticket=${ticket}`,
                statusCode: data.status
            };
        } else if (data.status === 50004001 || data.status === 50004002 || data.status === 0 || data.status === 200) {
            // Waiting for scan or confirmation
            return { status: 'pending', statusCode: data.status };
        }

        console.warn(`[Quark] Check Status Error: ${data.status} ${data.message}`);

        // Other status codes are considered expired
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
            const response = await fetch(url, { method: 'GET', headers });
            if (!response.ok) throw new Error(`Failed to get account info: ${response.status}`);

            const data = await response.json() as any;
            if (data.code !== 0 && data.code !== 200 && data.code !== 'OK') {
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
            if (cookiePart) cookies.push(cookiePart);
        }
        return cookies.join('; ');
    }

    private mergeCookies(oldCookie: string | undefined, newCookie: string | undefined | Headers): string {
        const cookieMap = new Map<string, string>();

        // 1. Initial Cookies
        if (oldCookie) {
            oldCookie.split(';').forEach(part => {
                const [key, val] = part.trim().split('=');
                if (key && val) cookieMap.set(key, val);
            });
        }

        // 2. Set-Cookie from Response
        if (newCookie) {
            if (typeof newCookie === 'string') {
                newCookie.split(';').forEach(part => {
                    const [key, val] = part.trim().split('=');
                    if (key && val) cookieMap.set(key, val);
                });
            } else if (typeof (newCookie as any).getSetCookie === 'function') {
                const setCookies = (newCookie as any).getSetCookie();
                setCookies.forEach((c: string) => {
                    const firstPart = c.split(';')[0];
                    const [key, val] = firstPart.trim().split('=');
                    if (key && val) cookieMap.set(key, val);
                });
            } else if (typeof (newCookie as any).get === 'function') {
                const sc = (newCookie as any).get('set-cookie');
                if (sc) {
                    // Simplistic fallback for single cookie or comma-separated
                    sc.split(',').forEach((c: string) => {
                        const firstPart = c.split(';')[0];
                        const [key, val] = firstPart.trim().split('=');
                        if (key && val) cookieMap.set(key, val);
                    });
                }
            }
        }

        const parts: string[] = [];
        cookieMap.forEach((val, key) => {
            parts.push(`${key}=${val}`);
        });
        return parts.join('; ');
    }

    private async ensureSession(cookie: string): Promise<string> {
        let currentCookies = cookie;
        const commonHeaders = {
            'User-Agent': UA_MAC_PHASE1,
            'Referer': 'https://pan.quark.cn/',
            'Origin': 'https://pan.quark.cn',
            'Accept': 'application/json, text/plain, */*'
        };

        const extract = (headers: Headers) => {
            if (typeof (headers as any).getSetCookie === 'function') {
                return (headers as any).getSetCookie().map((c: string) => c.split(';')[0]).join('; ');
            }
            const val = headers.get('set-cookie');
            return val ? val.split(',').map(c => c.split(';')[0]).join('; ') : '';
        };

        try {
            // Step 1: Account Info
            const accountUrl = 'https://pan.quark.cn/account/info?fr=pc&platform=pc';
            const accountRes = await fetch(accountUrl, {
                method: 'GET',
                headers: { ...commonHeaders, 'Cookie': currentCookies }
            });
            const step1Set = extract(accountRes.headers);
            if (step1Set) currentCookies = this.mergeCookies(currentCookies, step1Set);

            // Step 2: Drive-PC Config (Crucial for __uus)
            const configUrl = 'https://drive-pc.quark.cn/1/clouddrive/config?pr=ucpro&fr=pc&uc_param_str=';
            const configRes = await fetch(configUrl, {
                method: 'GET',
                headers: { ...commonHeaders, 'Cookie': currentCookies }
            });
            const step2Set = extract(configRes.headers);
            if (step2Set) currentCookies = this.mergeCookies(currentCookies, step2Set);

            return currentCookies;
        } catch (e) {
            console.error('[Quark] ensureSession failed:', e);
            return cookie; // Fallback to original
        }
    }

    private cleanCookies(cookie: string): string {
        const ALLOWED_PREFIXES = ['__kuus', '__uus', '__puus', 'video_auth', 'v_auth', 'token'];
        // Also keep if it looks like a session ID if needed, but these are usually enough for Quark
        return cookie.split(';').filter(c => {
            const key = c.trim().split('=')[0].toLowerCase();
            return ALLOWED_PREFIXES.some(prefix => key.includes(prefix));
        }).join('; ');
    }
}
