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
    headers.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('Referer', referer);
    if (cookie) {
        headers.set('Cookie', cookie);
    }

    const range = request.headers.get('range');
    if (range) {
        headers.set('Range', range);
    }

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
