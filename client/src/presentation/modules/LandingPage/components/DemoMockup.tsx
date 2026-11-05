import React from 'react';
import { Database, GitGraph, Pause, Play } from 'lucide-react';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { LandingScreenshot } from './LandingScreenshot';
import { landingEngines } from '../landingEngines';
import { useLandingMotion } from '../hooks/useLandingMotion';

interface DemoMockupProps {
    lang: string;
    isMotionPaused?: boolean;
    onToggleMotion?: () => void;
}

export const DemoMockup: React.FC<DemoMockupProps> = ({ lang, isMotionPaused = false, onToggleMotion }) => {
    const images = getWorkspaceText(lang).landingImages;
    const { ref: motionRef, running, interaction } = useLandingMotion(isMotionPaused);
    const vi = lang === 'vi';

    return (
        <div className="lp-stage-region" ref={motionRef} data-running={running} {...interaction}>
            <div className="lp-product-stage">
                <div className="lp-stage-grid" aria-hidden="true" />
                <div className="lp-stage-halo" aria-hidden="true" />
                <svg className="lp-data-paths" viewBox="0 0 640 480" fill="none" aria-hidden="true">
                    <path d="M62 82C62 178 214 95 265 190" />
                    <path d="M574 92C526 150 482 86 382 190" />
                    <path d="M68 397C119 343 180 437 251 314" />
                    <path d="M557 389C506 314 423 418 378 305" />
                </svg>
                <div className="lp-stage-decoration" aria-hidden="true">
                    {landingEngines.slice(0, 4).map((engine, index) => (
                        <div key={engine.name} className={`lp-db-tile lp-db-tile-${index}`}>
                            <engine.icon style={{ color: engine.color }} />
                            <span>{engine.name}</span>
                        </div>
                    ))}
                    <span className="lp-stage-badge"><GitGraph className="h-4 w-4" />Schema → Query → Results</span>
                </div>
                <div className="lp-stage-window">
                    <div className="lp-stage-window-bar">
                        <span className="lp-window-dots" aria-hidden="true"><i /><i /><i /></span>
                        <span><Database className="h-3 w-3" aria-hidden="true" />Data Explorer</span>
                        <span>SQL + NoSQL</span>
                    </div>
                    <LandingScreenshot src="/images/landing/workspace.webp" alt={images.heroWorkspace} lang={lang} priority />
                </div>
            </div>
            <div className="lp-stage-toolbar">
                <span>{vi ? 'Giao diện thật · Dữ liệu demo' : 'Actual interface · Demo data'}</span>
                {onToggleMotion && (
                    <button type="button" className="lp-motion-control" aria-pressed={isMotionPaused} onClick={onToggleMotion}>
                        {isMotionPaused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
                        {isMotionPaused ? (vi ? 'Bật chuyển động' : 'Enable motion') : (vi ? 'Tạm dừng chuyển động' : 'Pause motion')}
                    </button>
                )}
            </div>
        </div>
    );
};
