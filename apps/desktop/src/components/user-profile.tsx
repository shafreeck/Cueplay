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
import { Loader2, CheckCircle2, XCircle, QrCode } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { ApiClient } from '@/api/client';
import { QuarkLoginDialog } from '@/components/quark-login-dialog';
import { DriveAccount } from '@/api/client'; // Import DriveAccount

export function UserProfile({ userId, autoOpen = false }: { userId: string; autoOpen?: boolean }) {
    const { t } = useTranslation('common');
    const { toast } = useToast();
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
    }, [open, userId]);

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
        <>
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
                <DialogContent className="sm:max-w-[425px] overflow-hidden">
                    <DialogHeader className="pb-4 border-b border-border/10">
                        <DialogTitle>{t('profile_settings')}</DialogTitle>
                        <DialogDescription>
                            {t('set_identity_pref')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-6 py-6">
                        {/* Identity Section */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">{t('identity_settings')}</h3>
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="display-name" className="text-xs font-medium">{t('display_name_label')}</Label>
                                    <Input
                                        id="display-name"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder={t('display_name_placeholder')}
                                        className="h-9"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSave();
                                        }}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-muted-foreground">{t('user_id_label')}</Label>
                                    <div className="w-full h-9 rounded-md border border-input bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors flex items-center font-mono text-xs text-muted-foreground select-all">
                                        {userId}
                                    </div>
                                </div>
                            </div>
                        </div>


                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border/10 pt-4">
                        {!isNewUser ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs px-2"
                                onClick={() => {
                                    if (showResetConfirm) {
                                        handleResetIdentity();
                                    } else {
                                        setShowResetConfirm(true);
                                        setTimeout(() => setShowResetConfirm(false), 3000);
                                    }
                                }}
                            >
                                {showResetConfirm ? t('confirm_reset') : t('reset_identity')}
                            </Button>
                        ) : <div />}

                        <Button onClick={handleSave} className="min-w-[80px]">{t('save_changes')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


        </>
    );
}
