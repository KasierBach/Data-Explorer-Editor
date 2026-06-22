import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { BarChart3, PieChart, GitGraph } from 'lucide-react';
import { useAppStore } from '@/core/services/store';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface NavMainActionsProps {
    activeConnectionId: string | null;
    openInsightsTab: (id: string) => void;
    onNavigate: (path: string) => void;
    lang: string;
    isNoSql?: boolean;
}

export const NavMainActions: React.FC<NavMainActionsProps> = ({
    activeConnectionId,
    openInsightsTab,
    onNavigate,
    lang,
    isNoSql
}) => {
    const text = getWorkspaceText(lang).navMainActions;
    const {
        setNosqlViewMode,
        nosqlActiveCollection,
        nosqlActiveConnectionId
    } = useAppStore();

    const currentConnectionId = isNoSql ? nosqlActiveConnectionId : activeConnectionId;

    const handleInsightsClick = () => {
        if (isNoSql) {
            if (nosqlActiveCollection) {
                setNosqlViewMode('schema');
            }
        } else if (activeConnectionId) {
            openInsightsTab(activeConnectionId);
        }
    };

    const handleVisualizeClick = () => {
        if (isNoSql) {
            onNavigate('/nosql-explorer/visualize');
        } else {
            onNavigate('/sql-explorer/visualize');
        }
    };

    return (
        <div className="flex items-center gap-1 ml-2">
            {!isNoSql && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                    onClick={handleInsightsClick}
                    disabled={!activeConnectionId}
                >
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold">{text.insights}</span>
                </Button>
            )}

            <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                onClick={handleVisualizeClick}
                disabled={isNoSql ? !currentConnectionId : false}
            >
                <PieChart className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold">{text.visualize}</span>
            </Button>

            <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:text-foreground gap-1.5 px-3"
                onClick={() => currentConnectionId && onNavigate(isNoSql ? '/nosql-explorer/erd' : '/sql-explorer/erd')}
                disabled={!currentConnectionId}
            >
                <GitGraph className="w-4 h-4 text-blue-500" />
                <span className="font-semibold">{text.diagram}</span>
            </Button>
        </div>
    );
};
