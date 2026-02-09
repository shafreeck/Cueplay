const https = require('https');

const COOKIES = '__uus=NxQy9X23QZUbTpmrmJnx3TUycLpVaexkusJMqP/rBzQxL23BrkB1C6EnuOVA5PPqCOo9OKB4BUDwitSVYq5IcFwLaHH53ib1Hljb23a044/tOg==; __kuus=NxQy9X23QZUbTpmrmJnx3TUyS/jylQ6oaA0o6Kgq9M35oRRObid2+30fPrqAeH5LW5p0lDAqZMMJIVjW59ocIm5K0N+WoMI524AZr7Fpilk3OA==';
const FID = 'c7271d773e6245e4ab446a1593581c14';
const SIGN_HEADERS = {
    'x-u-kps-wg': 'NxQket6jCywZUfDoszEg4tX3wZAMqrAKCZlKaxP1YYHMI8UoExn/tZWKb//iy9GbIFMfjNYUAvMiBA3zydcu4TTfbLIqn0F4fNOmGQtrBgjpLg==',
    'x-u-sign-wg': 'NxThLnosm2TC6Xb/dRv1r0pQKwu5HnH3r7qtdOfaPd3kfQv5vgA3+vb3vmkJ+KnqBiw=',
    'x-u-vcode': '1770462732012',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699 quark-cloud-drive/2.5.40'
};

async function test() {
    console.log('--- Phase 1: Test Download Interface ---');
    const downloadUrl = await new Promise((resolve, reject) => {
        const options = {
            hostname: 'drive-pc.quark.cn',
            path: '/1/clouddrive/file/download?bi=999&ch=pcquark%40clouddrive_share2&fr=mac&ve=6.3.0.699',
            method: 'POST',
            headers: {
                ...SIGN_HEADERS,
                'Content-Type': 'application/json',
                'Cookie': COOKIES
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(`Download API failed: ${res.statusCode} ${data}`);
                const json = JSON.parse(data);
                if (json.code !== 0) return reject(`Download API Error: ${data}`);
                resolve(json.data[0].download_url);
            });
        });
        req.write(JSON.stringify({ fids: [FID], cn_sw: "open", ab_tag: "_" }));
        req.end();
    });
    console.log('Download URL obtained:', downloadUrl.substring(0, 100) + '...');

    console.log('\n--- Phase 2: Test CDN (Playback) Interface ---');
    await new Promise((resolve, reject) => {
        const url = new URL(downloadUrl);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                ...SIGN_HEADERS,
                'Cookie': COOKIES,
                'Range': 'bytes=0-100' // Request a small chunk
            }
        };
        const req = https.request(options, (res) => {
            console.log(`CDN Status: ${res.statusCode}`);
            console.log(`CDN Headers:`, JSON.stringify(res.headers, null, 2));
            if (res.statusCode === 200 || res.statusCode === 206) {
                console.log('[SUCCESS] CDN access verified!');
                resolve();
            } else {
                reject(`CDN access failed: ${res.statusCode}`);
            }
        });
        req.end();
    });
}

test().catch(console.error);
