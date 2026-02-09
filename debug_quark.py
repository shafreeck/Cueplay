import requests
import json
import argparse
import sys

def debug_quark_audio(cookie, file_id):
    """
    Debugs the Quark Audio Download API flow.
    """
    print(f"[*] Debugging Quark Audio for File ID: {file_id}")
    
    # 1. Download API Endpoint
    download_url_api = 'https://drive-pc.quark.cn/1/clouddrive/file/download'
    
    # 2. Prepare Headers
    headers = {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://drive-pc.quark.cn/static/pc/index.html',
        'Origin': 'https://drive-pc.quark.cn',
        'Content-Type': 'application/json'
    }
    
    # 3. Prepare Payload
    payload = {
        'fids': [file_id],
        'cn_sw': 'open',
        'ab_tag': '_'  # Optional but observed in traces
    }
    
    # 4. Make Request
    print(f"[*] POST {download_url_api}")
    try:
        session = requests.Session()
        resp = session.post(download_url_api, headers=headers, json=payload, allow_redirects=False)
        
        print(f"[*] Status Code: {resp.status_code}")
        
        # 5. Check Response
        if resp.status_code != 200:
            print(f"[!] Error: API returned {resp.status_code}")
            print(resp.text)
            return

        data = resp.json()
        if data.get('code') != 0 and data.get('code') != 200:
             print(f"[!] API Error: {json.dumps(data, indent=2)}")
             return
             
        # 6. Extract Download URL
        file_list = data.get('data', [])
        if not file_list:
            print("[!] No file data returned.")
            return
            
        file_info = file_list[0]
        download_url = file_info.get('download_url')
        print(f"[*] Download URL: {download_url}")
        
        # 7. Dump Cookies (This is what we need to verify for Node.js implementation)
        print("\n[*] Cookies received (Set-Cookie):")
        new_cookies = session.cookies.get_dict()
        for k, v in new_cookies.items():
            print(f"    {k}: {v}")
            
        print("\n[*] Detailed Set-Cookie Headers (Raw):")
        # Requests merges them, but we can look at history if redirected, 
        # but here we didn't redirect.
        # Let's show all cookies combined
        final_cookie_str = "; ".join([f"{k}={v}" for k, v in new_cookies.items()])
        print(f"    Merged string for next request: {final_cookie_str}")

        # 8. Verify Access (HEAD request)
        print(f"\n[*] Verifying access to Download URL...")
        # Merge initial cookie with new cookies
        # In a real app, we merge carefully. Here requests session does it for us.
        # But we need to make sure we send the INITIAL cookie + NEW cookies.
        # Requests session automatically handles cookies from previous responses.
        # We just need to make sure the initial 'cookie' arg is also included if it wasn't set in session.
        
        # Add initial cookies to session if not present (simple parse)
        # simplistic parsing
        if cookie:
            for item in cookie.split(';'):
                if '=' in item:
                    k, v = item.strip().split('=', 1)
                    if k not in session.cookies:
                        session.cookies.set(k, v)

        dl_resp = session.head(download_url, headers={
            'User-Agent': headers['User-Agent'],
            'Referer': headers['Referer'] # Essential for some CDNs
        }, allow_redirects=True)
        
        print(f"[*] HEAD Status: {dl_resp.status_code}")
        print(f"[*] Content-Type: {dl_resp.headers.get('Content-Type')}")
        print(f"[*] Content-Length: {dl_resp.headers.get('Content-Length')}")
        
        if dl_resp.status_code in [200, 206, 302]:
            print("[+] success: Audio file is accessible!")
        else:
            print("[-] failure: Could not access audio file.")
            
    except Exception as e:
        print(f"[!] Exception: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Debug Quark Audio API')
    parser.add_argument('--cookie', required=True, help='Your Quark Drive Cookie')
    parser.add_argument('--fid', required=True, help='The File ID of the audio file')
    
    args = parser.parse_args()
    debug_quark_audio(args.cookie, args.fid)
