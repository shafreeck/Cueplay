/**
 * 客户端配置中心
 * 
 * 我们区分两个服务：
 * 1. API_BASE: 远程核心服务（Fastify），负责业务逻辑和 Cookie 解析
 * 2. PROXY_BASE: 本地客户端服务（Next.js API Routes），负责流媒体代理，通常在 3001 端口
 */

const isProd = process.env.NODE_ENV === 'production';

// 后端 API 地址
export const API_BASE = isProd
    ? 'https://api.cueplay.art'
    : 'http://localhost:3000';

// WebSocket 地址
export const WS_BASE = isProd
    ? 'wss://api.cueplay.art'
    : 'ws://localhost:3000';

// 客户端本地代理地址 (始终指向客户端自己的 HTTP 服务)
// 即使在生产环境，客户端代理通常也是运行在本地或相对于 UI 的路径
export const PROXY_BASE = isProd
    ? '' // 生产环境下通常使用相对路径，或者根据你的客户端架构定义
    : 'http://localhost:3001';
