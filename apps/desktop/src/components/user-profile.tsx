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

    // Load saved name on mount and handle onboarding
    useEffect(() => {
        const storedName = localStorage.getItem('cueplay_nickname');
        if (storedName) {
            setDisplayName(storedName);
        } else if (userId) {
            // Initial check for onboarding if no name set
            setOpen(true);
        }
    }, [userId]);

    const handleSave = () => {
        localStorage.setItem('cueplay_nickname', displayName);
        setOpen(false);
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

    // Display Name Strategy:
    // If we have a display name, show it. Otherwise show '?' (Server/Client match).
    // User IDs start with 'U' so they are not useful for initials anyway.
    const initial = (displayName || '?').slice(0, 1).toUpperCase();

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
                    {/* Reset Identity Section */}
                    <div className="border-t pt-4 mt-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                                if (window.confirm(t('confirm_reset_identity') || 'Are you sure you want to reset your identity? This will disconnect you from current sessions.')) {
                                    localStorage.removeItem('cueplay_userid');
                                    window.location.reload();
                                }
                            }}
                        >
                            {t('reset_identity') || 'Reset Identity'}
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>{t('save_changes')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
