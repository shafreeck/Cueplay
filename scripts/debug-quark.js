
// Usage: node scripts/debug-quark.js

const cookie = '_UP_28A_52_=532; _UP_BT_=html5; _UP_F7E_8D_=SOLOr6H%2B98NtIzbm0UBH9kPwKLOVbxJPcg0RzQPI6KmsrSMw%2BRfAEYjKLHiThZj4IyEHeBAPtnvxewvGOJ7QR2lMWS1rXVfbZXRHxH%2Fc5ejTk%2FYYBSlxZ2dk3A9f%2FCMRwdlMk%2FmeaLHpV4OIH2rmX0VF6jsQF6Mjj3zd%2Fr57GvWdSoxLVcoYHnHePvhlhhEIQDSuL%2FGvkNjB4qA6kDtiJpdvth98y8zB33c4z4SJ%2FSi51ZiM6v002uRh%2BNAjFZGO6NNRiNAE7VDvdWCdFChCF9%2FbIl4G1tjPZ6Vv%2B%2BWIQKGLwqYXXdKb4wJd%2B%2F7uq2ffgLmNFBRz%2FE2aQI12X8pGOgcNniQVeBQRUsC8Clv7%2BuA%3D; _UP_6D1_64_=069; _UP_A4A_11_=wba2a1deb8aa4bf8ad6f244c57dd9f50; _UP_D_=mobile';
const fileId = 'bd97986f6faf4f888b394d92740145ee';

const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

async function test(name, url, headers, body) {
    console.log(`\n--- Testing ${name} ---`);
    console.log(`URL: ${url}`);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        const text = await res.text();
        console.log(`Status: ${res.status}`);

        let success = false;
        if (res.status === 200) {
            try {
                const json = JSON.parse(text);
                if (json.code === 0 || json.code === 200) {
                    if (json.data && (json.data.download_url || (json.data.video_stream_list && json.data.video_stream_list.length > 0))) {
                        success = true;
                    }
                }
            } catch (e) { }
        }

        if (success) {
            console.log(`✅ SUCCESS`);
            return true;
        } else {
            console.log(`❌ FAILED. Response: ${text.substring(0, 200)}...`);
            return false;
        }
    } catch (e) {
        console.error(`❌ ERROR: ${e.message}`);
        return false;
    }
}

async function main() {
    console.log(`Testing with FileID: ${fileId}`);

    // 1. Current Mac Strategy (drive.quark.cn) - with Fixed 'ch' param
    await test('Mac Fixed (drive.quark.cn)', 'https://drive.quark.cn/1/clouddrive/file/v2/play?pr=ucpro&fr=mac&uc_param_str=dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt&vcode=' + Date.now(), {
        'Cookie': cookie,
        'Content-Type': 'application/json',
        'User-Agent': MAC_UA,
        'Referer': 'https://drive.quark.cn/',
    }, {
        fid: fileId,
        video_type: 'original',
        share_id: undefined
    });

    // 2. Mobile Strategy (drive-pc.quark.cn) - Standard (No Origin, Android UA)
    await test('Mobile Standard (drive-pc.quark.cn)', 'https://drive-pc.quark.cn/1/clouddrive/file/v2/play?pr=ucpro&fr=android&uc_param_str=dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt&vcode=' + Date.now(), {
        'Cookie': cookie,
        'Content-Type': 'application/json',
        'User-Agent': IPHONE_UA,
        'Referer': 'https://pan.quark.cn/',
    }, {
        fid: fileId,
        video_type: 'original'
    });

    // 3. PC Baseline
    await test('PC Baseline (drive-pc.quark.cn)', 'https://drive-pc.quark.cn/1/clouddrive/file/v2/play?pr=ucpro&fr=pc&uc_param_str=dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt&vcode=' + Date.now(), {
        'Cookie': cookie,
        'Content-Type': 'application/json',
        'User-Agent': PC_UA,
        'Referer': 'https://drive-pc.quark.cn/static/pc/index.html',
        'Origin': 'https://drive-pc.quark.cn'
    }, {
        fid: fileId,
        video_type: 'original',
        share_id: ""
    });
}

main();
