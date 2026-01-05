'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';

interface ManualCookieDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (cookie: string) => void;
}

export function ManualCookieDialog({ open, onOpenChange, onSuccess }: ManualCookieDialogProps) {
    const { t } = useTranslation('common');
    const [manualCookie, setManualCookie] = useState('');

    const handleSubmit = () => {
        if (!manualCookie.trim()) return;
        onSuccess?.(manualCookie.trim());
        onOpenChange(false);
        setManualCookie('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>{t('manual_configuration')}</DialogTitle>
                    <DialogDescription>
                        {t('manual_cookie_input_desc')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 mt-4">
                    <div className="space-y-2">
                        <Textarea
                            placeholder={t('manual_cookie_input_placeholder')}
                            className="min-h-[150px] font-mono text-xs resize-none"
                            value={manualCookie}
                            onChange={(e) => setManualCookie(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('manual_cookie_input')}
                        </p>
                    </div>
                    <Button
                        className="w-full"
                        onClick={handleSubmit}
                        disabled={!manualCookie.trim()}
                    >
                        {t('confirm')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
