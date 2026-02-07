# Quark Drive Playback Implementation Guide

This document summarizes the technical requirements and implementation logic for robust audio and video playback from Quark Drive, based on verified PC client fingerprints and API behaviors.

## 1. Request Fingerprint (Headers)

To avoid `401 Unauthorized` and `403 Forbidden` errors, all API requests and stream playback must use the official PC client fingerprint.

- **User-Agent**: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 QuarkPC/6.3.0.699 quark-cloud-drive/2.5.40`
- **Referer**: `https://drive-pc.quark.cn/static/pc/index.html` (Use this for all resolution and playback requests).
- **Origin**: `https://drive-pc.quark.cn`

## 2. Audio Playback Implementation

Audio files (MP3, FLAC, etc.) do **not** work with the standard `/v2/play` API. They must use the download API.

### Resolution Step
- **Endpoint**: `https://drive-pc.quark.cn/1/clouddrive/file/download`
- **Method**: `POST`
- **Query Parameters**:
  - `pr=ucpro`, `fr=mac` (or `pc`), `ud=[USER_DEVICE_ID]`, `ve=6.3.0.699`
- **JSON Body**:
  ```json
  {
    "fids": ["FILE_ID"],
    "cn_sw": "open",
    "ab_tag": "_"
  }
  ```
  > [!IMPORTANT]
  > `cn_sw` and `ab_tag` are mandatory for some files to resolve successfully.
- **Response Parsing**: Access the URL via `data.data[0].download_url`.

## 3. Video Playback Implementation

### Resolution Step
- **Endpoint**: `https://drive-pc.quark.cn/1/clouddrive/file/v2/play?pr=ucpro&fr=pc`
- **Method**: `POST`
- **JSON Body**: `{"fid": "FILE_ID", "share_id": "OPTIONAL"}`
- **Fallback Logic**:
  - If the response returns code `21005` ("not video") or HTTP `400`, the file is likely an audio file misidentified as video or a raw file. **Immediately retry using the Audio/Download path described above.**
- **Handling Multi-Resolutions**:
  - Parse the `video_list` array.
  - If the primary `url` is missing, find a stream in `video_list` where `video_info.audio.channels === 2`.

## 4. Playback and Cookie Management

- **Cookie Cleaning**: When passing cookies to the player (CDN), only include `__kuus` and `__uus`. Other cookies may interfere with CDN caching or validation.
- **Set-Cookie Capturing**: The resolution API (`v2/play`) often returns a `set-cookie: Video-Auth=...`. This cookie **must** be captured and appended to the playback request headers for the stream to play without a 401 error.
- **Range Support**: The proxy/backend must ensure `Accept-Ranges: bytes` is present in the response to support seeking in large files.

## 5. FLAC & WebKit Optimization

Playback of FLAC (`audio/x-flac`, `.flac`) files on macOS/iOS (WebKit) is notoriously unstable in standard `<audio>` elements.

### Optimization Strategy
1.  **Tag Switching**: Force the frontend to render FLAC files using the **`<video>`** HTML element instead of `<audio>`.
    - WebKit's video pipeline handles FLAC containers more robustly than the audio pipeline.
    - This fixes "Operation not supported" (MediaError 4) and seeking issues.
2.  **MIME Type Normalization**: Ensure the proxy returns `Content-Type: audio/flac` or `audio/x-flac`.
3.  **Proxy Headers**: The local proxy must strip strictly checked headers (like `Content-Security-Policy`) that might block the "video" element from loading an audio source.
