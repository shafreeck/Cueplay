
const crypto = require('crypto');

async function run() {
    const clientId = '532';
    const v = '1.2';
    const requestId = crypto.randomUUID();
    const t = Date.now();

    const tokenUrl = `https://uop.quark.cn/cas/ajax/getTokenForQrcodeLogin?client_id=${clientId}&v=${v}&request_id=${requestId}&t=${t}`;

    console.log(`Fetching Token from: ${tokenUrl}`);

    try {
        const res = await fetch(tokenUrl);
        const data = await res.json();

        console.log('Token Response:', JSON.stringify(data, null, 2));
        const cookies = res.headers.get('set-cookie');
        console.log('Set-Cookie:', cookies);

        if (data.status !== 2000000) {
            console.error('Failed to get token');
            return;
        }

        const token = data.data.members.token;
        console.log('Token:', token);

        // Check status WITHOUT cookies
        const requestId2 = crypto.randomUUID();
        const t2 = Date.now();
        const statusUrl = `https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken?client_id=${clientId}&v=${v}&token=${token}&request_id=${requestId2}&t=${t2}`;

        console.log(`Checking Status (No Cookies) from: ${statusUrl}`);
        const statusRes = await fetch(statusUrl);
        const statusData = await statusRes.json();
        console.log('Status Response (No Cookies):', JSON.stringify(statusData, null, 2));

        // Check status WITH cookies (if available)
        if (cookies) {
            const requestId3 = crypto.randomUUID();
            const t3 = Date.now();
            const statusUrl3 = `https://uop.quark.cn/cas/ajax/getServiceTicketByQrcodeToken?client_id=${clientId}&v=${v}&token=${token}&request_id=${requestId3}&t=${t3}`;

            console.log(`Checking Status (WITH Cookies) from: ${statusUrl3}`);
            const statusRes3 = await fetch(statusUrl3, {
                headers: {
                    'Cookie': cookies
                }
            });
            const statusData3 = await statusRes3.json();
            console.log('Status Response (WITH Cookies):', JSON.stringify(statusData3, null, 2));
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
