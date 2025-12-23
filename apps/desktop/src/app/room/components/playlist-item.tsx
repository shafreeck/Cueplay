'use client';

import { PlaylistItem } from '../types';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, GripVertical, Folder, PlayCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaylistItemProps {
    item: PlaylistItem;
    index: number;
    playingItemId: string | null;
    onPlay: (fileId: string, id: string) => void;
    onRemove: (id: string) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    dragHandleProps?: any;
    isMobile?: boolean;
    level?: number;
}

export function PlaylistItemRenderer({
    item,
    index,
    playingItemId,
    onPlay,
    onRemove,
    isExpanded,
    onToggleExpand,
    dragHandleProps,
    isMobile = false,
    level = 0
}: PlaylistItemProps) {
    const isFolder = item.type === 'folder';
    const playingChild = isFolder ? item.children?.find(c => c.id === playingItemId) : null;
    const isPlaying = item.id === playingItemId || !!playingChild;

    const handlePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) {
            const toPlay = item.children?.find(c => c.id === item.lastPlayedId) || item.children?.[0];
            if (toPlay) onPlay(toPlay.fileId, toPlay.id);
            if (!isExpanded) onToggleExpand();
        } else {
            onPlay(item.fileId, item.id);
        }
    };

    return (
        <div className="select-none mb-1">
            <div
                className={cn(
                    "group flex items-center justify-between p-2 rounded-md border transition-all",
                    isPlaying ? "bg-primary/20 border-primary/50" : "bg-white/5 border-white/5 hover:bg-white/10 active:bg-white/10"
                )}
                style={{ marginLeft: `${level * 16}px` }}
                onClick={(e) => {
                    // On mobile, clicking the row expands folder
                    if (isMobile && isFolder) {
                        onToggleExpand();
                    }
                }}
            >
                {/* Left Side */}
                <div className="flex items-center flex-1 min-w-0 mr-2">
                    {/* Drag Handle (Desktop Only) */}
                    {!isMobile && dragHandleProps && (
                        <div {...dragHandleProps} className="cursor-grab hover:text-foreground text-muted-foreground mr-2 p-1">
                            <GripVertical className="h-4 w-4" />
                        </div>
                    )}

                    {/* Expand/Collapse (Folder) */}
                    {isFolder ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-6 w-6 mr-1", isMobile && "h-8 w-8")}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpand();
                            }}
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                        </Button>
                    ) : (
                        isMobile ? <span className="w-2" /> : null
                    )}

                    {/* Content Info */}
                    <div className="flex flex-col min-w-0 flex-1 ml-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                                {level === 0 ? `#${index + 1}` : ''}
                            </span>
                            {isFolder && <Folder className="h-3.5 w-3.5 text-primary" />}
                            <span className={cn("text-sm font-medium truncate", isMobile && "text-[15px]")} title={item.title || item.fileId}>
                                {item.title || item.fileId}
                            </span>
                        </div>

                        {/* Status / Progress */}
                        {playingChild ? (
                            <div className="text-[10px] text-green-500 font-bold flex items-center gap-1 mt-0.5 animate-in fade-in duration-300 min-w-0">
                                <PlayCircle className="h-3 w-3 shrink-0" />
                                <span className="truncate">Now Playing: {playingChild.title}</span>
                            </div>
                        ) : item.id === playingItemId && (
                            <span className="text-[10px] text-green-500 font-bold flex items-center gap-1 mt-0.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                Playing
                            </span>
                        )}

                        {isFolder && !playingChild && (
                            <span className="text-[10px] text-muted-foreground opacity-70 ml-6 shrink-0">{item.children?.length} episodes</span>
                        )}

                        {/* Progress Bar (Folder) */}
                        {isFolder && item.children && item.children.some(c => c.progress) && (
                            <div className="mt-2 ml-6 h-1 w-full max-w-[150px] bg-white/10 rounded-full overflow-hidden shrink-0">
                                {(() => {
                                    const total = item.children.length;
                                    const currentSum = item.children.reduce((acc, c) => acc + (c.progress && c.duration ? (c.progress / c.duration) : 0), 0);
                                    const avg = total > 0 ? (currentSum / total) * 100 : 0;
                                    return <div className="h-full bg-primary/60 transition-all duration-300" style={{ width: `${avg}%` }} />;
                                })()}
                            </div>
                        )}

                        {/* Progress Bar (File) */}
                        {!isFolder && item.progress && item.duration && (
                            <div className="mt-1.5 h-1 w-full max-w-[100px] bg-white/10 rounded-full overflow-hidden shrink-0">
                                <div className="h-full bg-primary/60 transition-all duration-300" style={{ width: `${(item.progress / item.duration) * 100}%` }} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side Actions */}
                <div className={cn(
                    "flex items-center gap-1 transition-opacity",
                    isMobile ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                )}>
                    <Button
                        size="icon"
                        variant="ghost"
                        className={cn("h-7 w-7", isMobile && "h-9 w-9")}
                        onClick={handlePlay}
                        title={isFolder ? "Play Series" : "Play"}
                    >
                        <PlayCircle className={cn("h-4 w-4", isMobile && "h-5 w-5")} />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className={cn("h-7 w-7 text-destructive hover:text-destructive", isMobile && "h-9 w-9")}
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(item.id);
                        }}
                    >
                        <Trash2 className={cn("h-4 w-4", isMobile && "h-5 w-5")} />
                    </Button>
                </div>
            </div>

            {/* Folder Children rendering (matching desktop) */}
            {isFolder && isExpanded && item.children && (
                <div className="ml-8 mt-1.5 space-y-1 border-l-2 border-white/10 pl-3 animate-in slide-in-from-left-2 duration-200">
                    {item.children.map((child, childIdx) => {
                        const isChildPlaying = child.id === playingItemId;
                        return (
                            <div
                                key={child.id}
                                className={cn(
                                    "flex items-center justify-between p-2 rounded-md text-xs group/child transition-all",
                                    isChildPlaying ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <div className="flex items-center gap-2 min-w-0 mr-2 flex-1">
                                    <span className="font-mono opacity-40 tabular-nums">{index + 1}.{childIdx + 1}</span>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="truncate" title={child.title}>{child.title}</span>
                                        {child.progress && child.duration && (
                                            <div className="mt-1 h-0.5 w-full max-w-[80px] bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary/60 transition-all duration-300" style={{ width: `${(child.progress / child.duration) * 100}%` }} />
                                            </div>
                                        )}
                                    </div>
                                    {isChildPlaying && (
                                        <div className="flex gap-0.5 h-3 items-end pb-0.5">
                                            <div className="w-0.5 bg-primary animate-[music-bar_0.6s_ease-in-out_infinite]" style={{ height: '60%' }}></div>
                                            <div className="w-0.5 bg-primary animate-[music-bar_0.8s_ease-in-out_infinite]" style={{ height: '100%' }}></div>
                                            <div className="w-0.5 bg-primary animate-[music-bar_0.7s_ease-in-out_infinite]" style={{ height: '80%' }}></div>
                                        </div>
                                    )}
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1 transition-opacity",
                                    isMobile ? "opacity-100" : "opacity-100 sm:opacity-0 group-hover/child:opacity-100"
                                )}>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className={cn("h-6 w-6", isMobile && "h-8 w-8")}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPlay(child.fileId, child.id);
                                        }}
                                    >
                                        <PlayCircle className={cn("h-3.5 w-3.5", isMobile && "h-4 w-4")} />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className={cn("h-6 w-6 text-destructive/70 hover:text-destructive", isMobile && "h-8 w-8")}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemove(child.id);
                                        }}
                                    >
                                        <Trash2 className={cn("h-3.5 w-3.5", isMobile && "h-4 w-4")} />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
