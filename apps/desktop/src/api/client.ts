import { API_BASE } from './config';

export interface Room {
    id: string;
    ownerId: string;
    members: any[];
    title?: string;
    description?: string;
}

// ... imports

export interface DriveAccount {
    id: string;
    type: string;
    name: string;
    avatar?: string;
    description?: string;
    data?: {
        nickname?: string;
        cookie?: string;
    };
    roomId?: string;
    userId?: string;
    isSystem?: boolean;
    isShared?: boolean;
}

export interface DriveFile {
    id: string;
    name: string;
    type: 'folder' | 'file';
    mimeType?: string;
    size?: number;
    updatedAt?: number;
    thumbnail?: string;
    driveId?: string;
}

export class ApiClient {
    static async listQuarkFiles(parentId: string = '0', cookie?: string, authCode?: string, driveId?: string): Promise<DriveFile[]> {
        const params = new URLSearchParams({ parentId });
        if (cookie) params.append('cookie', cookie);
        if (authCode) params.append('authCode', authCode);
        if (driveId) params.append('driveId', driveId);

        const res = await fetch(`${API_BASE}/quark/list?${params.toString()}`);
        if (!res.ok) {
            const err = await res.json();
            if (err.error === 'No cookie provided and no global cookie set') {
                console.warn(err.error);
                return [];
            }
            throw new Error(err.error || 'Failed to list files');
        }
        const data = await res.json();
        return data.list;
    }

    // --- Drive Management ---
    static async listDrives(roomId?: string, userId?: string): Promise<DriveAccount[]> {
        const params = new URLSearchParams();
        if (roomId) params.append('roomId', roomId);

        const headers: Record<string, string> = {};
        if (userId) headers['x-user-id'] = userId;

        const res = await fetch(`${API_BASE}/drive/list?${params.toString()}`, { headers });
        if (!res.ok) throw new Error('Failed to list drives');
        const data = await res.json();
        return data.accounts;
    }

    static async addDrive(cookie: string, name?: string, roomId?: string, userId?: string, isSystem?: boolean, isShared?: boolean): Promise<DriveAccount> {
        const res = await fetch(`${API_BASE}/drive/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie, name, roomId, userId, isSystem, isShared }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to add drive');
        }
        const data = await res.json();
        return data.account;
    }

    static async removeDrive(id: string): Promise<void> {
        const res = await fetch(`${API_BASE}/drive/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error('Failed to remove drive');
    }

    static async renameDrive(id: string, name: string): Promise<void> {
        const res = await fetch(`${API_BASE}/drive/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name }),
        });
        if (!res.ok) throw new Error('Failed to rename drive');
    }

    static async updateDrive(id: string, cookie?: string, isShared?: boolean): Promise<void> {
        const res = await fetch(`${API_BASE}/drive/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, cookie, isShared }),
        });
        if (!res.ok) throw new Error('Failed to update drive');
    }


    static async verifyAuthCode(authCode: string): Promise<boolean> {
        const params = new URLSearchParams({ authCode });
        const res = await fetch(`${API_BASE}/quark/auth/verify?${params.toString()}`);
        return res.ok;
    }

    static async getGlobalAuthRequired(): Promise<boolean> {
        const res = await fetch(`${API_BASE}/admin/config/auth-required`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
        });
        if (!res.ok) return true; // Default to safe
        const data = await res.json();
        return data.required;
    }

    static async setGlobalAuthRequired(required: boolean): Promise<void> {
        const res = await fetch(`${API_BASE}/admin/config/auth-required`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({ required }),
        });
        if (!res.ok) throw new Error('Failed to update toggle');
    }

    static async listRooms(userId: string): Promise<Room[]> {
        const res = await fetch(`${API_BASE}/rooms?userId=${userId}`);
        if (!res.ok) throw new Error('Failed to list rooms');
        const data = await res.json();
        return data.rooms;
    }

    static async createRoom(userId: string): Promise<Room> {
        const res = await fetch(`${API_BASE}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });
        if (!res.ok) throw new Error('Failed to create room');
        const data = await res.json();
        return data.room;
    }

    static async updateRoom(id: string, userId: string, data: { title?: string, description?: string }): Promise<Room> {
        const res = await fetch(`${API_BASE}/rooms/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, ...data }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to update room');
        }
        const resData = await res.json();
        return resData.room;
    }

    static async deleteRoom(id: string, userId: string): Promise<void> {
        const res = await fetch(`${API_BASE}/rooms/${id}?userId=${userId}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to delete room');
        }
    }

    static async grantLease(deviceId: string): Promise<{ id: string, expiresAt: number }> {
        const res = await fetch(`${API_BASE}/leases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId }),
        });
        if (!res.ok) throw new Error('Failed to grant lease');
        const data = await res.json();
        return data.lease;
    }

    static async resolveVideo(fileId: string, roomId?: string, authCode?: string, driveId?: string): Promise<any> {
        const res = await fetch(`${API_BASE}/playback/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, roomId, authCode, driveId }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to resolve video');
        }
        const data = await res.json();
        return { source: data.source, cookie: data.cookie };
    }

    static async saveUserCookie(userId: string, cookie: string): Promise<void> {
        const res = await fetch(`${API_BASE}/users/${userId}/cookie`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookie }),
        });
        if (!res.ok) throw new Error('Failed to save user cookie');
    }

    static async saveQuarkShare(shareLink: string, passCode?: string, targetDirId?: string): Promise<void> {
        const res = await fetch(`${API_BASE}/quark/share/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shareLink, passCode, targetDirId }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to save share link');
        }
    }

    static async getUserCookie(userId: string): Promise<string | null> {
        const res = await fetch(`${API_BASE}/users/${userId}/cookie`);
        if (!res.ok) throw new Error('Failed to get user cookie');
        const data = await res.json();
        return data.cookie;
    }
}
