
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCookie() {
    try {
        const config = await prisma.globalConfig.findUnique({
            where: { key: 'globalQuarkCookie' }
        });
        console.log(config ? config.value : 'NO_COOKIE');

        if (!config || !config.value) {
            // Check accounts
            const accountsConfig = await prisma.globalConfig.findUnique({
                where: { key: 'drive_accounts' }
            });
            if (accountsConfig && accountsConfig.value) {
                const accounts = JSON.parse(accountsConfig.value);
                if (accounts.length > 0) {
                    console.log(accounts[0].data.cookie);
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

getCookie();
