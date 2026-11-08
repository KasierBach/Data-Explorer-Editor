import { createContext, useContext } from 'react';
import type { PublicLanguage } from '@/core/seo/publicRoutes';

interface PublicExperienceState {
    lang: PublicLanguage;
    paused: boolean;
    onToggleMotion?: () => void;
}

export const PublicExperienceContext = createContext<PublicExperienceState>({ lang: 'vi', paused: false });
export const usePublicExperience = () => useContext(PublicExperienceContext);
