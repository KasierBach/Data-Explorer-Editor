import React from 'react';
import { useAppStore } from '@/core/services/store';
import { LanguageControl } from './LanguageControl';

interface LanguageSwitcherProps {
    touch?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ touch = false }) => {
    const { lang, setLang } = useAppStore();
    return <LanguageControl lang={lang} onChange={setLang} touch={touch} />;
};
