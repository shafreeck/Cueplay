'use client';

import { cn } from '@/lib/utils';
import { Cast, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // Assuming we can use hooks here, otherwise pass strings

interface MemberItemProps {
    member: any; // Using any as strict type is not available yet
    currentUserId: string | null;
    controllerId: string | null;
    ownerId: string;
    videoDuration: number;
    controllerProgress?: number;
}

export function MemberItem({
    member: m,
    currentUserId,
    controllerId,
    ownerId,
    videoDuration,
    controllerProgress = 0
}: MemberItemProps) {
    const { t } = useTranslation('common');

    if (!m || !m.userId) return null;

    // Generate consistent color from userId
    const hash = m.userId.split('').reduce((acc: number, char: string) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colors = [
        'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
        'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
        'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
        'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
    ];
    const colorClass = colors[Math.abs(hash) % colors.length];
    const displayName = m.name || m.userId;
    const initial = displayName.slice(0, 1).toUpperCase();

    // Sync Calculation
    const myTime = m.currentProgress || 0;
    const diff = Math.abs(myTime - controllerProgress);

    let progressColor = 'bg-emerald-500/80';
    if (diff > 15) progressColor = 'bg-red-900/90';
    else if (diff > 5) progressColor = 'bg-red-600/90';
    else if (diff > 2) progressColor = 'bg-yellow-500/90';

    // Progress Percentage
    const duration = videoDuration || 1;
    const percent = Math.min(100, Math.max(0, (myTime / duration) * 100));

    return (
        <div className="relative flex items-center justify-between p-2 rounded-md border bg-card/50 overflow-hidden mb-2">
            <div className="flex items-center gap-3 relative z-10">
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm bg-opacity-90", colorClass)}>
                    {initial}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium leading-none">
                            {m.userId === currentUserId ? `${displayName} (${t('you')})` : displayName}
                        </span>
                        <div
                            className={cn("h-1.5 w-1.5 rounded-full", m.isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-zinc-700')}
                            title={m.isOnline ? t('online') : t('offline')}
                        />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        {m.name && <span className="text-[10px] text-muted-foreground font-mono leading-none opacity-70">{m.userId}</span>}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 relative z-10">
                {m.userId === controllerId && <span title="Controlling"><Cast className="h-4 w-4 text-primary animate-pulse" /></span>}
                {m.userId === ownerId && <span title="Owner"><Crown className="h-3 w-3 text-yellow-500" /></span>}
            </div>

            {/* Progress Bar Background */}
            {m.isOnline && m.currentProgress !== undefined && (
                <div
                    className={cn("absolute bottom-0 left-0 h-0.5 transition-all duration-1000 ease-linear", progressColor)}
                    style={{ width: `${percent}%` }}
                />
            )}
        </div>
    );
}
