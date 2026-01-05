'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { API_BASE } from '@/api/config';

interface QuarkLoginDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (cookie: string) => void;
}

export function QuarkLoginDialog({ open, onOpenChange, onSuccess }: QuarkLoginDialogProps) {
    const { t } = useTranslation('common');
    const [qrcodeUrl, setQrcodeUrl] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'pending' | 'scanned' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    // Use ref for onSuccess to avoid resetting poll interval on parent re-renders
    const onSuccessRef = useRef(onSuccess);
    useEffect(() => {
        onSuccessRef.current = onSuccess;
    }, [onSuccess]);


    // Auto-generate QR code when dialog opens
    useEffect(() => {
        if (open && loginStatus === 'idle') {
            generateQRCode();
        }
    }, [open, loginStatus]);

    // Poll for QR code status
    useEffect(() => {
        if (!sessionId || (loginStatus !== 'pending' && loginStatus !== 'scanned')) return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE}/quark/login/status/${sessionId}`);
                const data = await response.json();

                if (data.status === 'success') {
                    setLoginStatus('success');
                    clearInterval(pollInterval);

                    // Notify parent and close dialog after a short delay
                    setTimeout(() => {
                        onSuccessRef.current?.(data.cookie);
                        onOpenChange(false);
                        resetState();
                    }, 1500);
                } else if (data.status === 'scanned') {
                    setLoginStatus('scanned');
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
    }, [sessionId, loginStatus, onOpenChange]);

    const resetState = () => {
        setQrcodeUrl('');
        setSessionId('');
        setLoginStatus('idle');
        setErrorMessage('');
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>{t('login_quark_scan')}</DialogTitle>
                    <DialogDescription>
                        {t('scan_with_quark_app')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center min-h-[300px]">
                    {loginStatus === 'loading' && (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">{t('loading')}...</p>
                        </div>
                    )}

                    {loginStatus === 'pending' && qrcodeUrl && (
                        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                            <div className="relative p-4 bg-white rounded-xl shadow-lg border-4 border-white">
                                <QRCodeSVG
                                    value={qrcodeUrl}
                                    size={200}
                                    level="L"
                                    includeMargin={false}
                                />
                            </div>
                            <div className="flex items-center gap-2 text-primary animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <p className="text-xs font-medium">{t('waiting_for_scan')}</p>
                            </div>
                        </div>
                    )}

                    {loginStatus === 'scanned' && (
                        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
                            <div className="relative p-4 bg-white/10 rounded-full animate-pulse">
                                <CheckCircle2 className="w-16 h-16 text-primary" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-lg font-bold text-white">{t('scan_success_confirm')}</p>
                                <p className="text-sm text-muted-foreground">{t('scan_success_confirm_desc')}</p>
                            </div>
                        </div>
                    )}

                    {loginStatus === 'success' && (
                        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                            <div className="rounded-full bg-green-500/10 p-4">
                                <CheckCircle2 className="w-16 h-16 text-green-500" />
                            </div>
                            <p className="text-lg font-medium text-green-500">{t('scan_success')}</p>
                        </div>
                    )}

                    {loginStatus === 'error' && (
                        <div className="flex flex-col items-center gap-4">
                            <XCircle className="w-12 h-12 text-destructive" />
                            <p className="text-sm text-destructive text-center max-w-[200px]">{errorMessage}</p>
                            <Button onClick={generateQRCode} variant="outline" size="sm">
                                Try Again
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog >
    );
}
