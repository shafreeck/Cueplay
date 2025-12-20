import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const cookie = searchParams.get('cookie');
    const referer = searchParams.get('referer') || 'https://pan.quark.cn/';

    if (!url) {
        return new NextResponse(JSON.stringify({ error: 'Missing url' }), { status: 400 });
    }

    const headers = new Headers();
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('Referer', referer);
    if (cookie) {
        headers.set('Cookie', cookie);
    }

    // Forward standard conditional headers to avoid 412
    ['if-range', 'if-match', 'if-none-match', 'if-modified-since', 'if-unmodified-since'].forEach(h => {
        const val = request.headers.get(h);
        if (val) headers.set(h, val);
    });

    const range = request.headers.get('range');
    // Important: Only forward Range if present. Some servers 412 on empty or malformed Range.
    if (range) {
        headers.set('Range', range);
    } else {
        // Optional: Force a range request for initial stream probe if needed, but risky.
        // headers.set('Range', 'bytes=0-');
    }
    console.log(`[Proxy] Requesting: ${url?.substring(0, 50)}... Range: ${range}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers,
        });

        const responseHeaders = new Headers();

        // Forward important headers
        ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(h => {
            const val = response.headers.get(h);
            if (val) {
                responseHeaders.set(h, val);
            }
        });

        // Add CORS for frontend access
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        responseHeaders.set('Access-Control-Allow-Headers', 'Range');
        responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Proxy] Upstream Error ${response.status}:`, errorText);
            console.error(`[Proxy] Request Headers:`, Object.fromEntries(headers.entries()));
            return new NextResponse(errorText, { status: response.status });
        }

        console.log(`[Proxy] Success: ${response.status} Content-Type: ${responseHeaders.get('content-type')}`);
        return new NextResponse(response.body, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (e: any) {
        console.error(`[Proxy] Error: ${e.message}`);
        return new NextResponse(JSON.stringify({ error: 'Proxy failed', message: e.message }), { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Type',
        },
    });
}
