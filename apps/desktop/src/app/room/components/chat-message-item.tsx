'use client';

import { ChatMessage } from '../types';
import { cn } from '@/lib/utils';

interface ChatMessageItemProps {
    message: ChatMessage;
    currentUserId: string | null;
}

export function ChatMessageItem({ message, currentUserId }: ChatMessageItemProps) {
    const isMe = message.senderId === currentUserId;
    const isSystem = message.isSystem;

    if (isSystem) {
        return (
            <div className="flex justify-center my-2">
                <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded-full">
                    {message.content}
                </span>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col", isMe ? 'items-end' : 'items-start')}>
            <div className="flex items-end gap-2 max-w-[85%]">
                {!isMe && (
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] shrink-0 font-bold border border-white/10">
                        {message.senderName?.slice(0, 1).toUpperCase()}
                    </div>
                )}
                <div
                    className={cn(
                        "px-3 py-2 rounded-2xl text-sm break-words shadow-sm",
                        isMe
                            ? 'bg-primary text-primary-foreground rounded-br-none'
                            : 'bg-muted text-foreground rounded-bl-none'
                    )}
                >
                    {message.content}
                </div>
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 px-1 opacity-70">
                {!isMe && <span className="mr-1">{message.senderName}</span>}
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    );
}
