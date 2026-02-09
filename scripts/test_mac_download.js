const https = require('https');
const fs = require('fs');

// Read cookie from file
const cookie = fs.readFileSync('quark_cookie.txt', 'utf8').trim();

// Target File ID
const fid = 'bd97986f6faf4f888b394d92740145ee'; // User's file ID

// Options for request
const optionsPC = {
    hostname: 'drive.quark.cn',
    path: '/1/clouddrive/file/download?pr=ucpro&fr=pc&vcode=' + Date.now(),
    method: 'POST',
    headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://drive-pc.quark.cn/',
        'Origin': 'https://drive-pc.quark.cn',
        'Content-Type': 'application/json'
    }
};

const optionsMac = {
    hostname: 'drive.quark.cn',
    // With card_ch=33 as fixed
    path: '/1/clouddrive/file/download?pr=ucpro&fr=mac&bi=999&card_ch=33&device_model=Mac%20mini&la=zh-CN&nt=99&nw=0&pf=6001&sys=darwin&ve=6.3.0.699&where_entry=task_init&vcode=' + Date.now(),
    method: 'POST',
    headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699',
        'Referer': 'https://drive.quark.cn/',
        'Content-Type': 'application/json'
    }
};

function testDownload(label, opts, body) {
    console.log(`\nTesting ${label}...`);
    const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Body: ${data.substring(0, 300)}...`);
            try {
                const json = JSON.parse(data);
                if (json.code === 31001) {
                    console.log('FAIL: 31001 Share Missing');
                } else if (json.code === 0) {
                    console.log('SUCCESS!');
                }
            } catch (e) { }
        });
    });

    req.on('error', e => console.error(e));
    req.write(JSON.stringify(body));
    req.end();
}

// Test 1: Mac with share_id="" (Current logic)
testDownload('Mac (share_id="")', optionsMac, {
    fids: [fid],
    share_id: '',
    cn_sw: 'open',
    ab_tag: '_'
});

// Test 2: Mac without share_id parameter
testDownload('Mac (no share_id)', optionsMac, {
    fids: [fid],
    // share_id omitted
    cn_sw: 'open',
    ab_tag: '_'
});

// Test 3: PC style (sanity check)
testDownload('PC (share_id="")', optionsPC, {
    fids: [fid],
    share_id: '',
    cn_sw: 'open',
    ab_tag: '_'
});
