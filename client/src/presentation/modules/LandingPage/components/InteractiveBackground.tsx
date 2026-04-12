import React from 'react';

export const InteractiveBackground: React.FC = () => {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#020617]">
            {/* Ambient Background Gradient (Central Lift) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e293b_0%,transparent_70%)] opacity-30" />

            {/* Grid Pattern - Slightly Brighter */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b33_1px,transparent_1px),linear-gradient(to_bottom,#1e293b33_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_40%,#000_30%,transparent_100%)] opacity-40" />
            
            {/* Main Aesthetic Glows - Higher Opacity */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] bg-blue-600/15 blur-[160px] rounded-[100%] opacity-80" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100%] h-[50%] bg-indigo-900/20 blur-[130px] rounded-[100%] opacity-50" />
            
            {/* Accent Glows */}
            <div className="absolute top-[25%] left-[15%] w-[45%] h-[45%] bg-blue-500/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[25%] right-[15%] w-[35%] h-[35%] bg-purple-600/10 blur-[120px] rounded-full" />

            {/* Grain / Noise for premium feel */}
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'url("/noise.svg")' }} />
        </div>
    );
};
