
import fetch from 'node-fetch';

async function testVideoResolution(cookie: string, fileId: string) {
    const url = 'https://drive-pc.quark.cn/1/clouddrive/file/video/play';
    const headers = {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Origin': 'https://drive-pc.quark.cn',
        'Referer': 'https://drive-pc.quark.cn/static/pc/index.html'
    };

    console.log(`[*] Testing Quark Video API for FID: ${fileId}`);
    console.log(`[*] Headers:`, JSON.stringify(headers, null, 2));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                fid: fileId,
                video_type: 'original'
            })
        });

        console.log(`[*] Status: ${response.status}`);
        const text = await response.text();
        console.log(`[*] Body: ${text.substring(0, 500)}`);

        if (text.includes('Invalid CORS request')) {
            console.log("\n[!] FAILED: Still getting 'Invalid CORS request'");
        } else if (text.includes('31001')) {
            console.log("\n[!] FAILED: Still getting 31001 (Unauthorized)");
        } else {
            console.log("\n[+] SUCCESS: No CORS error or 31001!");
        }
    } catch (e) {
        console.error("[!] Exception:", e);
    }
}

const cookie = process.argv[2];
const fid = process.argv[3];

if (!cookie || !fid) {
    console.log("Usage: node test_quark_video.js <cookie> <fid>");
    process.exit(1);
}

testVideoResolution(cookie, fid);
