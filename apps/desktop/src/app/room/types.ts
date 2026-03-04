
export interface PlaylistItem {
    id: string;
    fileId: string;
    driveId?: string;
    title?: string;
    type?: 'file' | 'folder';
    children?: PlaylistItem[];
    lastPlayedId?: string;
    progress?: number;
    duration?: number;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName?: string;
    content: string;
    timestamp: number;
    isSystem?: boolean;
}
