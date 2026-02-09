#!/bin/bash

BASE_URL="https://drive-pc.quark.cn/1/clouddrive/file/download?bi=999&ch=pcquark%40clouddrive_share2&device_model=Mac+mini&fr=mac&la=zh-CN&nt=99&nw=0&pf=6001&pr=ucpro&sys=darwin&uc_param_str=dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt&ve=6.4.0.728&where_entry=task_init"
# Valid mt and ut from user's curl
MT="P1gAPg5cbocxiNhNAktRHgQopMq7OpGcywGDdPiRSReusxIh_Y6xhZGtxAf72GuCvvE679hLmiaWKckvqbpUeb6I"
UT="NxR43yLvnXs71IEVCqgxtFYecJ8uS05ohwuP4HFLnNZ%2Fzg%3D%3D"

UUS="NxQy9X23QZUbTpmrmJnx3TUynz2pvEAwsvClD6QfXbR/3tBYAKiWR9wnnhio95z80HKB9fXm1/p55Z+71fzOVJ5K5n1RtKdwGzTK8QZUR6Dq3Q=="
KUUS="NxQy9X23QZUbTpmrmJnx3TUyT4c01nIQ0xfhpeC5G6bThys0Iw9S9nnWClbs/U9XQQTeljL7CLmTPW85JfMYcgJr3h8GzZY/2OU7VxaHdwLJSA=="
COOKIE="__uus=$UUS; __kuus=$KUUS"

KPS="NxR/DbHcJ1xA4KX07QAmK+aPRaqUNIn1fXutykpEFv7LzORm2cTmjJRD6el+aI+lSRqhn4LIo4Jys2xc85braEuzl0YI3oel+GWBWHjG9ZMgTA=="
SIGN="NxTZqd9r8ynwC+l20lEk+azDnbHVhv7itBG8ZV2LfcdUTuYC1tFCWp+9LbUq8lwoz14="
VCODE="1770624659600"

echo "--- Test 1: Download API WITHOUT mt/ut ---"
curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}" \
-H "Cookie: $COOKIE" \
-H "x-u-kps-wg: $KPS" \
-H "x-u-sign-wg: $SIGN" \
-H "x-u-vcode: $VCODE" \
-H "Content-Type: application/json" \
-d '{"fids":["5121fda9d16646fabcf4cf4b0ea3916b"],"cn_sw":"open","ab_tag":"_"}'
echo ""

echo "--- Test 2: Download API WITH mt/ut (Sanity) ---"
curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}&mt=$MT&ut=$UT" \
-H "Cookie: $COOKIE" \
-H "x-u-kps-wg: $KPS" \
-H "x-u-sign-wg: $SIGN" \
-H "x-u-vcode: $VCODE" \
-H "Content-Type: application/json" \
-d '{"fids":["5121fda9d16646fabcf4cf4b0ea3916b"],"cn_sw":"open","ab_tag":"_"}'
echo ""

# Use a real URL from verify_curls.sh for Test 3
CDN_URL="https://dl-pc-zb.pds.quark.cn/MHBRBea6/4444646311/6825ac20d9f8fe0f446a421b85d37714d271a181/6825ac200d1145c2f6a34e7a848ed525d77314fc?Expires=1770646283&OSSAccessKeyId=LTAI5tJJpWQEfrcKHnd1LqsZ&Signature=KAKGY9uSXLIfVFcACY9dW2SYqLA%3D&x-oss-traffic-limit=503316480"

echo "--- Test 3: CDN Request WITHOUT x-u headers ---"
curl -I -s -o /dev/null -w "%{http_code}" -X GET "$CDN_URL" \
-H "Cookie: $COOKIE" \
-H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.4.0.728"
echo ""

echo "--- Test 4: CDN Request WITH x-u headers (Sanity) ---"
curl -I -s -o /dev/null -w "%{http_code}" -X GET "$CDN_URL" \
-H "Cookie: $COOKIE" \
-H "x-u-kps-wg: $KPS" \
-H "x-u-sign-wg: $SIGN" \
-H "x-u-vcode: $VCODE" \
-H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.4.0.728"
echo ""
