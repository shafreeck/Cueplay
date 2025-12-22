'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, QrCode } from 'lucide-react';
import { QuarkLoginDialog } from '@/components/quark-login-dialog';

import { API_BASE } from '@/api/config';

export default function AdminPage() {
    const { toast } = useToast();
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [cookie, setCookie] = useState('');
    const [loading, setLoading] = useState(false);
    const [showLoginDialog, setShowLoginDialog] = useState(false);

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
            const res = await fetch(`${API_BASE}/admin/config/cookie`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCookie(data.cookie || '');
            } else {
                if (res.status === 401) logout();
            }
        } catch (e) {
            console.error(e);
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

    const saveConfig = async () => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin/config/cookie`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cookie })
            });

            if (res.ok) {
                toast({ title: "Saved", description: "Global configuration updated." });
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
                            System Console
                        </h1>
                    </div>
                    <Button variant="outline" onClick={logout}>Logout</Button>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Global Cookie Management</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                                <p className="font-medium text-foreground mb-1">Service-Level Credential</p>
                                <p>This cookie is used as a fallback for all users who do not have their own cookie set.</p>
                                <p className="mt-2 text-xs opacity-70">
                                    Format: A valid Quark cookie string. Stored securely on the server.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium">Quark Cookie String</label>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-xs gap-1"
                                        onClick={() => setShowLoginDialog(true)}
                                    >
                                        <QrCode className="w-3 h-3" />
                                        Get via Login
                                    </Button>
                                </div>
                                <Input
                                    type="password"
                                    value={cookie}
                                    onChange={(e) => setCookie(e.target.value)}
                                    placeholder="Enter full cookie string..."
                                    className="font-mono text-xs"
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={saveConfig} disabled={loading}>
                                    {loading ? 'Saving...' : 'Save Configuration'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>System Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground">
                                Status monitoring is coming soon.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <QuarkLoginDialog
                open={showLoginDialog}
                onOpenChange={setShowLoginDialog}
                onSuccess={(newCookie) => {
                    setCookie(newCookie);
                    // Optional: You could auto-save here, or let the user click save.
                    // Let's at least update the input so they see it.
                    toast({ description: "Cookie captured! Click 'Save Configuration' to apply." });
                }}
            />
        </div>
    );
}
