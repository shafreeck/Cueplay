'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

export function UserProfile({ userId }: { userId: string }) {
    const { t } = useTranslation('common');
    const [open, setOpen] = useState(false);
    const [displayName, setDisplayName] = useState('');

    useEffect(() => {
        if (open) {
            // Load settings when dialog opens
            const storedName = localStorage.getItem('cueplay_nickname') || '';
            setDisplayName(storedName);

            // Onboarding: If no name and userId is available, open dialog (handled by parent/effect logic)
        }
    }, [open, userId]);

    // Initial check for onboarding
    useEffect(() => {
        const storedName = localStorage.getItem('cueplay_nickname');
        if (userId && !storedName) {
            setOpen(true);
        }
    }, [userId]);


    const handleSave = () => {
        localStorage.setItem('cueplay_nickname', displayName);
        setOpen(false);
        // Optional: Trigger a reload or context update if needed, but currently app reads from localStorage on mount/interaction
        // Since we are inside the component that *might* be using it, we might need to notify the parent or
        // if the parent reads from localStorage, it might need a re-read.
        // However, looking at the previous code, it was purely local state + localStorage side effect.
        // The header component reads it, but `user-profile` is likely IN the header.
        // Let's reload to be safe and ensure name propagates, or simple state update if it's just for this session.
        // The original code `saveNickname` in `room/page.tsx` also updated localStorage.
        // Wait, `room/page.tsx` had its own Settings Popover with `saveNickname`.
        // This `UserProfile` component seems to be the avatar button.
        // If I change it here, does `room/page.tsx` know?
        // `room/page.tsx` reads `localStorage.getItem('cueplay_nickname')` on mount.
        // It doesn't listen to storage events.
        // But for better UX, we might not want to reload entire page.
        // Since the user asked for UI optimization on "Profile Setting input",
        // likely they want the input itself to be confirmed.
        window.location.reload();
    };

    // Generate Avatar Color
    const hash = userId.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colors = [
        'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
        'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
        'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
        'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
    ];
    const colorClass = colors[Math.abs(hash) % colors.length] || 'bg-gray-500';
    const initial = (displayName || userId || '?').slice(0, 1).toUpperCase();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden border border-border/50 hover:opacity-80 transition-opacity">
                    <div className={`h-full w-full flex items-center justify-center text-white font-bold ${colorClass}`}>
                        {initial}
                    </div>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('profile_settings')}</DialogTitle>
                    <DialogDescription>
                        {t('set_identity_pref')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="display-name" className="text-right">
                            {t('display_name_label')}
                        </Label>
                        <Input
                            id="display-name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={t('display_name_placeholder')}
                            className="col-span-3"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-muted-foreground">
                            {t('user_id_label')}
                        </Label>
                        <div className="col-span-3 text-xs font-mono text-muted-foreground bg-muted p-2 rounded">
                            {userId}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>{t('save_changes')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
