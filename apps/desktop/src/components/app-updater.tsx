'use client';

import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Loader2, Download, RefreshCw, CheckCircle2, ExternalLink } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast"
import { platform } from '@tauri-apps/plugin-os';
import { open } from '@tauri-apps/plugin-shell';
import { getVersion } from '@tauri-apps/api/app';

interface AndroidUpdateData {
    version: string;
    url: string;
}

export function AppUpdater() {
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'uptodate' | 'error'>('idle');
    const [version, setVersion] = useState('');
    const [progress, setProgress] = useState(0);
    const [updateObj, setUpdateObj] = useState<any>(null);
    const [androidUrl, setAndroidUrl] = useState('');
    const [isAndroid, setIsAndroid] = useState(false);

    useEffect(() => {
        // Safe check for Tauri environment
        if (typeof window !== 'undefined' && '__TAURI__' in window) {
            try {
                const os = platform();
                setIsAndroid(os === 'android');
            } catch (e) {
                console.warn('Failed to detect platform:', e);
            }
        }
    }, []);

    // Simple version comparison: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
    const compareVersions = (v1: string, v2: string) => {
        const p1 = v1.replace(/^v/, '').split('.').map(Number);
        const p2 = v2.replace(/^v/, '').split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    };

    const checkUpdate = async () => {
        setStatus('checking');
        try {
            if (isAndroid) {
                // Android Custom Check
                const currentVer = await getVersion();
                // Fetch latest.json from GitHub Releases (using the same structure as Desktop)
                const res = await fetch('https://api.github.com/repos/shafreeck/Cueplay/releases/latest');
                if (!res.ok) throw new Error('Failed to fetch update info');
                const release = await res.json();

                // GitHub Release API returns 'tag_name' (e.g. "v1.0.1")
                const latestVersion = release.tag_name;

                if (compareVersions(latestVersion, currentVer) > 0) {
                    setVersion(latestVersion);

                    // Find the APK asset dynamically
                    const apkAsset = release.assets.find((asset: any) => asset.name.endsWith('.apk'));

                    if (apkAsset) {
                        setAndroidUrl(apkAsset.browser_download_url);
                    } else {
                        // Fallback if no APK found in assets (maybe just open the release page)
                        setAndroidUrl(release.html_url);
                    }
                    setStatus('available');
                } else {
                    setStatus('uptodate');
                }
            } else {
                // Desktop Native Check
                const update = await check();
                if (update?.available) {
                    setUpdateObj(update);
                    setVersion(update.version);
                    setStatus('available');
                } else {
                    setStatus('uptodate');
                }
            }
        } catch (e: any) {
            console.error("Update check failed", e);
            setStatus('error');
            toast({
                title: t('updater.error_check_failed'),
                description: e.message || String(e),
                variant: "destructive"
            })
        }
    };

    const downloadAndInstall = async () => {
        if (isAndroid) {
            if (androidUrl) {
                await open(androidUrl);
            }
            return;
        }

        if (!updateObj) return;
        setStatus('downloading');
        let downloaded = 0;
        let contentLength = 0;

        try {
            await updateObj.downloadAndInstall((event: any) => {
                switch (event.event) {
                    case 'Started':
                        contentLength = event.data.contentLength || 0;
                        break;
                    case 'Progress':
                        downloaded += event.data.chunkLength;
                        if (contentLength > 0) {
                            setProgress(Math.round((downloaded / contentLength) * 100));
                        }
                        break;
                    case 'Finished':
                        setStatus('downloaded');
                        break;
                }
            });

            setStatus('downloaded');
        } catch (e: any) {
            console.error("Download failed", e);
            setStatus('error');
            toast({
                title: t('updater.download_failed'),
                description: e.message || String(e),
                variant: "destructive"
            })
        }
    };

    const restartApp = async () => {
        await relaunch();
    };


    return (
        <div className="space-y-4 p-0">
            <div className="">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1 mb-3">{t('updater.check_for_updates')}</h3>

                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium">Cueplay {isAndroid ? 'Mobile' : 'Desktop'}</span>
                            <span className="text-xs text-muted-foreground">{t('updater.update_desc')}</span>
                        </div>

                        {status === 'idle' && (
                            <Button variant="outline" size="sm" onClick={checkUpdate}>
                                {t('updater.check_for_updates')}
                            </Button>
                        )}

                        {status === 'checking' && (
                            <Button disabled variant="outline" size="sm">
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                {t('updater.checking')}
                            </Button>
                        )}

                        {status === 'uptodate' && (
                            <Button disabled variant="outline" size="sm" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">
                                <CheckCircle2 className="mr-2 h-3 w-3" />
                                {t('updater.already_latest')}
                            </Button>
                        )}

                        {status === 'available' && (
                            <Button size="sm" onClick={downloadAndInstall}>
                                {isAndroid ? <ExternalLink className="mr-2 h-3 w-3" /> : <Download className="mr-2 h-3 w-3" />}
                                {t('updater.update_available', { version })}
                            </Button>
                        )}

                        {status === 'downloading' && (
                            <Button disabled size="sm">
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                {progress > 0 ? `${progress}%` : t('updater.downloading', { percent: 0 })}
                            </Button>
                        )}

                        {status === 'downloaded' && (
                            <Button size="sm" onClick={restartApp} variant="default">
                                <RefreshCw className="mr-2 h-3 w-3" />
                                {t('updater.install_and_restart')}
                            </Button>
                        )}

                        {status === 'error' && (
                            <Button variant="outline" size="sm" onClick={checkUpdate} className="text-destructive border-destructive/20 hover:bg-destructive/10">
                                {t('retry')}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
