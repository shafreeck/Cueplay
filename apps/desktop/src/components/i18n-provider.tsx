'use client';

import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { useEffect, useState } from 'react';

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Client-side only detection to avoid hydration mismatch
        const savedLng = localStorage.getItem('i18nextLng');
        const systemLng = navigator.language;
        // Default to English if not detected as Chinese (startWith zh)
        // Since i18n is initialized with 'en', we only need to switch if needed
        const targetLng = savedLng || (systemLng.startsWith('zh') ? 'zh' : 'en');

        if (targetLng !== i18n.language) {
            i18n.changeLanguage(targetLng);
        }

        // Persist language changes
        const handleLanguageChange = (lng: string) => {
            localStorage.setItem('i18nextLng', lng);
        };
        i18n.on('languageChanged', handleLanguageChange);
        return () => {
            i18n.off('languageChanged', handleLanguageChange);
        };
    }, []);

    if (!mounted) {
        // Return children as is on server/first render to avoid hydration mismatch
        // The translations will kick in after mount
        // Or we can return null to avoid flash of untranslated content, but standard practice for client-only i18n
        // usually tolerates a quick flash or defaults to fallback language.
        // Given 'output: export', we are mostly SPA.
        return <>{children}</>;
    }

    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
