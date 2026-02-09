const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getFid() {
    try {
        const room = await prisma.room.findUnique({
            where: { id: 'cjnjmj' }
        });
        if (room && room.media) {
            const media = JSON.parse(room.media);
            console.log("FID:" + (media.id || media.fid));
        } else {
            console.log("NO_MEDIA");
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

getFid();
