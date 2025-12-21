import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ApiClient, DriveFile } from '@/api/client';
import { FileIcon, FolderIcon, ChevronRight, Loader2, Plus, LayoutGrid, List as ListIcon, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';

interface ResourceLibraryProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cookie?: string;
    onAdd: (file: DriveFile) => void;
}

interface PathItem {
    id: string;
    name: string;
}

export function ResourceLibrary({ open, onOpenChange, cookie, onAdd }: ResourceLibraryProps) {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [path, setPath] = useState<PathItem[]>([{ id: '0', name: 'Root' }]);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    const currentFolder = path[path.length - 1];

    useEffect(() => {
        if (open) {
            loadFiles(currentFolder.id);
        }
    }, [open, currentFolder.id, cookie]);

    const loadFiles = async (parentId: string) => {
        setLoading(true);
        try {
            const list = await ApiClient.listQuarkFiles(parentId, cookie);
            setFiles(list);
        } catch (e: any) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: t('resource_load_failed'),
                description: e.message
            });
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

    const handleAdd = (file: DriveFile) => {
        onAdd(file);
        toast({ title: t('added_to_queue_title'), description: file.name });
    };

    const filteredFiles = files.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>{t('resource_library')}</DialogTitle>
                    <DialogDescription>{t('resource_library_desc')}</DialogDescription>
                </DialogHeader>

                {/* Toolbar: Breadcrumbs + Search + View Toggle */}
                <div className="px-6 py-2 border-b border-border/50 flex items-center justify-between gap-4">
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
                        <div className="relative w-40 sm:w-60">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t('search_files')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 pl-8"
                            />
                        </div>
                        <div className="flex items-center border rounded-md overflow-hidden">
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
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            {searchQuery ? (
                                <p>{t('no_search_results')}</p>
                            ) : (
                                <>
                                    <FolderIcon className="h-12 w-12 mb-2 opacity-20" />
                                    <p>{t('empty_folder')}</p>
                                </>
                            )}
                        </div>
                    ) : (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {filteredFiles.map(file => (
                                    <div
                                        key={file.id}
                                        className="group flex flex-col p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-card/80 hover:border-primary/50 transition-all cursor-pointer relative"
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

                                        {file.type === 'file' && (
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-lg" onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAdd(file);
                                                }}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {filteredFiles.map(file => (
                                    <div
                                        key={file.id}
                                        className="group flex items-center gap-4 p-2 rounded-lg border border-transparent hover:bg-card/80 hover:border-sidebar-border transition-all cursor-pointer"
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

                                        {file.type === 'file' && (
                                            <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={(e) => {
                                                e.stopPropagation();
                                                handleAdd(file);
                                            }}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
