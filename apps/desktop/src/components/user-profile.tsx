'use client';

import { useEffect, useState, useRef } from 'react';
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

export function UserProfile({ userId, autoOpen = false }: { userId: string; autoOpen?: boolean }) {
    const { t } = useTranslation('common');
    const [open, setOpen] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [isNewUser, setIsNewUser] = useState(false);
    const hasAutoOpened = useRef(false);

    useEffect(() => {
        if (open) {
            // Load settings when dialog opens
            const storedName = localStorage.getItem('cueplay_nickname') || '';
            setDisplayName(storedName);
            setIsNewUser(!storedName);
        }
    }, [open]);

    // Load saved name on mount
    useEffect(() => {
        const storedName = localStorage.getItem('cueplay_nickname');
        if (storedName) {
            setDisplayName(storedName);
        }
    }, []);

    // Handle onboarding via prop
    useEffect(() => {
        if (autoOpen && userId && !hasAutoOpened.current) {
            const storedName = localStorage.getItem('cueplay_nickname');
            if (!storedName) {
                setOpen(true);
                hasAutoOpened.current = true;
            }
        }
    }, [autoOpen, userId]);

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

    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const handleResetIdentity = () => {
        localStorage.removeItem('cueplay_userid');
        localStorage.removeItem('cueplay_nickname');
        window.location.href = '/'; // Reset to home for fresh start
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) setShowResetConfirm(false);
        }}>
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
                    {!isNewUser && (
                        <div className="border-t pt-4 mt-2">
                            <Button
                                variant="destructive"
                                size="sm"
                                className="w-full transition-all duration-200"
                                onClick={() => {
                                    if (showResetConfirm) {
                                        handleResetIdentity();
                                    } else {
                                        setShowResetConfirm(true);
                                        setTimeout(() => setShowResetConfirm(false), 3000);
                                    }
                                }}
                            >
                                {showResetConfirm
                                    ? (t('click_confirm_reset') || t('confirm_reset') || 'Click again to confirm')
                                    : (t('reset_identity') || 'Reset Identity')}
                            </Button>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>{t('save_changes')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
