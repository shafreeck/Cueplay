#!/bin/bash

echo "--- Testing Phase 1: Download API ---"
curl -s -X POST 'https://drive-pc.quark.cn/1/clouddrive/file/download?bi=999&ch=pcquark%40clouddrive_share2&device_model=Mac+mini&fr=mac&la=zh-CN&mt=P1gAPg5cbocxiNhNAktRHgQopMq7OpGcywGDdPiRSReusxIh_Y6xhZGtxAf72GuCvvE679hLmiaWKckvqbpUeb6I&nt=99&nw=0&pf=6001&pr=ucpro&sys=darwin&uc_param_str=dsdnfrpfbivesscpgimibtbmnijblauputogpintnwktprchmt&ut=NxR43yLvnXs71IEVCqgxtFYecJ8uS05ohwuP4HFLnNZ%2Fzg%3D%3D&ve=6.4.0.728&where_entry=task_init' \
-H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.4.0.728 quark-cloud-drive/2.5.40' \
-H 'Accept: application/json, text/plain, */*' \
-H 'Content-Type: application/json' \
-H 'x-u-kps-wg: NxR/DbHcJ1xA4KX07QAmK+aPRaqUNIn1fXutykpEFv7LzORm2cTmjJRD6el+aI+lSRqhn4LIo4Jys2xc85braEuzl0YI3oel+GWBWHjG9ZMgTA==' \
-H 'x-u-sign-wg: NxTZqd9r8ynwC+l20lEk+azDnbHVhv7itBG8ZV2LfcdUTuYC1tFCWp+9LbUq8lwoz14=' \
-H 'x-u-vcode: 1770624659600' \
-H 'Cookie: __uus=NxQy9X23QZUbTpmrmJnx3TUynz2pvEAwsvClD6QfXbR/3tBYAKiWR9wnnhio95z80HKB9fXm1/p55Z+71fzOVJ5K5n1RtKdwGzTK8QZUR6Dq3Q==; __kuus=NxQy9X23QZUbTpmrmJnx3TUyT4c01nIQ0xfhpeC5G6bThys0Iw9S9nnWClbs/U9XQQTeljL7CLmTPW85JfMYcgJr3h8GzZY/2OU7VxaHdwLJSA==' \
-d '{"fids":["5121fda9d16646fabcf4cf4b0ea3916b"],"cn_sw":"open","ab_tag":"_"}' > /tmp/phase1_res.json

STATUS_P1=$(jq -r '.status' /tmp/phase1_res.json)
CODE_P1=$(jq -r '.code' /tmp/phase1_res.json)

if [ "$STATUS_P1" == "200" ] || [ "$CODE_P1" == "0" ]; then
    echo "[PHASE 1] SUCCESS: Download URL obtained."
    DOWNLOAD_URL=$(jq -r '.data[0].download_url' /tmp/phase1_res.json)
    echo "URL: ${DOWNLOAD_URL:0:100}..."
else
    echo "[PHASE 1] FAILED"
    cat /tmp/phase1_res.json
fi

echo -e "\n--- Testing Phase 2: CDN Request ---"
# Note: Using the URL from the user's second curl directly to verify it works as defined.
curl -I -s -X GET 'https://dl-pc-zb.pds.quark.cn/MHBRBea6/4444646311/6825ac20d9f8fe0f446a421b85d37714d271a181/6825ac200d1145c2f6a34e7a848ed525d77314fc?Expires=1770646283&OSSAccessKeyId=LTAI5tJJpWQEfrcKHnd1LqsZ&Signature=KAKGY9uSXLIfVFcACY9dW2SYqLA%3D&x-oss-traffic-limit=503316480&response-content-disposition=attachment%3B%20filename%3D%25E7%2588%25B1%25E4%25BD%25A0%25E4%25B8%2580%25E4%25B8%2587%25E5%25B9%25B4%2520-%2520%25E4%25BC%258D%25E4%25BD%25B0.flac%3Bfilename%2A%3Dutf-8%27%27%25E7%2588%25B1%25E4%25BD%25A0%25E4%25B8%2580%25E4%25B8%2587%25E5%25B9%25B4%2520-%2520%25E4%25BC%258D%25E4%25BD%25B0.flac&callback-var=eyJ4OmF1IjoiMTc3MDY0NjI4My0yNjAyNDItMjE2MDAtNjhmMiIsIng6b3JrIjoiWjE2NDg0WGRnMTQxOGlpWDE4MThJNUFzY0hPN21TQnJSZnRVR0sxRU4iLCJ4OnVkIjoiMjQtNy0yLTItMi1OLTQtTi0xLTE2LTAtTi1OLU4tTiIsIng6c3AiOiIxMDAiLCJ4OnRva2VuIjoiNC01MjMwNWI0NjY0YzU1ZWYyZGMyMGYyMjNiYjBkYjRjOC05LTEtNTEyMDAtYzkzNGM3OWZiMjNkNDNmNThkNGI5Y2VhYWU1ZjM0NzQtMC0wLTAtMC01ZjViY2ExMWZhMGU5Y2U3OGY3NzE2YzdhZDFlMzg2MCIsIng6dHRsIjoiMjE2MDAifQ%3D%3D&abt=9_1__&dfi=193&callback=eyJjYWxsYmFja0JvZHlUeXBlIjoiYXBwbGljYXRpb24vanNvbiIsImNhbGxiYWNrU3RhZ2UiOiJiZWZvcmUtZXhlY3V0ZSIsImNhbGxiYWNrRmFpbHVyZUFjdGlvbiI6Imlnbm9yZSIsImNhbGxiYWNrVXJsIjoiaHR0cHM6Ly9kcml2ZS1hdXRoLnF1YXJrLmNuL291dGVyL29zcy9jaGVja3BsYXkiLCJjYWxsYmFja0JvZHkiOiJ7XCJob3N0XCI6JHtodHRwSGVhZGVyLmhvc3R9LFwic2l6ZVwiOiR7c2l6ZX0sXCJyYW5nZVwiOiR7aHR0cEhlYWRlci5yYW5nZX0sXCJyZWZlcmVyXCI6JHtodHRwSGVhZGVyLnJlZmVyZXJ9LFwiY29va2llXCI6JHtodHRwSGVhZGVyLmNvb2tpZX0sXCJtZXRob2RcIjoke2h0dHBIZWFkZXIubWV0aG9kfSxcInVscnBcIjoke2h0dHBIZWFkZXIueC11bHJwfSxcImlwXCI6JHtjbGllbnRJcH0sXCJwb3J0XCI6JHtjbGllbnRQb3J0fSxcIm9ya1wiOiR7eDpvcmt9LFwib2JqZWN0XCI6JHtvYmplY3R9LFwic3BcIjoke3g6c3B9LFwidWRcIjoke3g6dWR9LFwidG9rZW5cIjoke3g6dG9rZW59LFwiYXVcIjoke3g6YXV9LFwidHRsXCI6JHt4OnR0bH0sXCJkdF9zcFwiOiR7eDpkdF9zcH0sXCJoc3BcIjoke3g6aHNwfSxcImNsaWVudF90b2tlblwiOiR7cXVlcnlTdHJpbmcuY2xpZW50X3Rva2VufX0ifQ%3D%3D&ud=24-7-2-2-2-N-4-N-1-16-0-N-N-N-N' \
-H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.4.0.728 quark-cloud-drive/2.5.40' \
-H 'range: bytes=0-10' \
-H 'X-U-KPS-WG: NxR/DbHcJ1xA4KX07QAmK+aPRaqUNIn1fXutykpEFv7LzORm2cTmjJRD6el+aI+lSRqhn4LIo4Jys2xc85braEuzl0YI3oel+GWBWHjG9ZMgTA==' \
-H 'X-U-SIGN-WG: NxTZqd9r8ynwC+l20lEk+azDnbHVhv7itBG8ZV2LfcdUTuYC1tFCWp+9LbUq8lwoz14=' \
-H 'X-U-VCODE: 1770624659600' \
-H 'Cookie: __uus=NxQy9X23QZUbTpmrmJnx3TUynz2pvEAwsvClD6QfXbR/3tBYAKiWR9wnnhio95z80HKB9fXm1/p55Z+71fzOVJ5K5n1RtKdwGzTK8QZUR6Dq3Q==; __kuus=NxQy9X23QZUbTpmrmJnx3TUyT4c01nIQ0xfhpeC5G6bThys0Iw9S9nnWClbs/U9XQQTeljL7CLmTPW85JfMYcgJr3h8GzZY/2OU7VxaHdwLJSA==' > /tmp/phase2_headers.txt

HTTP_CODE=$(grep "HTTP/" /tmp/phase2_headers.txt | tail -n 1 | awk '{print $2}')
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "206" ]; then
    echo "[PHASE 2] SUCCESS: CDN Access authorized (Status: $HTTP_CODE)."
else
    echo "[PHASE 2] FAILED: Status $HTTP_CODE"
    cat /tmp/phase2_headers.txt
fi
