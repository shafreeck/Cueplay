import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { API_BASE } from "@/api/config"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getProxiedAvatarUrl(url?: string) {
    if (!url) return undefined;
    if (!url.startsWith('http')) return url;
    return `${API_BASE}/drive/avatar/proxy?url=${encodeURIComponent(url)}`;
}
