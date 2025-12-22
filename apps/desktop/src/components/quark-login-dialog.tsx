'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, XCircle, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { API_BASE } from '@/api/config';

interface QuarkLoginDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (cookie: string) => void;
}

export function QuarkLoginDialog({ open, onOpenChange, onSuccess }: QuarkLoginDialogProps) {
    const { t } = useTranslation();
    const [qrcodeUrl, setQrcodeUrl] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'pending' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [manualCookie, setManualCookie] = useState('');
    const [isSavingCookie, setIsSavingCookie] = useState(false);

    // Poll for QR code status
    useEffect(() => {
        if (!sessionId || loginStatus !== 'pending') return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE}/quark/login/status/${sessionId}`);
                const data = await response.json();

                if (data.status === 'success') {
                    setLoginStatus('success');
                    clearInterval(pollInterval);

                    // Notify parent and close dialog after a short delay
                    setTimeout(() => {
                        onSuccess?.(data.cookie);
                        onOpenChange(false);
                        resetState();
                    }, 1500);
                } else if (data.status === 'expired') {
                    setLoginStatus('error');
                    setErrorMessage('QR code expired. Please try again.');
                    clearInterval(pollInterval);
                }
            } catch (error) {
                console.error('Failed to check login status:', error);
            }
        }, 2000); // Poll every 2 seconds

        return () => clearInterval(pollInterval);
    }, [sessionId, loginStatus, onSuccess, onOpenChange]);


    const resetState = () => {
        setQrcodeUrl('');
        setSessionId('');
        setLoginStatus('idle');
        setErrorMessage('');
        setManualCookie('');
    };

    const generateQRCode = async () => {
        setLoginStatus('loading');
        setErrorMessage('');

        try {
            const response = await fetch(`${API_BASE}/quark/login/qrcode`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to generate QR code');
            }

            const data = await response.json();
            setQrcodeUrl(data.qrcodeUrl);
            setSessionId(data.sessionId);
            setLoginStatus('pending');
        } catch (error: any) {
            setLoginStatus('error');
            setErrorMessage(error.message || 'Failed to generate QR code');
        }
    };

    const saveManualCookie = async () => {
        if (!manualCookie.trim()) {
            setErrorMessage('Please enter a cookie');
            return;
        }

        setIsSavingCookie(true);
        setErrorMessage('');

        try {
            const response = await fetch(`${API_BASE}/quark/login/cookie`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cookie: manualCookie }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save cookie');
            }

            // Success
            setLoginStatus('success');
            setTimeout(() => {
                onSuccess?.(manualCookie);
                onOpenChange(false);
                resetState();
            }, 1000);
        } catch (error: any) {
            setErrorMessage(error.message || 'Failed to save cookie');
        } finally {
            setIsSavingCookie(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Quark Login</DialogTitle>
                    <DialogDescription>
                        Login to Quark Pan to access your files
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="qrcode" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="qrcode">
                            <QrCode className="w-4 h-4 mr-2" />
                            QR Code
                        </TabsTrigger>
                        <TabsTrigger value="manual">Manual Cookie</TabsTrigger>
                    </TabsList>

                    <TabsContent value="qrcode" className="space-y-4">
                        {loginStatus === 'idle' && (
                            <div className="flex flex-col items-center gap-4 py-8">
                                <p className="text-sm text-muted-foreground text-center">
                                    Click the button below to generate a QR code,<br />
                                    then scan it with your Quark app to login
                                </p>
                                <Button onClick={generateQRCode}>
                                    Generate QR Code
                                </Button>
                            </div>
                        )}

                        {loginStatus === 'loading' && (
                            <div className="flex flex-col items-center gap-4 py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Generating QR code...</p>
                            </div>
                        )}



                        {loginStatus === 'pending' && qrcodeUrl && (
                            <div className="flex flex-col items-center gap-4 py-4">
                                <div className="relative p-4 bg-white rounded-lg">
                                    <QRCodeSVG
                                        value={qrcodeUrl}
                                        size={192}
                                        level="L"
                                        includeMargin={false}
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-primary">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <p className="text-sm">Waiting for scan...</p>
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    Open Quark app and scan this QR code to login
                                </p>
                            </div>
                        )}

                        {loginStatus === 'success' && (
                            <div className="flex flex-col items-center gap-4 py-8">
                                <CheckCircle2 className="w-12 h-12 text-green-500" />
                                <p className="text-sm font-medium">Login successful!</p>
                            </div>
                        )}

                        {loginStatus === 'error' && (
                            <div className="flex flex-col items-center gap-4 py-8">
                                <XCircle className="w-12 h-12 text-red-500" />
                                <p className="text-sm text-red-500">{errorMessage}</p>
                                <Button onClick={generateQRCode} variant="outline">
                                    Try Again
                                </Button>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="manual" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cookie">Quark Cookie</Label>
                            <Input
                                id="cookie"
                                placeholder="Paste your Quark cookie here..."
                                value={manualCookie}
                                onChange={(e) => setManualCookie(e.target.value)}
                                className="font-mono text-xs"
                            />
                            <p className="text-xs text-muted-foreground">
                                You can get the cookie from your browser's developer tools
                            </p>
                        </div>

                        {errorMessage && loginStatus !== 'success' && (
                            <div className="flex items-center gap-2 text-red-500 text-sm">
                                <XCircle className="w-4 h-4" />
                                <p>{errorMessage}</p>
                            </div>
                        )}

                        {loginStatus === 'success' && (
                            <div className="flex items-center gap-2 text-green-500 text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                <p>Cookie saved successfully!</p>
                            </div>
                        )}

                        <Button
                            onClick={saveManualCookie}
                            disabled={isSavingCookie || !manualCookie.trim()}
                            className="w-full"
                        >
                            {isSavingCookie ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Cookie'
                            )}
                        </Button>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
