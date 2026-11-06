import React from 'react';
import { useAppStore } from '@/core/services/store';
import { LanguageControl } from './LanguageControl';

interface LanguageSwitcherProps {
    touch?: boolean;
    appearance?: 'default' | 'pill';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ touch = false, appearance = 'default' }) => {
    const { lang, setLang } = useAppStore();
    return <LanguageControl lang={lang} onChange={setLang} touch={touch} appearance={appearance} />;
};
