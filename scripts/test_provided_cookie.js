const https = require('https');
const fs = require('fs');

// Session cookies from Turn 27
const SESSION_COOKIES = '__uus=NxQy9X23QZUbTpmrmJnx3TUycLpVaexkusJMqP/rBzQxL23BrkB1C6EnuOVA5PPqCOo9OKB4BUDwitSVYq5IcFwLaHH53ib1Hljb23a044/tOg==; __kuus=NxQy9X23QZUbTpmrmJnx3TUyS/jylQ6oaA0o6Kgq9M35oRRObid2+30fPrqAeH5LW5p0lDAqZMMJIVjW59ocIm5K0N+WoMI524AZr7Fpilk3OA==';

// Signatures from Turn 27
const SIGN_HEADERS = {
    'x-u-kps-wg': 'NxQket6jCywZUfDoszEg4tX3wZAMqrAKCZlKaxP1YYHMI8UoExn/tZWKb//iy9GbIFMfjNYUAvMiBA3zydcu4TTfbLIqn0F4fNOmGQtrBgjpLg==',
    'x-u-sign-wg': 'NxThLnosm2TC6Xb/dRv1r0pQKwu5HnH3r7qtdOfaPd3kfQv5vgA3+vb3vmkJ+KnqBiw=',
    'x-u-vcode': '1770462732012'
};

function getCookies() {
    try {
        const fileCookies = fs.readFileSync('/Users/shafreeck/Codes/Cueplay/quark_cookie.txt', 'utf8').trim();
        return `${SESSION_COOKIES}; ${fileCookies}`;
    } catch (e) {
        return SESSION_COOKIES;
    }
}

const COOKIES = getCookies();

const options = {
    hostname: 'drive-pc.quark.cn',
    // Long URL to force JSON response
    path: '/1/clouddrive/file/download?bi=999&ch=pcquark%40clouddrive_share2&device_model=Mac+mini&fr=mac&la=zh-CN&nt=99&nw=0&pf=6001&pr=ucpro&sys=darwin&uc_param_str=dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt&ve=6.3.0.699&where_entry=task_init',
    method: 'POST',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699 quark-cloud-drive/2.5.40',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        ...SIGN_HEADERS,
        'Cookie': COOKIES
    }
};

async function run() {
    console.log('--- Phase 1: Download API ---');
    const downloadUrl = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(`Phase 1 Failed: ${res.statusCode} ${data}`);
                try {
                    const json = JSON.parse(data);
                    if (json.code !== 0) return reject(`Phase 1 API Error: ${data}`);
                    resolve(json.data[0].download_url);
                } catch (e) {
                    reject(`Failed to parse JSON: ${data.substring(0, 100)}`);
                }
            });
        });
        req.write(JSON.stringify({ fids: ["c7271d773e6245e4ab446a1593581c14"], cn_sw: "open", ab_tag: "_" }));
        req.end();
    });
    console.log('[SUCCESS] Download URL extracted');

    console.log('\n--- Phase 2: CDN Playback ---');
    const url = new URL(downloadUrl.replace(/\\/g, ''));
    const cdnOptions = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699',
            'Referer': 'https://drive-pc.quark.cn/',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Range': 'bytes=20971520-25165823',
            'x-u-vcode': '1770462732012',
            'Cookie': COOKIES
        }
    };
    await new Promise((resolve, reject) => {
        const req = https.request(cdnOptions, (res) => {
            console.log(`CDN Status: ${res.statusCode}`);
            if (res.statusCode === 200 || res.statusCode === 206) {
                console.log('[SUCCESS] Playback verified!');
                resolve();
            } else {
                console.log('FAIL: CDN Status', res.statusCode);
                res.on('data', chunk => {
                    console.log('Body:', chunk.toString().substring(0, 200));
                });
                resolve(); // Don't throw to end gracefully
            }
        });
        req.end();
    });
}

run().catch(console.error);
