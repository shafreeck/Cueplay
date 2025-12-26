'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, QrCode, Settings, Unplug, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Switch } from "@/components/ui/switch";
import { QuarkLoginDialog } from '@/components/quark-login-dialog';

import { API_BASE } from '@/api/config';

export default function AdminPage() {
    const { toast } = useToast();
    const { t } = useTranslation('common');
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [cookie, setCookie] = useState('');
    const [authCode, setAuthCode] = useState('');
    const [authRequired, setAuthRequired] = useState(true);
    const [loading, setLoading] = useState(false);
    const [showLoginDialog, setShowLoginDialog] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);
    const [isSavingAuthRequired, setIsSavingAuthRequired] = useState(false);

    // Initial check (could verify stored token)
    useEffect(() => {
        const token = localStorage.getItem('admin_token');
        if (token) {
            setIsAuthenticated(true);
            loadConfig(token);
        }
    }, []);

    const loadConfig = async (token: string) => {
        try {
            // Load Cookie
            const res = await fetch(`${API_BASE}/admin/config/cookie`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCookie(data.cookie || '');
            } else {
                if (res.status === 401) logout();
            }

            // Load Auth Code
            const resAuth = await fetch(`${API_BASE}/admin/config/auth-code`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resAuth.ok) {
                const data = await resAuth.json();
                setAuthCode(data.authCode || '');
            }

            // Load Auth Required
            const resReq = await fetch(`${API_BASE}/admin/config/auth-required`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resReq.ok) {
                const data = await resReq.json();
                setAuthRequired(data.required);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const saveAuthCode = async () => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin/config/auth-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ authCode })
            });

            if (res.ok) {
                toast({ title: "Saved", description: "Authorization code updated." });
            } else {
                throw new Error('Save failed');
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save authorization code." });
        } finally {
            setLoading(false);
        }
    };

    const toggleAuthRequired = async (val: boolean) => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        setIsSavingAuthRequired(true);
        try {
            const res = await fetch(`${API_BASE}/admin/config/auth-required`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ required: val })
            });

            if (res.ok) {
                setAuthRequired(val);
                toast({ title: t('saved') || "Saved", description: t('always_require_auth') });
            } else {
                throw new Error('Save failed');
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update preference." });
        } finally {
            setIsSavingAuthRequired(false);
        }
    };

    const login = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                const data = await res.json();
                // For this simple implementation, the password IS the token
                const token = data.token;
                localStorage.setItem('admin_token', token);
                setIsAuthenticated(true);
                loadConfig(token);
                toast({ title: "Authorized", description: "Welcome back, Admin." });
            } else {
                toast({ variant: "destructive", title: "Access Denied", description: "Invalid password." });
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Could not connect to server." });
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('admin_token');
        setIsAuthenticated(false);
        setPassword('');
    };

    const saveConfig = async (cookieToSave?: string) => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        const value = cookieToSave !== undefined ? cookieToSave : cookie;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin/config/cookie`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cookie: value })
            });

            if (res.ok) {
                toast({ title: "Saved", description: "Global configuration updated." });
                if (cookieToSave !== undefined) setCookie(cookieToSave);
            } else {
                throw new Error('Save failed');
            }
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save configuration." });
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lock className="w-5 h-5" />
                            System Administration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            type="password"
                            placeholder="Admin Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && login()}
                        />
                        <Button className="w-full" onClick={login} disabled={loading}>
                            {loading ? 'Verifying...' : 'Unlock'}
                        </Button>
                        <div className="text-center">
                            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                                ← Back to Home
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <ShieldCheck className="w-8 h-8 text-primary" />
                            {t('system_console')}
                        </h1>
                    </div>
                    <Button variant="outline" onClick={logout}>{t('logout')}</Button>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('global_cookie_management')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                                <p className="font-medium text-foreground mb-1">{t('service_level_credential')}</p>
                                <p>{t('service_credential_desc')}</p>
                            </div>

                            <div className="bg-muted/30 rounded-lg p-3 border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`h-2 w-2 rounded-full ${cookie ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                                        <span className="text-sm font-medium text-foreground">
                                            {cookie ? t('quark_drive_connected') : t('quark_drive_disconnected')}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        {cookie && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                                onClick={() => saveConfig('')}
                                                title={t('disconnect_cookie') || 'Disconnect'}
                                            >
                                                <Unplug className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 hover:bg-white/10"
                                            onClick={() => setShowManualInput(!showManualInput)}
                                            title={t('manual_configuration')}
                                        >
                                            <Settings className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                </div>

                                <Button
                                    variant={cookie ? "outline" : "default"}
                                    size="sm"
                                    className="w-full gap-2"
                                    onClick={() => setShowLoginDialog(true)}
                                >
                                    <QrCode className="w-4 h-4" />
                                    {cookie ? t('update_connection') : t('login_to_quark_drive')}
                                </Button>

                                {showManualInput && (
                                    <div className="pt-3 border-t border-white/5 animate-in slide-in-from-top-1 fade-in duration-200 space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">{t('manual_cookie_string')}</label>
                                        <Input
                                            type="password"
                                            value={cookie}
                                            onChange={(e) => setCookie(e.target.value)}
                                            onBlur={() => saveConfig()}
                                            placeholder="Enter cookie string..."
                                            className="font-mono text-xs h-8"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            {t('changes_saved_automatically')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* System Authorization Code Section */}
                            <div className="pt-4 border-t border-white/5">
                                <label className="text-sm font-medium block mb-2">{t('system_auth_code_label')}</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        value={authCode}
                                        onChange={(e) => setAuthCode(e.target.value)}
                                        placeholder={t('system_auth_code_placeholder')}
                                        className="font-mono text-sm"
                                    />
                                    <Button onClick={saveAuthCode} disabled={loading} variant="secondary">
                                        {t('save')}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2">
                                    {t('system_auth_code_desc')}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium block">{t('always_require_auth')}</label>
                                    <p className="text-[10px] text-muted-foreground">
                                        {t('always_require_auth_desc')}
                                    </p>
                                </div>
                                <Switch
                                    checked={authRequired}
                                    onCheckedChange={toggleAuthRequired}
                                    disabled={isSavingAuthRequired}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('system_status')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground">
                                {t('status_monitoring_soon')}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <QuarkLoginDialog
                open={showLoginDialog}
                onOpenChange={setShowLoginDialog}
                onSuccess={(newCookie) => {
                    saveConfig(newCookie);
                }}
            />
        </div>
    );
}
