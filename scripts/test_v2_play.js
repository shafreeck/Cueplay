const https = require('https');

// Cookies provided by user
const COOKIES = '__uus=NxQy9X23QZUbTpmrmJnx3TUycLpVaexkusJMqP/rBzQxL23BrkB1C6EnuOVA5PPqCOo9OKB4BUDwitSVYq5IcFwLaHH53ib1Hljb23a044/tOg==; __kuus=NxQy9X23QZUbTpmrmJnx3TUyS/jylQ6oaA0o6Kgq9M35oRRObid2+30fPrqAeH5LW5p0lDAqZMMJIVjW59ocIm5K0N+WoMI524AZr7Fpilk3OA==';

const fid = 'c7271d773e6245e4ab446a1593581c14'; // User's FID

const optionsV2 = {
    hostname: 'drive-pc.quark.cn', // <--- v0.2.0 used drive-pc
    path: '/1/clouddrive/file/v2/play?pr=ucpro&fr=pc', // <--- v0.2.0 endpoint
    method: 'POST',
    headers: {
        'Cookie': COOKIES,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Referer': 'https://pan.quark.cn/', // Mimic v0.2.0
        'Origin': 'https://pan.quark.cn',
        'Content-Type': 'application/json'
        // NO SIGNATURE HEADERS
    }
};

console.log('Testing v2/play Endpoint WITHOUT Signatures...');

const req = https.request(optionsV2, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${data.substring(0, 500)}`);
    });
});
req.on('error', console.error);
req.write(JSON.stringify({
    fid: fid, // v0.2.0 used 'fid' singular
    share_id: '',
    // additional params v0.2.0 might have used?
    video_type: 'original'
}));
req.end();
