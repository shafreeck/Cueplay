'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { Loader2, FolderIcon, ChevronLeft, Check } from 'lucide-react';
import { ApiClient, DriveFile } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QuarkShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    initialFolderId: string;
    initialFolderName?: string;
}

export function QuarkShareDialog({ open, onOpenChange, onSuccess, initialFolderId, initialFolderName = 'Current Folder' }: QuarkShareDialogProps) {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [shareLink, setShareLink] = useState('');
    const [passCode, setPassCode] = useState('');

    // Target folder state
    const [targetFolderId, setTargetFolderId] = useState(initialFolderId);
    const [targetFolderName, setTargetFolderName] = useState(initialFolderName);

    // Picker state
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pickerCurrentId, setPickerCurrentId] = useState('0'); // Start at root for picker
    const [pickerPath, setPickerPath] = useState<{ id: string, name: string }[]>([{ id: '0', name: 'Root' }]);
    const [pickerFiles, setPickerFiles] = useState<DriveFile[]>([]);
    const [pickerLoading, setPickerLoading] = useState(false);

    // Sync initial folder when dialog opens
    useEffect(() => {
        if (open) {
            setTargetFolderId(initialFolderId);
            setTargetFolderName(initialFolderName);
        }
    }, [open, initialFolderId, initialFolderName]);

    // Cleanup state when dialog closes
    useEffect(() => {
        if (!open) {
            setShareLink('');
            setPassCode('');
            setIsPickerOpen(false);
        }
    }, [open]);

    const loadPickerFiles = async (folderId: string) => {
        setPickerLoading(true);
        try {
            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';
            const list = await ApiClient.listQuarkFiles(folderId, undefined, authCode);
            // Only show folders
            setPickerFiles(list.filter(f => f.type === 'folder'));
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: t('error'),
                description: e.message || 'Failed to load folders',
            });
        } finally {
            setPickerLoading(false);
        }
    };

    useEffect(() => {
        if (isPickerOpen) {
            loadPickerFiles(pickerCurrentId);
        }
    }, [isPickerOpen, pickerCurrentId]);

    const handleEnterFolder = (folder: DriveFile) => {
        setPickerCurrentId(folder.id);
        setPickerPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    };

    const handleNavigateUp = () => {
        if (pickerPath.length <= 1) return;
        const newPath = pickerPath.slice(0, -1);
        setPickerPath(newPath);
        setPickerCurrentId(newPath[newPath.length - 1].id);
    };

    const handleSelectCurrentPickerFolder = () => {
        const current = pickerPath[pickerPath.length - 1];
        setTargetFolderId(current.id);
        setTargetFolderName(current.name === 'Root' ? t('root_folder') : current.name);
        setIsPickerOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!shareLink.trim()) {
            return;
        }

        setLoading(true);
        try {
            await ApiClient.saveQuarkShare(shareLink.trim(), passCode.trim() || undefined, targetFolderId);

            toast({
                title: t('success'),
                description: t('share_saved_successfully'),
            });

            onSuccess?.();
            onOpenChange(false);
        } catch (error: any) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: t('error'),
                description: error.message || 'Failed to save share link',
            });
        } finally {
            setLoading(false);
        }
    };

    if (isPickerOpen) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px] h-[500px] max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {pickerPath.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 -ml-2" onClick={handleNavigateUp}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                            )}
                            {t('select_folder')}
                        </DialogTitle>
                        <DialogDescription className="truncate">
                            {pickerPath.map(p => p.name === 'Root' ? t('root_folder') : p.name).join(' / ')}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 min-h-0 border rounded-md p-2">
                        {pickerLoading ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : pickerFiles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-muted-foreground text-sm">
                                <FolderIcon className="h-8 w-8 mb-2 opacity-20" />
                                <p>{t('no_subfolders')}</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {pickerFiles.map(folder => (
                                    <div
                                        key={folder.id}
                                        className="flex items-center gap-3 p-2 hover:bg-secondary/50 rounded-md cursor-pointer transition-colors"
                                        onClick={() => handleEnterFolder(folder)}
                                    >
                                        <FolderIcon className="h-5 w-5 text-primary/70" />
                                        <span className="flex-1 text-sm truncate">{folder.name}</span>
                                        <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground/50" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <div className="flex-1 flex items-center text-xs text-muted-foreground truncate mr-2">
                            {t('selected')}: {pickerPath[pickerPath.length - 1].name === 'Root' ? t('root_folder') : pickerPath[pickerPath.length - 1].name}
                        </div>
                        <Button variant="outline" onClick={() => setIsPickerOpen(false)}>
                            {t('cancel')}
                        </Button>
                        <Button onClick={handleSelectCurrentPickerFolder}>
                            <Check className="h-4 w-4 mr-2" />
                            {t('select_this_folder')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t('add_quark_share')}</DialogTitle>
                    <DialogDescription>
                        {t('add_quark_share_desc')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="shareLink">{t('share_link')}</Label>
                        <Input
                            id="shareLink"
                            placeholder="https://pan.quark.cn/s/..."
                            value={shareLink}
                            onChange={(e) => setShareLink(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="passCode">{t('pass_code')}</Label>
                        <Input
                            id="passCode"
                            placeholder="Enter 4-digit code if required"
                            value={passCode}
                            onChange={(e) => setPassCode(e.target.value)}
                            disabled={loading}
                            maxLength={4}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('save_to')}</Label>
                        <div className="flex items-center gap-2 p-2 border rounded-md bg-secondary/20">
                            <FolderIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 text-sm font-medium truncate" title={targetFolderName}>
                                {targetFolderName === 'Root' ? t('root_folder') : targetFolderName}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                    // Reset picker to root or current target? 
                                    // Generally better to start at root or current selection.
                                    // Let's start at root for simplicity as getting full path for deep folders is hard without full tree
                                    setPickerCurrentId('0');
                                    setPickerPath([{ id: '0', name: 'Root' }]);
                                    setIsPickerOpen(true);
                                }}
                                disabled={loading}
                            >
                                {t('change')}
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            {t('cancel')}
                        </Button>
                        <Button type="submit" disabled={loading || !shareLink}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
