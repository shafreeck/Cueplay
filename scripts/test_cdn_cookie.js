const https = require('https');
const fs = require('fs');

// User's working parameters
const COOKIE = '__uus=NxQy9X23QZUbTpmrmJnx3TUynz2pvEAwsvClD6QfXbR/3tBYAKiWR9wnnhio95z80HKB9fXm1/p55Z+71fzOVJ5K5n1RtKdwGzTK8QZUR6Dq3Q==; __kuus=NxQy9X23QZUbTpmrmJnx3TUyT4c01nIQ0xfhpeC5G6bThys0Iw9S9nnWClbs/U9XQQTeljL7CLmTPW85JfMYcgJr3h8GzZY/2OU7VxaHdwLJSA==';
const KPS = 'NxR/DbHcJ1xA4KX07QAmK+aPRaqUNIn1fXutykpEFv7LzORm2cTmjJRD6el+aI+lSRqhn4LIo4Jys2xc85braEuzl0YI3oel+GWBWHjG9ZMgTA==';
const SIGN = 'NxTZqd9r8ynwC+l20lEk+azDnbHVhv7itBG8ZV2LfcdUTuYC1tFCWp+9LbUq8lwoz14=';
const VCODE = '1770624659600';
const FID = '5121fda9d16646fabcf4cf4b0ea3916b';

async function request(url, options, body = null) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const reqOptions = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getDownloadUrl(cookie) {
    const url = `https://drive-pc.quark.cn/1/clouddrive/file/download?bi=999&ch=pcquark%40clouddrive_share2&device_model=Mac+mini&fr=mac&la=zh-CN&nt=99&nw=0&pf=6001&pr=ucpro&sys=darwin&uc_param_str=dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt&ve=6.4.0.728&where_entry=task_init`;
    const res = await request(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie,
            'x-u-kps-wg': KPS,
            'x-u-sign-wg': SIGN,
            'x-u-vcode': VCODE,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.4.0.728 quark-cloud-drive/2.5.40'
        }
    }, JSON.stringify({ fids: [FID], cn_sw: 'open', ab_tag: '_' }));

    if (res.status === 200) {
        const data = JSON.parse(res.body);
        return data.data[0].download_url;
    }
    throw new Error(`API Failed: ${res.status} ${res.body}`);
}

async function run() {
    console.log('Obtaining Download URL with valid Cookie...');
    const dlUrl = await getDownloadUrl(COOKIE);

    console.log('1. CDN Request WITHOUT Cookie:', (await request(dlUrl, {})).status);
    console.log('2. CDN Request WITH valid Cookie:', (await request(dlUrl, { headers: { 'Cookie': COOKIE } })).status);
    console.log('3. CDN Request WITH INVALID Cookie (__uus=invalid):', (await request(dlUrl, { headers: { 'Cookie': '__uus=invalid' } })).status);
}

run().catch(console.error);
