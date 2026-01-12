import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ApiClient, DriveFile, DriveAccount } from '@/api/client';
import { FileIcon, FolderIcon, ChevronRight, Loader2, Plus, LayoutGrid, List as ListIcon, Search, HardDrive, Settings, User, Lock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { QuarkShareDialog } from './quark-share-dialog';
import { DriveManager } from './drive-manager';
import { cn } from '@/lib/utils';

interface ResourceLibraryProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cookie?: string;
    onAdd?: (file: DriveFile) => void;
    onAddSeries?: (folder: DriveFile, files: DriveFile[]) => void;
    roomId?: string; // Scope drives to this room
    userId?: string; // Scope drives to this user
}

interface PathItem {
    id: string;
    name: string;
}

export function ResourceLibrary({ open, onOpenChange, cookie: legacyCookie, onAdd, onAddSeries, roomId, userId }: ResourceLibraryProps) {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [path, setPath] = useState<PathItem[]>([{ id: '0', name: 'Root' }]);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [shareDialogOpen, setShareDialogOpen] = useState(false);

    // Drive Management
    const [drives, setDrives] = useState<DriveAccount[]>([]);
    const [isDrivesLoaded, setIsDrivesLoaded] = useState(false);
    const [selectedDriveId, setSelectedDriveId] = useState<string | undefined>(undefined);
    const [driveManagerOpen, setDriveManagerOpen] = useState(false);
    const [authCodeRequired, setAuthCodeRequired] = useState(false); // Triggers the dialog
    const [isAccessDenied, setIsAccessDenied] = useState(false); // Triggers the lock screen view

    const currentFolder = path[path.length - 1];

    // Load drives on open
    useEffect(() => {
        if (open) {
            loadDrives();
        }
    }, [open]);

    const loadDrives = async () => {
        try {
            const authCode = localStorage.getItem('cueplay_system_auth_code') || undefined;
            const list = await ApiClient.listDrives(roomId, userId, undefined, authCode);
            setDrives(list);

            // Auto-select first drive if none selected, or if current selection is invalid
            if (list.length > 0) {
                if (!selectedDriveId || !list.find(d => d.id === selectedDriveId)) {
                    setSelectedDriveId(list[0].id);
                }
            } else {
                // No drives found.
                // If no drives, we might fall back to legacy cookie if present, 
                // but we treat "No Drive Selected" as a distinct state to prompt user.
                setSelectedDriveId(undefined);
            }
        } catch (e) {
            console.error("Failed to list drives", e);
        } finally {
            setIsDrivesLoaded(true);
        }
    };

    // Load files when folder or drive changes
    useEffect(() => {
        if (!open) return;
        if (!isDrivesLoaded) return; // Wait for drives to load before making decisions

        // If we have a selected drive, load from it.
        // If NO drive is selected, we try to load using "System/Legacy" mode.
        // This allows backend Global Cookie to kick in if configured.
        // We do not require legacyCookie to be present on the client side anymore.

        const shouldUseLegacy = !selectedDriveId && drives.length === 0;

        if (selectedDriveId || shouldUseLegacy) {
            loadFiles(currentFolder.id);
        } else {
            setFiles([]);
        }
    }, [open, currentFolder.id, selectedDriveId, legacyCookie, drives.length, isDrivesLoaded]);

    const loadFiles = async (parentId: string) => {
        setLoading(true);
        setIsAccessDenied(false); // Reset denied state on new load attempt
        try {
            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';

            // Determine credentials
            // Priority: Selected Drive ID -> Legacy Cookie

            // Handle virtual system drive ID
            const effectiveDriveId = (selectedDriveId === 'system-drive') ? undefined : selectedDriveId;

            // When using system drive (id undefined), we might fallback to legacy cookie if present
            const effectiveCookie = (!effectiveDriveId ? legacyCookie : undefined);

            const list = await ApiClient.listQuarkFiles(
                parentId,
                effectiveCookie,
                authCode,
                effectiveDriveId
            );

            // Attach driveId to files so it carries over to the playlist
            const listWithDrive = list.map(f => ({ ...f, driveId: selectedDriveId }));
            setFiles(listWithDrive);
            setFiles(listWithDrive);
        } catch (e: any) {
            if (e.message?.includes('system_login_required') || e.message?.includes('403')) {
                // Instead of popping up immediately, we show the lock screen
                setIsAccessDenied(true);
            } else {
                console.error(e);
                toast({
                    variant: 'destructive',
                    title: t('resource_load_failed'),
                    description: e.message
                });
            }
            // Clear files so user sees empty/locked state
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (folder: DriveFile) => {
        setPath(prev => [...prev, { id: folder.id, name: folder.name }]);
        setSearchQuery('');
    };

    const handleBreadcrumbClick = (index: number) => {
        setPath(prev => prev.slice(0, index + 1));
        setSearchQuery('');
    };

    const handleDriveSelect = (id: string) => {
        if (selectedDriveId === id) return;
        setSelectedDriveId(id);
        setPath([{ id: '0', name: 'Root' }]); // Reset path
    };

    const handleAdd = (file: DriveFile) => {
        if (onAdd) onAdd(file);
    };

    const [isCollecting, setIsCollecting] = useState(false);

    const handleAddSeries = async (folder: DriveFile) => {
        if (!onAddSeries) return;
        setIsCollecting(true);
        try {
            const allVideos: DriveFile[] = [];
            const authCode = localStorage.getItem('cueplay_system_auth_code') || '';

            const collectVideos = async (dirId: string, currentPath: string, depth: number) => {
                if (depth > 3) return;
                const list = await ApiClient.listQuarkFiles(
                    dirId,
                    (!selectedDriveId ? legacyCookie : undefined),
                    authCode,
                    selectedDriveId
                );

                for (const item of list) {
                    if (item.type === 'folder') {
                        await collectVideos(item.id, currentPath ? `${currentPath} / ${item.name}` : item.name, depth + 1);
                    } else if (item.mimeType?.startsWith('video/') || item.name.match(/\.(mp4|mkv|avi|flv|mov|wmv)$/i)) {
                        allVideos.push({
                            ...item,
                            name: currentPath ? `${currentPath} / ${item.name}` : item.name,
                            driveId: selectedDriveId
                        });
                    }
                }
            };

            await collectVideos(folder.id, '', 1);

            if (allVideos.length === 0) {
                toast({
                    variant: 'destructive',
                    title: t('no_videos_found'),
                    description: t('no_videos_found_desc')
                });
                return;
            }

            onAddSeries(folder, allVideos);
        } catch (e: any) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: t('resource_load_failed'),
                description: e.message
            });
        } finally {
            setIsCollecting(false);
        }
    };

    const filteredFiles = files.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle>{t('resource_library')}</DialogTitle>
                            <DialogDescription>{t('resource_library_desc')}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar: Drives */}
                    <div className="w-56 border-r flex flex-col bg-muted/10 p-2 gap-1 overflow-y-auto">
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            {t('my_drives')}
                        </div>

                        {drives.length === 0 && !legacyCookie && (
                            <Button variant="outline" className="w-full justify-start text-muted-foreground dashed border-dashed" onClick={() => setDriveManagerOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                {t('add_drive')}
                            </Button>
                        )}

                        {drives.map(drive => (
                            <Button
                                key={drive.id}
                                variant={selectedDriveId === drive.id ? "secondary" : "ghost"}
                                className={cn("w-full justify-start px-2 mb-1", selectedDriveId === drive.id && "bg-accent text-accent-foreground shadow-sm")}
                                onClick={() => handleDriveSelect(drive.id)}
                            >
                                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center mr-2 shrink-0", selectedDriveId === drive.id ? "bg-background" : "bg-primary/10")}>
                                    {drive.avatar ? <img src={drive.avatar} className="h-full w-full rounded-full" /> : <User className="h-3 w-3" />}
                                </div>
                                <span className="truncate">
                                    {drive.isSystem ? (t('global_public_drive') || drive.name) : (drive.name === 'Quark Drive' ? (drive.data?.nickname || t('quark_drive')) : drive.name)}
                                </span>
                            </Button>
                        ))}

                        {/* Legacy Fallback Display */}
                        {drives.length === 0 && legacyCookie && (
                            <Button variant="secondary" className="w-full justify-start px-2">
                                <HardDrive className="h-4 w-4 mr-2" />
                                <span className="truncate">{t('default_drive')}</span>
                            </Button>
                        )}

                        <div className="mt-auto pt-4">
                            <Button variant="outline" className="w-full" onClick={() => setDriveManagerOpen(true)}>
                                {t('manage_accounts')}
                            </Button>
                        </div>
                    </div>

                    {/* Main Content: Files */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Toolbar */}
                        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-4">
                            {/* Breadcrumbs */}
                            <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-hide flex-1 min-w-0 mr-4">
                                {path.map((item, index) => (
                                    <div key={item.id} className="flex items-center text-sm">
                                        {index > 0 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleBreadcrumbClick(index)}
                                            className={`h-8 px-2 ${index === path.length - 1 ? 'font-bold text-foreground' : 'text-muted-foreground font-normal'}`}
                                        >
                                            {item.name === 'Root' ? t('root_folder') : item.name}
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => setShareDialogOpen(true)}
                                >
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    {t('add_link')}
                                </Button>
                                <div className="relative w-40 sm:w-52">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={t('search_files')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-8 pl-8"
                                    />
                                </div>
                                <div className="flex items-center border rounded-md overflow-hidden bg-background">
                                    <Button
                                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className="h-8 w-8 p-0 rounded-none"
                                        onClick={() => setViewMode('grid')}
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className="h-8 w-8 p-0 rounded-none"
                                        onClick={() => setViewMode('list')}
                                    >
                                        <ListIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* File List */}
                        <div className="flex-1 overflow-y-auto p-4 bg-muted/5">
                            {(loading || isCollecting) ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    {isCollecting && <p className="text-sm text-muted-foreground animate-pulse">{t('collecting_episodes')}</p>}
                                </div>
                            ) : isAccessDenied ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-2">
                                        <Lock className="h-8 w-8 opacity-50" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="font-semibold text-lg text-foreground mb-1">{t('access_denied') || 'Access Denied'}</h3>
                                        <p className="text-sm max-w-xs mx-auto mb-4">{t('system_drive_auth_required') || 'This drive requires authorization code to access.'}</p>
                                        <Button onClick={() => setAuthCodeRequired(true)}>
                                            {t('enter_auth_code') || 'Enter Auth Code'}
                                        </Button>
                                    </div>
                                </div>
                            ) : filteredFiles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                    {searchQuery ? (
                                        <p>{t('no_search_results')}</p>
                                    ) : (
                                        <>
                                            <FolderIcon className="h-12 w-12 mb-2 opacity-20" />
                                            <p>{t('empty_folder')}</p>
                                            <Button variant="link" onClick={() => setShareDialogOpen(true)}>
                                                {t('add_quark_share')}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {filteredFiles.map(file => (
                                            <div
                                                key={file.id}
                                                className="group flex flex-col p-3 rounded-lg border border-border/40 bg-card hover:bg-accent/50 hover:border-primary/50 transition-all cursor-pointer relative shadow-sm"
                                                onClick={() => file.type === 'folder' ? handleNavigate(file) : null}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-md ${file.type === 'folder' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                                                        {file.type === 'folder' ? <FolderIcon className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate leading-none mb-1.5" title={file.name}>
                                                            {file.name}
                                                        </p>
                                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                            {file.type !== 'folder' && file.size && <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
                                                            {file.updatedAt && <span>{new Date(file.updatedAt).toLocaleDateString()}</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {file.type === 'file' ? (
                                                    onAdd && (
                                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-lg" onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAdd(file);
                                                            }}>
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )
                                                ) : (
                                                    onAddSeries && (
                                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button size="sm" variant="secondary" className="h-8 px-2 rounded-full shadow-lg text-[10px] font-bold" onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAddSeries(file);
                                                            }}>
                                                                <Plus className="h-3 w-3 mr-1" />
                                                                {t('add_as_series')}
                                                            </Button>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        {filteredFiles.map(file => (
                                            <div
                                                key={file.id}
                                                className="group flex items-center gap-4 p-2 rounded-lg border border-transparent hover:bg-accent/50 hover:border-sidebar-border transition-all cursor-pointer"
                                                onClick={() => file.type === 'folder' ? handleNavigate(file) : null}
                                            >
                                                <div className={`p-1.5 rounded-md ${file.type === 'folder' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                                                    {file.type === 'folder' ? <FolderIcon className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate" title={file.name}>
                                                        {file.name}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-6 text-xs text-muted-foreground whitespace-nowrap min-w-[120px] justify-end">
                                                    <span className="w-16 text-right">
                                                        {file.type !== 'folder' && file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : '-'}
                                                    </span>
                                                    <span className="w-24 text-right">
                                                        {file.updatedAt ? new Date(file.updatedAt).toLocaleDateString() : '-'}
                                                    </span>
                                                </div>

                                                {file.type === 'file' ? (
                                                    onAdd && (
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAdd(file);
                                                        }}>
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    )
                                                ) : (
                                                    onAddSeries && (
                                                        <Button size="sm" variant="ghost" className="h-8 px-2 opacity-0 group-hover:opacity-100 text-[10px] font-bold" onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAddSeries(file);
                                                        }}>
                                                            <Plus className="h-3 w-3 mr-1" />
                                                            {t('add_as_series')}
                                                        </Button>
                                                    )
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>

            <QuarkShareDialog
                open={shareDialogOpen}
                onOpenChange={setShareDialogOpen}
                initialFolderId={currentFolder.id}
                initialFolderName={currentFolder.name}
                onSuccess={() => loadFiles(currentFolder.id)}
            />

            <DriveManager
                open={driveManagerOpen}
                roomId={roomId}
                userId={userId}
                onOpenChange={(open) => {
                    setDriveManagerOpen(open);
                    if (!open) loadDrives(); // Refresh drives on close
                }}
                onSelect={handleDriveSelect}
                initialShowAuthCode={authCodeRequired} // Pass this down? Or just handle locally?
            // DriveManager doesn't expose just the auth dialog easily.
            // Let's create a dedicated simplified AuthCodeDialog or rely on DriveManager to show it.
            // DriveManager has logic to set localStorage.
            />

            {/* Simple Auth Code Prompt if accessed directly */}
            <Dialog open={authCodeRequired} onOpenChange={setAuthCodeRequired}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>{t('system_auth_code_label')}</DialogTitle>
                        <DialogDescription>
                            {t('system_auth_code_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    {/* We can re-use the logic from DriveManager really, but for now duplicate for speed */}
                    <AuthCodeForm
                        onSuccess={() => {
                            setAuthCodeRequired(false);
                            loadFiles(); // Retry loading
                        }}
                        onCancel={() => setAuthCodeRequired(false)}
                    />
                </DialogContent>
            </Dialog>
        </Dialog >
    );
}

// Helper Component for Auth Code Form to avoid duplication if possible, or just inline
function AuthCodeForm({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
    const { t } = useTranslation('common');
    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const { toast } = useToast();

    const handleVerify = async () => {
        if (!code) return;
        setVerifying(true);
        try {
            const result = await ApiClient.verifyAuthCode(code);
            if (result) {
                localStorage.setItem('cueplay_system_auth_code', code);
                toast({ title: t('auth_code_valid') });
                onSuccess();
            } else {
                throw new Error(t('auth_code_invalid'));
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: t('auth_code_invalid'), description: e.message });
        } finally {
            setVerifying(false);
        }
    };

    return (
        <>
            <div className="py-4">
                <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t('system_auth_code_placeholder')}
                    type="password"
                    onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
                <Button onClick={handleVerify} disabled={verifying}>{verifying ? t('verifying') : t('connect')}</Button>
            </div>
        </>
    );
}
