import prisma from '../prisma';
import { randomUUID } from 'crypto';
import { ConfigStore } from '../config/store';

export interface DriveAccount {
    id: string;
    type: 'quark';
    name: string;
    avatar?: string;
    description?: string;
    data: {
        cookie: string;
        vipType?: string;
        nickname?: string;
    };
    roomId?: string;
    userId?: string;
    isSystem?: boolean;
    isShared?: boolean; // If true, visible to everyone in the room. If false, only visible to creator (userId).
    createdAt: number;
}

export class DriveService {
    private static ACCOUNTS_KEY = 'drive_accounts';
    private static accounts: DriveAccount[] = [];
    private static loaded = false;

    private static async ensureLoaded() {
        if (this.loaded) return;

        try {
            const config = await prisma.globalConfig.findUnique({
                where: { key: this.ACCOUNTS_KEY }
            });

            if (config && config.value) {
                this.accounts = JSON.parse(config.value);
            }
        } catch (e) {
            console.error('[DriveService] Failed to load accounts:', e);
            this.accounts = [];
        } finally {
            // Reload config store to ensure we have latest global settings
            await ConfigStore.load();
            this.loaded = true;
        }
    }

    private static async save() {
        try {
            await prisma.globalConfig.upsert({
                where: { key: this.ACCOUNTS_KEY },
                update: { value: JSON.stringify(this.accounts) },
                create: { key: this.ACCOUNTS_KEY, value: JSON.stringify(this.accounts) }
            });
        } catch (e) {
            console.error('[DriveService] Failed to save accounts:', e);
        }
    }

