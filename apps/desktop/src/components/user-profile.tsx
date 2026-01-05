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

    // New State for Auth
    const [authCode, setAuthCode] = useState('');
    const [showQuarkLogin, setShowQuarkLogin] = useState(false);
    const [userDrives, setUserDrives] = useState<DriveAccount[]>([]); // Track user drives locally for UI status


    // Verification State
    const [verifying, setVerifying] = useState(false);
    const [authCodeStatus, setAuthCodeStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [isAuthRequired, setIsAuthRequired] = useState(true);

    const hasAutoOpened = useRef(false);

    useEffect(() => {
        if (open) {
            // Load settings when dialog opens
            const storedName = localStorage.getItem('cueplay_nickname') || '';
            setDisplayName(storedName);
            setIsNewUser(!storedName);

            // Load Auth Code
            setAuthCode(localStorage.getItem('cueplay_system_auth_code') || '');

            // Legacy User Cookie loading removed

            // Check if global auth is required
            ApiClient.getGlobalAuthRequired()
                .then(setIsAuthRequired)
                .catch(e => console.error("Failed to check auth requirement", e));
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
        localStorage.setItem('cueplay_system_auth_code', authCode);
        setOpen(false);
    };

    // Load User Drives on mount/open
    useEffect(() => {
        if (open && userId) {
            // Fetch drives scoped to this user (no room ID)
            ApiClient.listDrives(undefined, userId)
                .then(setUserDrives)
                .catch(e => console.error("Failed to load user drives", e));
        }
    }, [open, userId]);

    const handleLoginSuccess = async (cookie: string) => {
        if (userId) {
            try {
                // Add drive with User Scope
                await ApiClient.addDrive(cookie, undefined, undefined, userId);
                toast({ title: t('drive_connected') });
                // Refresh list
                const list = await ApiClient.listDrives(undefined, userId);
                setUserDrives(list);
            } catch (e) {
                console.error("Failed to add user drive", e);
                toast({ title: t('failed_add_drive'), variant: 'destructive' });
            }
        }
    };

    const handleVerifyAuthCode = async () => {
        if (!authCode) return;
        setVerifying(true);
        setAuthCodeStatus('idle');
        try {
            // Use the new explicit verification endpoint
            const success = await ApiClient.verifyAuthCode(authCode);
            if (success) {
                setAuthCodeStatus('success');
                toast({
                    title: t('auth_code_valid'),
                });
                // Persist the code immediately upon successful verification
                localStorage.setItem('cueplay_system_auth_code', authCode);
            } else {
                throw new Error(t('auth_code_invalid'));
            }
        } catch (e: any) {
            setAuthCodeStatus('error');

            const errorKey = e.message.includes('system_login_required')
                ? 'error_no_cookie_configured'
                : (e.message.includes('invalid_connection_code') ? 'auth_code_invalid' : e.message);

            toast({
                title: t('auth_code_invalid'),
                description: t(errorKey) || e.message,
                variant: 'destructive'
            });
        } finally {
            setVerifying(false);
        }
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

                        {/* Authorization Section */}
                        {!isNewUser && (
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">{t('authorization_settings')}</h3>

                                <div className="bg-muted/20 border border-border/50 rounded-xl p-4 space-y-4">

                                    {/* Personal Drive Connection */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-2.5 w-2.5 rounded-full ${userDrives.length > 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-zinc-600'}`} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">
                                                    {userDrives.length > 0 ? t('user_cookie_connected') : t('not_logged_in')}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {userDrives.length > 0 ? (userDrives[0].data?.nickname || t('quark_drive')) : t('connect_personal_drive_desc')}
                                                </span>
                                            </div>
                                        </div>
                                        {userDrives.length > 0 && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={async () => {
                                                    // Disconnect all user drives for now (simplified)
                                                    for (const d of userDrives) {
                                                        await ApiClient.removeDrive(d.id);
                                                    }
                                                    setUserDrives([]);
                                                }}
                                            >
                                                {t('disconnect_cookie')}
                                            </Button>
                                        )}
                                    </div>

                                    {!userDrives.length && (
                                        <Button
                                            className="w-full gap-2"
                                            onClick={() => setShowQuarkLogin(true)}
                                            disabled={!userId}
                                            title={!userId ? "User ID missing" : ""}
                                        >
                                            <QrCode className="h-4 w-4" />
                                            {t('login_quark_scan')}
                                        </Button>
                                    )}

                                    {/* System Auth Code (If required) */}
                                    {isAuthRequired && (
                                        <div className="space-y-1.5 pt-2 border-t border-border/30 mt-2">

                                            <Label htmlFor="auth-code" className="text-[10px] font-medium text-muted-foreground block">{t('system_auth_code_label')}</Label>
                                            <p className="text-[10px] text-muted-foreground/60 leading-tight">
                                                {t('system_auth_code_desc')}
                                            </p>
                                            <div className="relative group/auth">
                                                <Input
                                                    id="auth-code"
                                                    type="password"
                                                    value={authCode}
                                                    onChange={(e) => {
                                                        setAuthCode(e.target.value);
                                                        setAuthCodeStatus('idle');
                                                    }}
                                                    className="h-8 text-xs font-mono bg-background/50 mt-1.5 pr-16"
                                                    placeholder={t('system_auth_code_placeholder')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleVerifyAuthCode();
                                                    }}
                                                />
                                                <div className="absolute right-1 top-[7px] flex items-center gap-1">
                                                    {authCodeStatus === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                                                    {authCodeStatus === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 text-[10px] px-1.5 hover:bg-muted"
                                                        onClick={handleVerifyAuthCode}
                                                        disabled={verifying || !authCode}
                                                    >
                                                        {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : t('verify')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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

            {/* Authentication Dialog */}
            <QuarkLoginDialog
                open={showQuarkLogin}
                onOpenChange={setShowQuarkLogin}
                onSuccess={handleLoginSuccess}
            />
        </>
    );
}
