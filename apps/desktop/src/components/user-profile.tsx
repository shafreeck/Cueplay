'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Settings } from 'lucide-react';

export function UserProfile({ userId }: { userId: string }) {
    const [open, setOpen] = useState(false);
    const [displayName, setDisplayName] = useState('');

    useEffect(() => {
        // Load settings
        const storedName = localStorage.getItem('cueplay_nickname') || '';
        setDisplayName(storedName);

        // Onboarding: If no name and userId is available, open dialog
        if (userId && !storedName) {
            setOpen(true);
        }
    }, [userId]);

    const saveDisplayName = (val: string) => {
        setDisplayName(val);
        localStorage.setItem('cueplay_nickname', val);
    };

    // Generate Avatar Color
    const hash = userId.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colors = [
        'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
        'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
        'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
        'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
    ];
    const colorClass = colors[Math.abs(hash) % colors.length] || 'bg-gray-500';
    const initial = (displayName || userId || '?').slice(0, 1).toUpperCase();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden border border-border/50 hover:opacity-80 transition-opacity">
                    <div className={`h-full w-full flex items-center justify-center text-white font-bold ${colorClass}`}>
                        {initial}
                    </div>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Profile Settings</DialogTitle>
                    <DialogDescription>
                        Set your identity and preferences.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="display-name" className="text-right">
                            Display Name
                        </Label>
                        <Input
                            id="display-name"
                            value={displayName}
                            onChange={(e) => saveDisplayName(e.target.value)}
                            placeholder="e.g. Eric"
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-muted-foreground">
                            User ID
                        </Label>
                        <div className="col-span-3 text-xs font-mono text-muted-foreground bg-muted p-2 rounded">
                            {userId}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
