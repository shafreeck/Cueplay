import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface DanmakuOverlayHandle {
    add: (text: string) => void;
    clear: () => void;
}

interface DanmakuItem {
    id: string;
    text: string;
    top: number; // Percentage
    color?: string;
    createdAt: number;
    duration: number; // Stored duration
}

interface DanmakuOverlayProps {
    className?: string;
    trackCount?: number;
}

export const DanmakuOverlay = forwardRef<DanmakuOverlayHandle, DanmakuOverlayProps>(
    ({ className, trackCount = 10 }, ref) => {
        const [items, setItems] = useState<DanmakuItem[]>([]);

        // Cleanup old items
        useEffect(() => {
            const interval = setInterval(() => {
                const now = Date.now();
                // Remove items older than 12s
                setItems(prev => prev.filter(item => now - item.createdAt < 12000));
            }, 5000);
            return () => clearInterval(interval);
        }, []);

        const add = useCallback((text: string) => {
            console.log('[Danmaku] Adding:', text);
            const now = Date.now();
            const trackIndex = Math.floor(Math.random() * trackCount);
            const top = (trackIndex / trackCount) * 100;
            const duration = 7 + Math.random() * 2; // Calculate once

            const newItem: DanmakuItem = {
                id: Math.random().toString(36).substr(2, 9),
                text,
                top,
                createdAt: now,
                color: '#ffffff',
                duration
            };

            setItems(prev => [...prev, newItem]);
        }, [trackCount]);

        const clear = useCallback(() => {
            setItems([]);
        }, []);

        useImperativeHandle(ref, () => ({
            add,
            clear
        }));

        return (
            <div className={cn("absolute inset-0 pointer-events-none overflow-hidden select-none z-20", className)}>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes danmaku-move {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(calc(-100vw - 100%)); }
                    }
                `}} />
                {items.map(item => (
                    <DanmakuItemRenderer key={item.id} item={item} />
                ))}
            </div>
        );
    }
);

DanmakuOverlay.displayName = 'DanmakuOverlay';

const DanmakuItemRenderer = React.memo(({ item }: { item: DanmakuItem }) => {
    return (
        <div
            style={{
                position: 'absolute',
                top: `${item.top}%`,
                left: '100%',
                whiteSpace: 'nowrap',
                color: item.color,
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                fontSize: '1.125rem',
                fontWeight: 600,
                willChange: 'transform',
                animation: `danmaku-move ${item.duration}s linear forwards`,
            }}
        >
            {item.text}
        </div>
    );
});
