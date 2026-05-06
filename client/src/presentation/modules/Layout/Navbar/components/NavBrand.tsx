import React from 'react';
import { Database } from 'lucide-react';

interface NavBrandProps {
    isSmallMobile: boolean;
    onNavigate: (path: string) => void;
}

export const NavBrand: React.FC<NavBrandProps> = ({ isSmallMobile, onNavigate }) => {
    return (
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('/')}>
            <div className="bg-primary/10 p-1.5 rounded-md">
                <Database className="w-5 h-5 text-primary" />
            </div>
            {!isSmallMobile && (
                <div>
                    <h1 className="font-semibold text-sm leading-none">Data Explorer</h1>
                    <span className="text-[10px] text-muted-foreground">v3.4.0</span>
                </div>
            )}
        </div>
    );
};
