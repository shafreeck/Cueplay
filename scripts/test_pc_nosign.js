const https = require('https');

// Cookies provided by user (Proven to work on PC endpoint WITH signatures)
const COOKIES = '__uus=NxQy9X23QZUbTpmrmJnx3TUycLpVaexkusJMqP/rBzQxL23BrkB1C6EnuOVA5PPqCOo9OKB4BUDwitSVYq5IcFwLaHH53ib1Hljb23a044/tOg==; __kuus=NxQy9X23QZUbTpmrmJnx3TUyS/jylQ6oaA0o6Kgq9M35oRRObid2+30fPrqAeH5LW5p0lDAqZMMJIVjW59ocIm5K0N+WoMI524AZr7Fpilk3OA==';

const fid = 'c7271d773e6245e4ab446a1593581c14'; // User's FID

const optionsPCNoSign = {
    hostname: 'drive-pc.quark.cn', // <--- PC Endpoint
    path: '/1/clouddrive/file/download?bi=999&ch=pcquark%40clouddrive_share2&device_model=Mac+mini&fr=mac&la=zh-CN&nt=99&nw=0&pf=6001&pr=ucpro&sys=darwin&uc_param_str=dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt&ve=6.3.0.699&where_entry=task_init',
    method: 'POST',
    headers: {
        'Cookie': COOKIES,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699',
        'Referer': 'https://drive.quark.cn/', // Try Mac referer first, or PC referer? User used PC endpoint.
        'Content-Type': 'application/json'
        // NO SIGNATURE HEADERS
    }
};

console.log('Testing PC Endpoint WITHOUT Signatures...');

const req = https.request(optionsPCNoSign, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${data.substring(0, 500)}`);
    });
});
req.on('error', console.error);
req.write(JSON.stringify({
    fids: [fid],
    share_id: '',
    cn_sw: 'open',
    ab_tag: '_'
}));
req.end();
