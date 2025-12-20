// @ts-nocheck
import { QuarkProvider } from '../packages/playback-core/src/provider/quark';

// Mock fetch globally
global.fetch = async (url, options) => {
    console.log('Fetch called:', url, options);

    if (url.includes('drive-pc.quark.cn')) {
        return {
            ok: true,
            json: async () => ({
                code: 0,
                data: {
                    play_url: 'https://sample.quark.cn/video.m3u8',
                    video_info: {
                        resolution: '1080p'
                    }
                }
            })
        };
    }
    return { ok: false };
};

async function main() {
    const provider = new QuarkProvider();

    console.log('Testing resolvePlayableSource...');
    try {
        const source = await provider.resolvePlayableSource('fake-file-id', {
            cookie: 'fake-cookie'
        });
        console.log('Resolved Source:', source);

        if (source.url === 'https://sample.quark.cn/video.m3u8') {
            console.log('SUCCESS: URL resolved correctly');
        } else {
            console.error('FAILURE: Unexpected URL');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

main();
