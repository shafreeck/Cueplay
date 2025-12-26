import prisma from '../prisma';

interface ServerConfig {
    globalQuarkCookie?: string;
    globalQuarkAuthCode?: string;
    globalQuarkAuthRequired?: string; // Prisma uses string for values typically
}

export class ConfigStore {
    private static cache: ServerConfig = {};

    static async load() {
        try {
            const configs = await prisma.globalConfig.findMany();
            const configObj: any = {};
            configs.forEach(c => {
                configObj[c.key] = c.value;
            });
            this.cache = configObj;
            console.log(`[ConfigStore] Loaded config from DB:`, JSON.stringify(this.cache));
        } catch (e) {
            console.error(`[ConfigStore] Failed to load config from DB:`, e);
            this.cache = {};
        }
    }

    static async save(config: Partial<ServerConfig>) {
        console.log(`[ConfigStore] Saving config:`, JSON.stringify(config));
        this.cache = { ...this.cache, ...config };

        for (const [key, value] of Object.entries(config)) {
            if (value !== undefined) {
                await prisma.globalConfig.upsert({
                    where: { key },
                    update: { value },
                    create: { key, value }
                });
            }
        }
    }

    static getGlobalCookie(): string | undefined {
        return this.cache.globalQuarkCookie;
    }

    static getGlobalAuthCode(): string | undefined {
        return this.cache.globalQuarkAuthCode;
    }

    static isGlobalAuthRequired(): boolean {
        return this.cache.globalQuarkAuthRequired === 'true';
    }
}
