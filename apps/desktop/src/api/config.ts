/**
 * 客户端配置中心
 * 
 * 我们区分两个服务：
 * 1. API_BASE: 远程核心服务（Fastify），负责业务逻辑和 Cookie 解析
 * 2. PROXY_BASE: 本地客户端服务（Next.js API Routes），负责流媒体代理，通常在 3001 端口
 */

const isProd = process.env.NODE_ENV === 'production';
// const isProd = true;

// 后端 API 地址
export const API_BASE = isProd
    //? 'https://cueplay-api.zeabur.app'
    ? 'https://cueplay.preview.huawei-zeabur.cn'
    : 'http://localhost:3000';

// WebSocket 地址
export const WS_BASE = isProd
    //? 'wss://cueplay-api.zeabur.app'
    ? 'wss://cueplay.preview.huawei-zeabur.cn'
    : 'ws://localhost:3000';

// 客户端本地代理地址 (始终指向客户端自己的 HTTP 服务)
// 即使在生产环境，客户端代理通常也是运行在本地或相对于 UI 的路径
export const PROXY_BASE = isProd
    ? '' // 生产环境下通常使用相对路径，或者根据你的客户端架构定义
    : 'http://localhost:3001';

// Dynamic Proxy Base for Tauri
let dynamicProxyPort: number | null = null;
let dynamicProxyBasePromise: Promise<string> | null = null;

export const getProxyBase = async (): Promise<string> => {
    // 1. If we are NOT in a Tauri environment, use the configured HTTP proxy.
    // In Tauri v2, __TAURI__ is not global. check __TAURI_INTERNALS__ or just proceed to try import.
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (!isTauri) {
        console.log("[Config] Not in Tauri environment, using PROXY_BASE");
        return PROXY_BASE;
    }

    // 2. We are in Tauri (Dev or Prod). Prefer the Rust-side local proxy.
    if (dynamicProxyPort) {
        return `http://127.0.0.1:${dynamicProxyPort}`;
    }

    if (!dynamicProxyBasePromise) {
        dynamicProxyBasePromise = (async () => {
            try {
                // Dynamic import to avoid issues in non-Tauri envs if any
                const { invoke } = await import('@tauri-apps/api/core');
                const port = await invoke<number>('get_proxy_port');
                if (port > 0) {
                    dynamicProxyPort = port;
                    console.log(`[Config] Using Rust Proxy on port: ${port}`);
                    return `http://127.0.0.1:${port}`;
                } else {
                    console.warn("[Config] Rust Proxy returned port 0.");
                }
            } catch (e) {
                console.error("[Config] Failed to get Rust proxy port:", e);
            }
            return "";
        })();
    }

    return dynamicProxyBasePromise;
}
