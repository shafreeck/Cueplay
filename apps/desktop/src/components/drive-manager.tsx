import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DriveAccount, ApiClient } from '@/api/client';
import { Trash2, Plus, HardDrive, User, RefreshCw, Unplug, QrCode, Keyboard, Edit2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { QuarkLoginDialog } from './quark-login-dialog';
import { ManualCookieDialog } from './manual-cookie-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DriveManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect?: (driveId: string) => void;
    roomId?: string;
    userId?: string;
    isSystemMode?: boolean;
}

export function DriveManager({ open, onOpenChange, onSelect, roomId, userId, isSystemMode }: DriveManagerProps) {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [drives, setDrives] = useState<DriveAccount[]>([]);
    const [loading, setLoading] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showManualLogin, setShowManualLogin] = useState(false);
    const [driveToDelete, setDriveToDelete] = useState<string | null>(null);
    const [driveToUpdate, setDriveToUpdate] = useState<string | null>(null);
    const [driveToRename, setDriveToRename] = useState<string | null>(null);
    const [newName, setNewName] = useState('');

    const loadDrives = async () => {
        setLoading(true);
        try {
            const list = await ApiClient.listDrives(roomId, userId);
            setDrives(list);
        } catch (e: any) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: t('failed_load_drives'),
                description: e.message
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadDrives();
        }
    }, [open]);

    const handleAddDrive = async (cookie: string) => {
        try {
            if (driveToUpdate) {
                await ApiClient.updateDrive(driveToUpdate, cookie);
                toast({ title: t('drive_updated') });
            } else {
                await ApiClient.addDrive(cookie, undefined, roomId, userId, isSystemMode);
                toast({ title: t('drive_added') });
            }
            setShowLogin(false);
            setShowManualLogin(false);
            setDriveToUpdate(null);
            loadDrives();
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: driveToUpdate ? t('failed_update_drive') : t('failed_add_drive'),
                description: e.message
            });
        }
    };

    const handleRemoveClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDriveToDelete(id);
    };

    const confirmDelete = async () => {
        if (!driveToDelete) return;
        try {
            await ApiClient.removeDrive(driveToDelete);
            toast({
                title: t('drive_removed'),
            });
            loadDrives();
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: t('failed_remove_drive'),
                description: e.message
            });
        } finally {
            setDriveToDelete(null);
        }
    };

    const handleUpdateClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDriveToUpdate(id);
        setShowLogin(true);
    };

    const handleAddNewScan = () => {
        setDriveToUpdate(null);
        setShowLogin(true);
    };

    const handleRenameClick = (drive: DriveAccount, e: React.MouseEvent) => {
        e.stopPropagation();
        setDriveToRename(drive.id);
        setNewName(drive.name === 'Quark Drive' ? (t('quark_drive') || 'Quark Drive') : drive.name);
    };

    const confirmRename = async () => {
        if (!driveToRename || !newName.trim()) return;
        try {
            await ApiClient.renameDrive(driveToRename, newName.trim());
            toast({ title: t('drive_updated') || 'Drive updated' });
            loadDrives();
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: t('failed_update_drive'),
                description: e.message
            });
        } finally {
            setDriveToRename(null);
        }
    };

    const handleAddNewManual = () => {
        setDriveToUpdate(null);
        setShowManualLogin(true);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t('manage_drives')}</DialogTitle>
                    <DialogDescription>
                        {t('manage_drives_desc')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    {loading ? (
                        <div className="text-center text-muted-foreground">{t('loading')}...</div>
                    ) : drives.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg text-muted-foreground gap-2">
                            <HardDrive className="h-8 w-8 opacity-50" />
                            <p>{t('no_drives_connected')}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto px-1">
                            {drives.map(drive => (
                                <div
                                    key={drive.id}
                                    className="flex flex-col gap-3 p-4 rounded-xl border bg-card/50 hover:bg-accent/30 transition-colors"
                                    onClick={() => {
                                        onSelect?.(drive.id);
                                        onOpenChange(false);
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {/* Status Dot */}
                                            <div className="relative flex h-2 w-2 shrink-0">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                            </div>

                                            {/* Avatar or Default Icon */}
                                            <div className="h-8 w-8 rounded-full overflow-hidden bg-secondary/50 flex items-center justify-center shrink-0 border border-border/50">
                                                {drive.avatar ? (
                                                    <img src={drive.avatar} alt="Avatar" className="h-full w-full object-cover" />
                                                ) : (
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </div>

                                            <div className="flex flex-col overflow-hidden">
                                                <span className="font-medium text-sm leading-none truncate" title={drive.name}>
                                                    {drive.name === 'Quark Drive' ? t('quark_drive') : drive.name}
                                                </span>
                                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground truncate">
                                                    {drive.data?.nickname && <span className="max-w-[80px] truncate">{drive.data.nickname}</span>}
                                                    {drive.data?.nickname && <span>•</span>}
                                                    <span>{t('drive_connected')}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                onClick={(e) => handleRenameClick(drive, e)}
                                                title={t('rename')}
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                                onClick={(e) => handleRemoveClick(drive.id, e)}
                                                title={t('disconnect')}
                                            >
                                                <Unplug className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <Button
                                        variant="secondary"
                                        className="w-full justify-center gap-2 h-10 bg-secondary/50 hover:bg-secondary"
                                        onClick={(e) => handleUpdateClick(drive.id, e)}
                                    >
                                        <QrCode className="h-4 w-4" />
                                        {t('update_connection')}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                className="w-full"
                                size="lg"
                                disabled={!isSystemMode && !roomId && !userId}
                                title={(!isSystemMode && !roomId && !userId) ? t('scope_required') || 'Scope required' : ''}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {t('add_new_drive')}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                            <DropdownMenuItem onClick={handleAddNewScan} className="gap-2 cursor-pointer h-10">
                                <QrCode className="h-4 w-4" />
                                <span>{t('login_quark_scan') || 'Scan QR Code'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleAddNewManual} className="gap-2 cursor-pointer h-10">
                                <Keyboard className="h-4 w-4" />
                                <span>{t('manual_cookie_string') || 'Manual Input'}</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <QuarkLoginDialog
                    open={showLogin}
                    onOpenChange={(open) => {
                        setShowLogin(open);
                        if (!open) setDriveToUpdate(null);
                    }}
                    onSuccess={handleAddDrive}
                />

                <ManualCookieDialog
                    open={showManualLogin}
                    onOpenChange={(open) => {
                        setShowManualLogin(open);
                        if (!open) setDriveToUpdate(null);
                    }}
                    onSuccess={handleAddDrive}
                />

                <Dialog open={!!driveToDelete} onOpenChange={(open) => !open && setDriveToDelete(null)}>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle>{t('confirm_remove_drive')}</DialogTitle>
                            <DialogDescription>
                                {t('confirm_remove_drive_desc') || t('are_you_sure')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => setDriveToDelete(null)}>
                                {t('cancel')}
                            </Button>
                            <Button variant="destructive" onClick={confirmDelete}>
                                {t('confirm')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={!!driveToRename} onOpenChange={(open) => !open && setDriveToRename(null)}>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle>{t('rename_drive')}</DialogTitle>
                            <DialogDescription>
                                {t('enter_new_name_for_drive')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={t('drive_name') || 'Drive Name'}
                                onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDriveToRename(null)}>
                                {t('cancel')}
                            </Button>
                            <Button onClick={confirmRename}>
                                {t('save')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </DialogContent>
        </Dialog>
    );
}
