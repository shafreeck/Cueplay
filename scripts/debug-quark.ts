// import fetch from 'node-fetch'; // Using global fetch

// Usage: ts-node scripts/debug-quark.ts

const cookie = 'b-user-id=5b2da3a4-ff0c-7cc8-86aa-b7395b766e98; _ON_EXT_DVIDN=eCy#AAMo49jaSz4qzsPyRdq3hsIDm9IpQKKXgHt/abAO7cLybZCEIOWslrNrrZ9Vs0UhQeE=; _qk_bx_ck_v1=eyJkZXZpY2VJZCI6ImVDeSNBQU1vNDlqYVN6NHF6c1B5UmRxM2hzSURtOUlwUUtLWGdIdC9hYkFPN2NMeWJaQ0VJT1dzbHJOcnJaOVZzMFVoUWVFPSIsImRldmljZUZpbmdlcnByaW50IjoiMDZiYmEwNTJiMmM3ZDhlYWMzNzNjZWZkMWYzYjY2MDQifQ==; __sdid=AARe85iRDA234rT/du5+uKPMwEGbRlYZoO+eE8Uex6gtGbiidPBxavwIQimm9GGI9V4=; _UP_D_=pc; _UP_A4A_11_=wb9d01d7a40f43d3adf6190e2d202803; __pus=7c664aabd7b63e9b85221476c31b07f8AAQy913qLdiLNypi+L4yvWKkRWEXdRh8E0l0VKOwKtNneZ+BncZRUOBwBBxKwxff4exKijZ38fTxySdLJVoUOoWM; __kp=0d80e6d0-d9a8-11f0-9b54-79c55787cc08; __kps=AATqA9WoDMtP7DxSlRE9vbPj; __ktd=1zPVaKnUj9MxynqZkbBnmw==; __uid=AATqA9WoDMtP7DxSlRE9vbPj; isg=BKCgFQAj3dw5L2-_kmEtmkZbcahyqYRzanv3JRqxnrtOFUM_wLjsAofmqbWVpTxL; tfstk=gorjmx4tV5EzNNzKlcWyNZaKucns1TSEDdMTKRK2BmnYBcNSax8VoV5_P5FrMnoxM0nsB5Yx6q3x2hMZsjnaujkTNRFAnAW0fzx_KRqVncWmm-miX65FYPw0ncA_fEHTcYH-I8K9HnQr2WBBrPfFYMyAkxmae6zVD-grCAntHVhxeTMZIfntWfHRFAHwMFKY68BSZA-v6VHte3HIQFntX53RFAc-6c3Y68BSIbht1mpICZG0h9R_rzD2B9wmNhKTVYCmT-TXfYrrhlcUHot9X2HjlXexN6voRKg_GqZPcBDbyJNoh5jHmm3_kynYf6sj2J4zMYNOOFG8Roqs8o1B-jEmsWiYP_KjX0MQC2zPBeGzW8qSPo_eIYq4Bo0EvMAx_zyQfAZGsgNQHSaKJodf4ItEO1Dv5LgHfYGFFTTMSyKj7JdT5dPtkYDjzT6WMP0xEYMfFTTB6qHoUpX5FerN.; __puus=9b2628df36908d8167c1aa8acef00d4dAAR1YpjxNCVLNQokZYD9Ev9RSIAr3dHumY9Cp8HyLAJ77s9zjzO4PwwZ7NEYKOD8z6cGc0Shw+9zoHR9oNP8J1kd/PXldYzAfBfeWzIdGI3k5OIDYXl8WvSL1aNFNPtDvXMN59LsATwG96oJ9QBT1FLSIOFdBdR5JyUELZfpj6Yu82dlWjawr7QmsvcAcVC0xyFzdwt6ObC/aMoHbwSGK0Yn; Video-Auth=JNNON6aAaCEqCStyiEcgtNTFLdeqbTnQT7SuOxFh+U0PGKHB3tvb1SSO9B4TuY7/fiFEdK1/boems9yll6Z6wOmJSrvpch5sJVoc5zWUTEnsu8LdtPK6sHqN750adIj22tLyhKe8RtwaqzIrkhGLtg==';
const fileId = '99fa8315189b47a28fd7af379f18b507';

// if (!cookie || !fileId) {
//    console.error('Usage: ts-node scripts/debug-quark.ts <cookie> <file_id>');
//    process.exit(1);
// }

const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

async function test(name: string, url: string, headers: any, body: any) {
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
    } catch (e: any) {
        console.error(`❌ ERROR: ${e.message}`);
        return false;
    }
}

async function main() {
    console.log(`Testing with FileID: ${fileId}`);


    const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
        share_id: "" // PC usually sends empty string
    });
}

main();
