#!/bin/bash

COOKIES='__uus=NxQy9X23QZUbTpmrmJnx3TUycLpVaexkusJMqP/rBzQxL23BrkB1C6EnuOVA5PPqCOo9OKB4BUDwitSVYq5IcFwLaHH53ib1Hljb23a044/tOg==; __kuus=NxQy9X23QZUbTpmrmJnx3TUyS/jylQ6oaA0o6Kgq9M35oRRObid2+30fPrqAeH5LW5p0lDAqZMMJIVjW59ocIm5K0N+WoMI524AZr7Fpilk3OA=='
FID='c7271d773e6245e4ab446a1593581c14'
VCODE='1770462732012'
KPS='NxQket6jCywZUfDoszEg4tX3wZAMqrAKCZlKaxP1YYHMI8UoExn/tZWKb//iy9GbIFMfjNYUAvMiBA3zydcu4TTfbLIqn0F4fNOmGQtrBgjpLg=='
SIGN='NxThLnosm2TC6Xb/dRv1r0pQKwu5HnH3r7qtdOfaPd3kfQv5vgA3+vb3vmkJ+KnqBiw='

echo "--- Phase 1: Obtaining Download URL ---"
RESP=$(curl -s 'https://drive-pc.quark.cn/1/clouddrive/file/download?bi=999&ch=pcquark%40clouddrive_share2&fr=mac&ve=6.3.0.699' \
-H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699 quark-cloud-drive/2.5.40" \
-H "Cookie: $COOKIES" \
-H "Content-Type: application/json" \
-H "x-u-kps-wg: $KPS" \
-H "x-u-sign-wg: $SIGN" \
-H "x-u-vcode: $VCODE" \
-X POST -d "{\"fids\":[\"$FID\"],\"cn_sw\":\"open\",\"ab_tag\":\"_\"}")

echo "Response: $RESP"
URL=$(echo $RESP | sed -n 's/.*"download_url":"\([^"]*\)".*/\1/p')

if [ -z "$URL" ]; then
    echo "Failed to get download URL"
    exit 1
fi

echo "--- Phase 2: Testing CDN Access ---"
# Replace \/ with /
URL=$(echo $URL | sed 's/\\//g')

curl -v "$URL" \
-H "Referer: https://drive-pc.quark.cn/" \
-H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699" \
-H "Accept: */*" \
-H "Accept-Language: zh-CN,zh;q=0.9" \
-H "Range: bytes=0-1024" \
-H "Cookie: $COOKIES" \
-H "Accept-Encoding: identity" \
-H "x-u-vcode: $VCODE"
