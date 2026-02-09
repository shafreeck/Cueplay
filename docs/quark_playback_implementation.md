
# Quark Playback Implementation Logic

This document outlines the current logic flow for resolving media from Quark Drive and explains the potential causes for the persistent 401 (31001) errors.

## 1. Resolution Flow

### A. Frontend Trigger (`room/page.tsx`)
1. **On Entry**: If the room has a `currentFileId`, the app automatically calls `resolveAndPlay()`.
2. **On Click**: When a user clicks a file in the playlist, it calls `resolveAndPlay()`.
3. **Resolution**: Calls `ApiClient.resolveVideo(fileId, roomId, ...)` which makes a POST request to the backend `/playback/resolve`.

### B. Backend Logic (`services/api/src/playback/controller.ts`)
1. **Cookie Discovery**: The backend checks for a Quark cookie in this order:
   - `Room` table (specific to this room)
   - `User` table (associated with the requester)
   - `GlobalConfig` table (The one set in Admin Settings -> Global Quark Cookie)
2. **Provider Call**: Pass the cookie and `fileId` to `QuarkProvider`.
3. **Persistence**: If Quark returns new cookies (via `Set-Cookie` or internal headers), the backend attempts to save them back to the database to keep the session alive.

### C. Provider Logic (`packages/playback-core/src/provider/quark.ts`)
1. **Metadata Probe**: First, it calls `file/get` to check if the file exists and if it's audio or video.
2. **Download/Play Call**: 
   - For Video: Calls `video/play`.
   - For Audio: Calls `download/url`.
3. **Header Strategy (Multi-Origin)**: To bypass CORS restrictions, it tries multiple header combinations:
   - `Origin: https://drive-pc.quark.cn`
   - `Origin: https://pan.quark.cn`
   - **No Origin**

## 2. Why 401 (31001: require login [guest])?

The 401 error means Quark does not see a valid session. This happens even if a cookie is provided if:

1. **Incorrect Cookie Format**: The cookie string might be missing essential tokens. We currently pass the raw string.
2. **Cookie Expiry**: The cookie stored in the database is no longer valid.
3. **IP/UA Lockdown**: Quark may tie a session to a specific IP or User-Agent. Since the backend (Server) is making the request, its IP differs from your Browser IP. 
   - *Current UA*: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`
4. **Session Splitting**: If you are logged in on your browser, and then use that same cookie on the server, Quark might invalidate one of them.

## 3. Potential Fixes / Information Needed

1. **Verification**: Can you confirm if you have set a **Global Quark Cookie** in the Admin panel or a **Room Cookie** in the Room Settings?
2. **Cookie Source**: How did you obtain the cookie? (e.g., from `pan.quark.cn` or `drive-pc.quark.cn`?).
3. **Debug Log V5**: I added specific logs. If the backend is running, it will print `[Quark Debug V5] Fetch failed for...`. Seeing the full response body there would confirm if *any* of the origins are even being considered valid.

## 4. Immediate Plan
I will verify if the backend is correctly retrieving the cookie from the DB. If the DB is empty, the 401 is expected.
