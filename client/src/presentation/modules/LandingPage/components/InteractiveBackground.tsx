import React from 'react';

export const InteractiveBackground: React.FC = () => {
    return (
        <div className="absolute inset-0 z-0 opacity-20 dark:opacity-30 pointer-events-none overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/30 blur-[120px] animate-gradient-xy" />
            <div className="absolute top-[20%] right-[-10%] w-[40%] h-[50%] rounded-full bg-purple-600/30 blur-[120px] animate-gradient-xy animation-delay-2000" />
            <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-teal-600/20 blur-[120px] animate-gradient-xy animation-delay-4000" />
        </div>
    );
};
