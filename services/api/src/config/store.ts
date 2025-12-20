import prisma from '../prisma';

interface ServerConfig {
    globalQuarkCookie?: string;
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
            console.log(`[ConfigStore] Loaded config from DB`);
        } catch (e) {
            console.error(`[ConfigStore] Failed to load config from DB:`, e);
            this.cache = {};
        }
    }

    static async save(config: Partial<ServerConfig>) {
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
}
