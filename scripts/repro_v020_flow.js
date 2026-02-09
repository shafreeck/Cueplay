const https = require('https');
const fs = require('fs');

const cookieFile = '/Users/shafreeck/Codes/Cueplay/quark_cookie.txt';
const cookie = fs.readFileSync(cookieFile, 'utf8').trim();

console.log('Using initial cookies:', cookie);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';

async function fetchStep(url, headers) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'GET',
            headers: {
                ...headers,
                'User-Agent': UA,
                'Referer': 'https://pan.quark.cn/',
                'Origin': 'https://pan.quark.cn'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const sc = res.headers['set-cookie'] || [];
                console.log(`\nURL: ${url}`);
                console.log(`Status: ${res.statusCode}`);
                console.log('Set-Cookie received:', sc.length);
                sc.forEach(c => {
                    const firstPart = c.split(';')[0];
                    console.log('  ->', firstPart);
                });
                resolve({ status: res.statusCode, cookies: sc, body: data });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    console.log('--- Step 1: Account Info ---');
    const step1 = await fetchStep('https://pan.quark.cn/account/info', { 'Cookie': cookie });

    let combinedCookies = cookie;
    if (step1.cookies) {
        step1.cookies.forEach(c => {
            combinedCookies += '; ' + c.split(';')[0];
        });
    }

    console.log('\n--- Step 2: Drive-PC Config ---');
    const step2 = await fetchStep('https://drive-pc.quark.cn/1/clouddrive/config?pr=ucpro&fr=pc&uc_param_str=', { 'Cookie': combinedCookies });

    if (step2.cookies) {
        step2.cookies.forEach(c => {
            combinedCookies += '; ' + c.split(';')[0];
        });
    }

    console.log('\n--- Final Cookie Check for __uus ---');
    if (combinedCookies.includes('__uus')) {
        console.log('SUCCESS! __uus found in combined cookies.');
    } else {
        console.log('FAILED: __uus still missing.');
    }
}

run().catch(console.error);
