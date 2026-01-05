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
import { DriveManager } from '@/components/drive-manager';

import { API_BASE } from '@/api/config';

export default function AdminPage() {
    const { toast } = useToast();
    const { t } = useTranslation('common');
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authCode, setAuthCode] = useState('');
    const [authRequired, setAuthRequired] = useState(true);
    const [loading, setLoading] = useState(false);
    const [isSavingAuthRequired, setIsSavingAuthRequired] = useState(false);
    const [driveManagerOpen, setDriveManagerOpen] = useState(false);

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
            // Load Auth Code
            const resAuth = await fetch(`${API_BASE}/admin/config/auth-code`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resAuth.ok) {
                const data = await resAuth.json();
                setAuthCode(data.authCode || '');
            } else {
                if (resAuth.status === 401) logout();
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

                            <div className="bg-muted/30 rounded-lg p-4 border border-white/5 space-y-4">
                                <Button
                                    className="w-full gap-2"
                                    onClick={() => setDriveManagerOpen(true)}
                                >
                                    <Settings className="w-4 h-4" />
                                    {t('manage_system_drives') || "Manage System Drives"}
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">
                                    {t('manage_system_drives_desc') || "Manage system-wide drives accessible to all rooms."}
                                </p>
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

            <DriveManager
                open={driveManagerOpen}
                onOpenChange={setDriveManagerOpen}
                isSystemMode={true}
            />
        </div>
    );
}
