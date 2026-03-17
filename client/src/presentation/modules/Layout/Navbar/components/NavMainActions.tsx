import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { BarChart3, PieChart, GitGraph } from 'lucide-react';

interface NavMainActionsProps {
    activeConnectionId: string | null;
    openInsightsTab: (id: string) => void;
    onNavigate: (path: string) => void;
    lang: string;
}

export const NavMainActions: React.FC<NavMainActionsProps> = ({ 
    activeConnectionId, 
    openInsightsTab, 
    onNavigate, 
    lang 
}) => {
    return (
        <div className="flex items-center gap-1 ml-2">
            <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                onClick={() => activeConnectionId && openInsightsTab(activeConnectionId)}
                disabled={!activeConnectionId}
            >
                <BarChart3 className="w-4 h-4 text-purple-600" />
                <span className="font-semibold">{lang === 'vi' ? 'Chi tiết' : 'Insights'}</span>
            </Button>

            <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                onClick={() => onNavigate('/app/visualize')}
            >
                <PieChart className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold">{lang === 'vi' ? 'Trực quan' : 'Visualize'}</span>
            </Button>

            <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                onClick={() => activeConnectionId && onNavigate('/app/erd')}
                disabled={!activeConnectionId}
            >
                <GitGraph className="w-4 h-4 text-blue-500" />
                <span className="font-semibold">{lang === 'vi' ? 'Sơ đồ' : 'Diagram'}</span>
            </Button>
        </div>
    );
};
