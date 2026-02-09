import requests
import json
import time

COOKIE = "b-user-id=5b2da3a4-ff0c-7cc8-86aa-b7395b766e98; _ON_EXT_DVIDN=eCy#AAMo49jaSz4qzsPyRdq3hsIDm9IpQKKXgHt/abAO7cLybZCEIOWslrNrrZ9Vs0UhQeE=; _qk_bx_ck_v1=eyJkZXZpY2VJZCI6ImVDeSNBQU1vNDlqYVN6NHF6c1B5UmRxM2hzSURtOUlwUUtLWGdIdC9hYkFPN2NMeWJaQ0VJT1dzbHJOcnJaOVZzMFVoUWVFPSIsImRldmljZUZpbmdlcnByaW50IjoiMDZiYmEwNTJiMmM3ZDhlYWMzNzNjZWZkMWYzYjY2MDQifQ==; __sdid=AARe85iRDA234rT/du5+uKPMwEGbRlYZoO+eE8Uex6gtGbiidPBxavwIQimm9GGI9V4=; _UP_D_=pc; _UP_A4A_11_=wb9d01d7a40f43d3adf6190e2d202803; __pus=7c664aabd7b63e9b85221476c31b07f8AAQy913qLdiLNypi+L4yvWKkRWEXdRh8E0l0VKOwKtNneZ+BncZRUOBwBBxKwxff4exKijZ38fTxySdLJVoUOoWM; __kp=0d80e6d0-d9a8-11f0-9b54-79c55787cc08; __kps=AATqA9WoDMtP7DxSlRE9vbPj; __ktd=1zPVaKnUj9MxynqZkbBnmw==; __uid=AATqA9WoDMtP7DxSlRE9vbPj; isg=BKCgFQAj3dw5L2-_kmEtmkZbcahyqYRzanv3JRqxnrtOFUM_wLjsAofmqbWVpTxL; tfstk=gorjmx4tV5EzNNzKlcWyNZaKucns1TSEDdMTKRK2BmnYBcNSax8VoV5_P5FrMnoxM0nsB5Yx6q3x2hMZsjnaujkTNRFAnAW0fzx_KRqVncWmm-miX65FYPw0ncA_fEHTcYH-I8K9HnQr2WBBrPfFYMyAkxmae6zVD-grCAntHVhxeTMZIfntWfHRFAHwMFKY68BSZA-v6VHte3HIQFntX53RFAc-6c3Y68BSIbht1mpICZG0h9R_rzD2B9wmNhKTVYCmT-TXfYrrhlcUHot9X2HjlXexN6voRKg_GqZPcBDbyJNoh5jHmm3_kynYf6sj2J4zMYNOOFG8Roqs8o1B-jEmsWiYP_KjX0MQC2zPBeGzW8qSPo_eIYq4Bo0EvMAx_zyQfAZGsgNQHSaKJodf4ItEO1Dv5LgHfYGFFTTMSyKj7JdT5dPtkYDjzT6WMP0xEYMfFTTB6qHoUpX5FerN.; __puus=46e4cc6011844820b55261c9158b3ddeAAR1YpjxNCVLNQokZYD9Ev9RgGnbnF/qDjJgeJ2aooogenvW1HXe6fHZyUInI7//bXUjQ//mQ2UN6MNmlBt2x+0+tTzU/B2012G9sf6qosxD0maPefu0sRhkPe20/MhkYHOKkXNIN7PjNH0VKmPhOHsgdlKnb/LgOEW6MjFqv02dMa9IQ+eUzRrDVzsfv+mXVvlHdDjpZtY+vIrEGNBpanfc"
FID = "65374489"

def test_quark_api(fid, url, params, headers, label, method="POST"):
    print(f"\n--- Testing variant: {label} ({method}) ---")
    try:
        if method == "POST":
            resp = requests.post(url, params=params, headers=headers, json={"fid": fid, "video_type": "original"}, timeout=10)
        else:
            p = {**params, "fid": fid, "video_type": "original"}
            resp = requests.get(url, params=p, headers=headers, timeout=10)
            
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:200]}...")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("code") == 0:
                print(f"[SUCCESS] Got data!")
                return True
    except Exception as e:
        print(f"[ERROR] {e}")
    return False

if __name__ == "__main__":
    # Base headers observed from V7 implementation
    mac_headers = {
        "Cookie": COOKIE,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json"
    }
    
    pc_headers = {
        "Cookie": COOKIE,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": "https://drive-pc.quark.cn",
        "Referer": "https://drive-pc.quark.cn/static/pc/index.html"
    }

    variants = [
        # 4. Mac API (Only Referer, GET)
        {
            "label": "Mac API (Only Referer, GET)",
            "url": "https://drive.quark.cn/1/clouddrive/file/v2/play",
            "params": {"pr": "ucpro", "fr": "mac", "uc_param_str": "dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt", "vcode": str(int(time.time() * 1000))},
            "headers": {k:v for k,v in mac_headers.items() if k != "Content-Type"},
            "method": "GET"
        },
        # 5. Mac API (Only Referer, POST)
        {
            "label": "Mac API (Only Referer, POST)",
            "url": "https://drive.quark.cn/1/clouddrive/file/v2/play",
            "params": {"pr": "ucpro", "fr": "mac", "uc_param_str": "dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt", "vcode": str(int(time.time() * 1000))},
            "headers": {**mac_headers, "Referer": "https://drive.quark.cn/"},
            "method": "POST"
        }
    ]

    for v in variants:
        test_quark_api(FID, v["url"], v["params"], v["headers"], v["label"], method=v.get("method", "POST"))
