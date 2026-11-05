import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from '@/presentation/components/shared/LanguageSwitcher';
import { LandingHeaderView } from '@/presentation/public/LandingHeaderView';

interface LandingHeaderProps {
    lang: string;
    isAuthenticated: boolean;
    logout: () => void | Promise<void>;
    isMobileNavOpen: boolean;
    setIsMobileNavOpen: (open: boolean) => void;
    hideSectionLinks?: boolean;
    appearance?: 'default' | 'landing';
}

export const LandingHeader: React.FC<LandingHeaderProps> = props => {
    const navigate = useNavigate();
    const logout = async () => { await props.logout(); navigate('/login'); };
    return <LandingHeaderView {...props} logout={logout} navigate={navigate} language={<LanguageSwitcher touch={props.appearance === 'landing'} />} />;
};
