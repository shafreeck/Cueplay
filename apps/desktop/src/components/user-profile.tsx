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
import { Settings, Unplug, QrCode, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { ApiClient } from '@/api/client';
import { QuarkLoginDialog } from '@/components/quark-login-dialog';

export function UserProfile({ userId, autoOpen = false }: { userId: string; autoOpen?: boolean }) {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [isNewUser, setIsNewUser] = useState(false);

    // New State for Auth
    const [authCode, setAuthCode] = useState('');
    const [userCookie, setUserCookie] = useState('');
    const [showQuarkLogin, setShowQuarkLogin] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);

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

            // Load User Cookie from Backend
            if (userId) {
                ApiClient.getUserCookie(userId)
                    .then(c => setUserCookie(c || ''))
                    .catch(e => console.error("Failed to load user cookie", e));
            }

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

    const handleLoginSuccess = async (cookie: string) => {
        setUserCookie(cookie);
        if (userId) {
            try {
                await ApiClient.saveUserCookie(userId, cookie);
                // Also refresh cookie state visually if needed
            } catch (e) {
                console.error("Failed to save user cookie", e);
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
                                    {/* Connection Status Card */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-2.5 w-2.5 rounded-full ${userCookie ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-zinc-600'}`} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">
                                                    {userCookie ? t('user_cookie_connected') : t('not_logged_in')}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {userCookie ? t('quark_login') : t('auth_required_desc')}
                                                </span>
                                            </div>
                                        </div>
                                        {userCookie && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleLoginSuccess('')}
                                            >
                                                {t('disconnect_cookie')}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Connect Button */}
                                    {!userCookie && (
                                        <Button
                                            className="w-full gap-2"
                                            onClick={() => setShowQuarkLogin(true)}
                                        >
                                            <QrCode className="h-4 w-4" />
                                            {t('login_quark_scan')}
                                        </Button>
                                    )}

                                    {/* Advanced Settings Toggle */}
                                    <div className="pt-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowManualInput(!showManualInput)}
                                            className="h-6 w-full justify-between px-0 hover:bg-transparent text-muted-foreground hover:text-foreground group"
                                        >
                                            <span className="text-[10px] font-medium uppercase tracking-wider group-hover:underline decoration-border/50 underline-offset-4">{t('advanced_settings')}</span>
                                            <Settings className={`h-3 w-3 transition-transform duration-300 ${showManualInput ? 'rotate-90' : ''}`} />
                                        </Button>

                                        {showManualInput && (
                                            <div className="mt-3 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                                                {/* Manual Cookie */}
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="manual-cookie" className="text-[10px] font-medium text-muted-foreground">{t('manual_cookie_input')}</Label>
                                                    <Input
                                                        id="manual-cookie"
                                                        value={userCookie}
                                                        onChange={(e) => handleLoginSuccess(e.target.value)}
                                                        className="h-8 text-xs font-mono bg-background/50"
                                                        placeholder={t('manual_cookie_input_placeholder')}
                                                        type="password"
                                                    />
                                                </div>

                                                {/* System Auth Code */}
                                                {isAuthRequired && (
                                                    <div className="space-y-1.5 pt-2 border-t border-border/30">
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
                                        )}
                                    </div>
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

            <QuarkLoginDialog
                open={showQuarkLogin}
                onOpenChange={setShowQuarkLogin}
                onSuccess={handleLoginSuccess}
            />
        </>
    );
}
