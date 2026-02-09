const https = require('https');

// The ticket from the user's log (even if expired, we want to see the 302 behavior)
// Actually, we can't test without a valid ticket.
// But we can test if hitting pan.quark.cn with the ctoken we GOT gives us anything?

const ctoken = "-Tp52EgZ3Y3svpg2SYNOs2rf"; // From log
const cookie = `ctoken=${ctoken}; _UP_28A_52_=532; _UP_BT_=html5`;

const options = {
    hostname: 'pan.quark.cn',
    port: 443,
    path: '/',
    method: 'GET',
    headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699',
        'Referer': 'https://pan.quark.cn/'
    }
};

const req = https.request(options, (res) => {
    console.log('statusCode:', res.statusCode);
    console.log('headers:', res.headers);

    res.on('data', (d) => {
        // process.stdout.write(d);
    });
});

req.on('error', (e) => {
    console.error(e);
});
req.end();
