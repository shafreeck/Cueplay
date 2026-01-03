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
    private static QR_TOKEN_URL = 'https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin';
    private static QR_STATUS_URL = 'https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken';
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
            const headerObj: Record<string, string> = {};
            response.headers.forEach((v, k) => { headerObj[k] = v; });
            console.error('[Quark] API Request Failed:', {
                status: response.status,
                statusText: response.statusText,
                headers: headerObj
            });
            throw new Error(`Quark API failed: ${response.status} ${response.statusText}`);
        }

        // Capture new cookies (e.g. Video-Auth) from the response to use for playback
        const newCookies = (response.headers as any).getSetCookie
            ? (response.headers as any).getSetCookie().map((c: string) => c.split(';')[0]).join('; ')
            : (response.headers.get('set-cookie') ? this.parseCookieHeader(response.headers.get('set-cookie')!) : '');

        const data = await response.json() as any;

        if (data.code !== 0 && data.code !== 200) {
            console.error('[Quark] API Error Response:', JSON.stringify(data, null, 2));
            console.error('[Quark] Sent Cookie (First 50 chars):', headers.Cookie.substring(0, 50) + '...');
            throw new Error(`Quark API error: ${JSON.stringify(data)}`);
        }

        // Attempt to extract HLS URL. The structure varies, usually in data.data.play_url or similar.
        // I will look for common fields or update based on user feedback/error.
        // Commonly: data.data.video_info.play_url or data.data.m3u8_url
        // Let's look for a likely candidate.

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
                    height: v.video_info.height
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

        if (!playUrl) {
            throw new Error(`Could not find play URL in Quark response: ${JSON.stringify(data)}`);
        }

        return {
            id: fileId,
            url: playUrl,
            type: 'mp4', // The URL provided in the log is mp4, but sometimes m3u8. Check format extension if needed.
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

            // Termination condition:
            // 1. If we have fetched all items according to 'total' (if total > 0)
            // 2. Or if the returned list is absolutely empty (definitely no more data)
            // Note: We DO NOT stop just because list.length < size, because server-side filtering (risk files)
            // can result in a short page even if there are more items on next pages.
            // However, we should be careful not to infinite loop if total is 0 or broken.
            // The safest bet for Quark is: if list is empty, we are done. If list has items, we try next page 
            // UNLESS we are sure we have everything.
            if ((total > 0 && allFiles.length >= total) || list.length === 0) {
                hasMore = false;
            } else {
                page++;
            }
        }

        return allFiles;
    }

    /**
     * Generate QR code for login
     * Based on captured Quark API: https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin
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

        // Capture session cookies from response
        const cookies = (response.headers as any).getSetCookie
            ? (response.headers as any).getSetCookie().map((c: string) => c.split(';')[0]).join('; ')
            : (response.headers.get('set-cookie') ? this.parseCookieHeader(response.headers.get('set-cookie')!) : '');

        // The QR code URL can be generated from the token
        // Use the exact format found in the official web client to avoid "Expired" errors on mobile
        // Missing parameters (client_id, ssb, uc_biz_str) caused the mobile app to reject the token
        const qrcodeUrl = `https://su.quark.cn/4_eMHBJ?token=${token}&client_id=532&ssb=weblogin&uc_param_str=&uc_biz_str=S:custom%7COPT:SAREA@0%7COPT:IMMERSIVE@1%7COPT:BACK_BTN_STYLE@0`;

        return { token, qrcodeUrl, cookies };
    }

    /**
     * Check QR code login status
     * Based on captured Quark API: https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken
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

        // Status code 50004001 means "not scanned yet" or "pending"
        if (data.status === 50004001) {
            return { status: 'pending', statusCode: data.status };
        }

        // Status code 50004002 means "scanned" (Waiting for confirmation)
        if (data.status === 50004002) {
            return { status: 'scanned', statusCode: data.status };
        }

        // Status code 2000000 means success
        if (data.status === 2000000 && data.data?.members?.service_ticket) {
            // Extract CAS cookies from the response (e.g. CASTGC)
            const setCookieHeader = (response.headers as any).getSetCookie
                ? (response.headers as any).getSetCookie().map((c: string) => c.split(';')[0]).join('; ')
                : (response.headers.get('set-cookie') ? this.parseCookieHeader(response.headers.get('set-cookie')!) : '');

            let currentCookies = cookies ? `${cookies}; ${setCookieHeader}` : setCookieHeader;
            const ticket = data.data.members.service_ticket;

            try {
                // Common headers for all requests to mimic browser behavior
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

                // Step 1: Account Info to get __pus directly using ticket (Simplified Flow)
                // Skip /login callback as per user observation
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

                // Step 2: Config to get __puus (Final Session Cookie)
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

                console.log('[Quark] Login Complete. Captured cookies length:', currentCookies.length);

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

        // Other status codes are considered expired or error
        return { status: 'expired', statusCode: data.status };
    }

    /**
     * Generate a UUID for request tracking
     */
    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * Parse Set-Cookie header to extract cookie string
     * Handles multiple cookies and ignores commas in Expires dates
     */
    private parseCookieHeader(setCookieHeader: string): string {
        const cookies: string[] = [];

        // Split by comma, but only if not followed by a space (which usually indicates a date like "Mon, 21 Oct")
        // This is a simple heuristic. A more robust way is to use a regex or a proper parser.
        // Given we want key=value; key=value, we can focus on extracting those.

        // Better approach: regex to find key=value at the start of each cookie definition
        // Set-Cookie header parts usually start with "Name=Value"

        // If we treat the whole string as one long string, we can try to split by ", "
        // but "Expires=..., " is tricky.

        // Let's iterate and split carefully.
        let start = 0;
        let depth = 0;
        const parts: string[] = [];

        for (let i = 0; i < setCookieHeader.length; i++) {
            if (setCookieHeader[i] === ',') {
                // Check if this comma is likely a separator or part of a date
                // Separators in Set-Cookie are typically followed by a non-space or end of string? 
                // No, usually ", Name=Value".
                // But date is "Mon, 01...". Comma followed by space.

                // Let's fallback to a simpler regex that works for most standard cookies
                // We mainly need the first part (Name=Value) of each Set-Cookie.
            }
        }

        // Simpler regex approach: 
        // Match "Key=Value;" or "Key=Value," or end of line.
        // But headers might be merged.

        // Actually, for Quark, we really only care about specific cookies or just forwarding everything intelligently.
        // If we just want to extract "key=value", we can look for that pattern.

        // Regex to split Set-Cookie string into individual cookies:
        // Split by comma that is NOT inside a date (e.g. "Mon, 12-Jan")
        // It's hard to be perfect without a library.

        // Let's try `set-cookie-parser` logic simplified:
        // Assume comma separation.
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
