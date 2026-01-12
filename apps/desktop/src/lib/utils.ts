import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { API_BASE } from "@/api/config"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getProxiedAvatarUrl(url?: string) {
    if (!url) return undefined;

    let targetUrl = url;
    // Handle protocol-relative URLs (e.g. //img.quark.cn/...)
    if (targetUrl.startsWith('//')) {
        targetUrl = 'https:' + targetUrl;
    }

    if (!targetUrl.startsWith('http')) return targetUrl;
    return `${API_BASE}/drive/avatar/proxy?url=${encodeURIComponent(targetUrl)}`;
}