    static async getAccounts(filter: { roomId?: string; userId?: string; isSystem?: boolean } = {}): Promise<DriveAccount[]> {
        await this.ensureLoaded();

        if (filter.isSystem) {
            // Explicitly requesting system drives
            const systemDrives = this.accounts.filter(a => a.isSystem || (!a.roomId && !a.userId && !a.isSystem));

            // Check for legacy global cookie and inject as virtual system drive
            const globalCookie = ConfigStore.getGlobalCookie();
            if (globalCookie) {
                // Ensure we don't duplicate if it's already converted to a real drive (naive check by cookie value)
                // Actually, if we have a real drive with this cookie, we should prefer the real drive.
                const exists = systemDrives.some(a => a.data.cookie === globalCookie);
                if (!exists) {
                    systemDrives.push({
                        id: 'system-virtual-legacy',
                        type: 'quark',
                        name: 'Global Public Drive',
                        isSystem: true,
                        isShared: true,
                        createdAt: Date.now(),
                        data: { cookie: globalCookie, nickname: 'Global Shared' }
                    });
                }
            }
            return systemDrives;
        }

        let accounts: DriveAccount[] = [];

        // 1. System Drives (Global fallback)
        // 1. System Drives (Global fallback)
        const systemDrives = this.accounts.filter(a => a.isSystem);

        // Inject virtual global drive here too
        // Inject virtual global drive here too
        const globalCookie = ConfigStore.getGlobalCookie();
        if (globalCookie) {
            const exists = systemDrives.some(a => a.data.cookie === globalCookie);
            if (!exists) {
                systemDrives.push({
                    id: 'system-virtual-legacy',
                    type: 'quark',
                    name: 'Global Public Drive',
                    isSystem: true,
                    isShared: true,
                    createdAt: Date.now(),
                    data: { cookie: globalCookie, nickname: 'Global Shared' }
                });
            }
        }

        accounts = accounts.concat(systemDrives);

        // 2. User Drives (Personal, available in any room user is in)
        if (filter.userId) {
            const userDrives = this.accounts.filter(a => a.userId === filter.userId);
            accounts = accounts.concat(userDrives);
        }

        // 3. Room Drives (Shared drives in this room OR private drives in this room owned by this user)
        // If a drive is in a room, but isShared=false, it should only be seen if userId matches.
        // However, "User Drives" logic (step 2) already adds ALL drives belonging to userId.
        // So here we only need to add drives that are SHARED and NOT already added (i.e. owned by others).
        if (filter.roomId) {
            const roomDrives = this.accounts.filter(a =>
                a.roomId === filter.roomId &&
                (a.isShared || (filter.userId && a.userId === filter.userId))
            );
            accounts = accounts.concat(roomDrives);
        }

        // 4. Legacy/Global fallback (drives with no room, no user, not system - backward compat)
        // If strict mode, maybe we strictly require "isSystem" for global?
        // For backward compatibility, treat existing "orphaned" drives as User drives if they lack ID?
        // Or keep current behavior: if no params, return global?
        // Let's keep logic: if no filter provided, return NOTHING (or just system).
        // But previously getAccounts({}) returned globals.
        // Let's maintain: global drives (no roomId/userId/isSystem) are considered "Legacy Global".
        const legacyGlobals = this.accounts.filter(a => !a.roomId && !a.userId && !a.isSystem);
        accounts = accounts.concat(legacyGlobals);

        // Deduplicate by ID
        const seen = new Set();
        return accounts.filter(a => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
    }

    static async getAccount(id: string): Promise<DriveAccount | undefined> {
        await this.ensureLoaded();
        await this.ensureLoaded();
        const account = this.accounts.find(a => a.id === id);
        if (account) return account;

        // Check virtual legacy
        if (id === 'system-virtual-legacy') {
            const globalCookie = ConfigStore.getGlobalCookie();
            if (globalCookie) {
                return {
                    id: 'system-virtual-legacy',
                    type: 'quark',
                    name: 'Global Public Drive',
                    isSystem: true,
                    isShared: true,
                    createdAt: Date.now(),
                    data: { cookie: globalCookie, nickname: 'Global Shared' }
                };
            }
        }
        return undefined;
    }

    static async addAccount(account: Omit<DriveAccount, 'id' | 'createdAt'>): Promise<DriveAccount> {
        await this.ensureLoaded();

        // Deduplicate by cookie AND scope to prevent merging System/User/Room drives
        // Only update if the scope matches exactly.
        const existingIndex = this.accounts.findIndex(a =>
            a.data.cookie === account.data.cookie &&
            a.userId === account.userId &&
            a.roomId === account.roomId &&
            !!a.isSystem === !!account.isSystem &&
            !!a.isShared === !!account.isShared
        );

        if (existingIndex >= 0) {
            const existing = this.accounts[existingIndex];
            // Update metadata
            const updated: DriveAccount = {
                ...existing,
                ...account,
                id: existing.id, // Keep ID
                createdAt: existing.createdAt
            };
            this.accounts[existingIndex] = updated;
            await this.save();
            return updated;
        }

        const newAccount: DriveAccount = {
            ...account,
            id: randomUUID(),
            createdAt: Date.now()
        };

        this.accounts.push(newAccount);
        await this.save();
        return newAccount;
    }

    static async removeAccount(id: string) {
        await this.ensureLoaded();
        this.accounts = this.accounts.filter(a => a.id !== id);
        await this.save();
    }

    static async updateAccount(id: string, data: { cookie?: string; nickname?: string; avatar?: string; isShared?: boolean }): Promise<DriveAccount> {
        await this.ensureLoaded();
        const index = this.accounts.findIndex(a => a.id === id);
        if (index === -1) {
            throw new Error('Drive not found');
        }

        const existing = this.accounts[index];
        const updated: DriveAccount = {
            ...existing,
            avatar: data.avatar || existing.avatar,
            isShared: data.isShared !== undefined ? data.isShared : existing.isShared,
            data: {
                ...existing.data,
                cookie: data.cookie || existing.data.cookie,
                nickname: data.nickname || existing.data.nickname
            }
        };

        this.accounts[index] = updated;
        await this.save();
        return updated;
    }

    static async renameAccount(id: string, name: string): Promise<DriveAccount> {
        await this.ensureLoaded();
        const index = this.accounts.findIndex(a => a.id === id);
        if (index === -1) {
            throw new Error('Drive not found');
        }

        const existing = this.accounts[index];
        const updated: DriveAccount = {
            ...existing,
            name // Update name
        };

        this.accounts[index] = updated;
        await this.save();
        return updated;
    }

    // Helper to get cookie for a drive ID
    static async getCookieForDrive(driveId: string): Promise<string | undefined> {
        const account = await this.getAccount(driveId);
        return account?.data.cookie;
    }
}
