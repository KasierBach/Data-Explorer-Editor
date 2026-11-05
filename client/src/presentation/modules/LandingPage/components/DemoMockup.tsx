import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
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
    const { ref: motionRef, pointerEnabled, running, interaction } = useLandingMotion(isMotionPaused);
    const vi = lang === 'vi';
    const stageRef = useRef<HTMLDivElement>(null);
    const [depthScale, setDepthScale] = useState(0);
    useEffect(() => {
        if (typeof window.matchMedia === 'undefined') return;
        const pointer = window.matchMedia('(min-width: 601px) and (hover: hover) and (pointer: fine)');
        const compact = window.matchMedia('(max-width: 900px)');
        const update = () => setDepthScale(pointer.matches ? (compact.matches ? 0.55 : 1) : 0);
        const frame = window.requestAnimationFrame(update);
        pointer.addEventListener('change', update);
        compact.addEventListener('change', update);
        return () => {
            window.cancelAnimationFrame(frame);
            pointer.removeEventListener('change', update);
            compact.removeEventListener('change', update);
        };
    }, []);
    const depthEnabled = pointerEnabled && depthScale > 0;
    const depthX = useSpring(useMotionValue(0), { stiffness: 90, damping: 18 });
    const depthY = useSpring(useMotionValue(0), { stiffness: 90, damping: 18 });
    const gridX = useTransform(depthX, value => value * 0.45);
    const gridY = useTransform(depthY, value => value * 0.45);
    const haloX = useTransform(depthX, value => value * -0.7);
    const haloY = useTransform(depthY, value => value * -0.7);
    const tilesX = useTransform(depthX, value => value * 0.28);
    const tilesY = useTransform(depthY, value => value * 0.28);
    const setDepth = useCallback((clientX: number, clientY: number, pointerType: string) => {
        if (!depthEnabled || pointerType !== 'mouse' || !stageRef.current) return;
        const box = stageRef.current.getBoundingClientRect();
        const x = Math.max(-0.5, Math.min(0.5, (clientX - box.left) / box.width - 0.5));
        const y = Math.max(-0.5, Math.min(0.5, (clientY - box.top) / box.height - 0.5));
        depthX.set(x * 18 * depthScale);
        depthY.set(y * 14 * depthScale);
    }, [depthX, depthY, depthEnabled, depthScale]);
    const resetDepth = useCallback((immediate = false) => {
        if (immediate) {
            depthX.jump(0);
            depthY.jump(0);
        } else {
            depthX.set(0);
            depthY.set(0);
        }
    }, [depthX, depthY]);
    useEffect(() => {
        if (!depthEnabled) resetDepth(true);
    }, [depthEnabled, resetDepth]);

    return (
        <div
            className="lp-stage-region"
            ref={motionRef}
            data-running={running}
            data-depth-enabled={depthEnabled}
            {...interaction}
            onPointerMove={event => setDepth(event.clientX, event.clientY, event.pointerType)}
            onPointerLeave={() => resetDepth()}
        >
            <div className="lp-product-stage" ref={stageRef}>
                <motion.div className="lp-depth-layer lp-depth-grid" aria-hidden="true" style={{ x: gridX, y: gridY }}><div className="lp-stage-grid" /></motion.div>
                <motion.div className="lp-depth-layer lp-depth-halo" aria-hidden="true" style={{ x: haloX, y: haloY }}><div className="lp-stage-halo" /></motion.div>
                <svg className="lp-data-paths" viewBox="0 0 640 480" preserveAspectRatio="none" fill="none" aria-hidden="true">
                    {[
                        'M62 28C24 38 10 124 58 172',
                        'M574 62C620 76 632 144 582 190',
                        'M68 438C10 422 8 314 58 290',
                        'M557 397C620 382 632 300 582 274',
                    ].map((path, index) => (
                        <g key={path} className={`lp-data-route lp-data-route-${index}`}>
                            <path className="lp-data-route-base" d={path} />
                            <path className="lp-data-packet" d={path} pathLength={100} />
                        </g>
                    ))}
                </svg>
                <motion.div className="lp-depth-layer lp-depth-decoration" aria-hidden="true" style={{ x: tilesX, y: tilesY }}>
                    <div className="lp-stage-decoration" aria-hidden="true">
                        {landingEngines.slice(0, 4).map((engine, index) => (
                            <div key={engine.name} className={`lp-db-tile lp-db-tile-${index}`}>
                                <engine.icon style={{ color: engine.color }} />
                                <span>{engine.name}</span>
                            </div>
                        ))}
                        <span className="lp-stage-badge"><GitGraph className="h-4 w-4" />Schema → Query → Results</span>
                    </div>
                </motion.div>
                <div className="lp-stage-window">
                    <div className="lp-stage-scan" aria-hidden="true" />
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
