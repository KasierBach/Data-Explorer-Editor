import React from 'react';
import { useAppStore } from '@/core/services/store';
import { DataGrid } from '@/presentation/modules/DataGrid/DataGrid';
import { QueryEditor } from '@/presentation/modules/Query/QueryEditor';
import { TabsBar } from './TabsBar';
import { Dashboard } from '@/presentation/pages/Dashboard';
import { InsightsDashboard } from '@/presentation/modules/Dashboard/InsightsDashboard';
import { VisualizeWorkplace } from '@/presentation/modules/Visualization/VisualizeWorkplace';
const ERDWorkspace = React.lazy(() => import('@/presentation/modules/Visualization/ERDWorkspace').then(m => ({ default: m.ERDWorkspace })));

export const MainContent: React.FC = () => {
    const { tabs, activeTabId } = useAppStore();
    const activeTab = tabs.find(t => t.id === activeTabId);

    return (
        <div className="flex flex-col h-full w-full">
            <TabsBar />

            <div className="flex-1 overflow-hidden relative">
                {tabs.length === 0 ? (
                    <Dashboard />
                ) : (
                    activeTab && (
                        <div className="h-full w-full bg-background">
                            {activeTab.type === 'table' && (
                                <DataGrid key={activeTab.id} tableId={activeTab.metadata?.tableId || activeTab.id} />
                            )}
                            {activeTab.type === 'query' && (
                                <QueryEditor key={activeTab.id} tabId={activeTab.id} />
                            )}
                            {activeTab.type === 'insights' && (
                                <InsightsDashboard
                                    key={activeTab.id}
                                    connectionId={activeTab.metadata?.connectionId}
                                    database={activeTab.metadata?.database}
                                />
                            )}
                            {activeTab.type === 'visualize' && (
                                <VisualizeWorkplace key={activeTab.id} />
                            )}
                            {activeTab.type === 'erd' && (
                                <React.Suspense fallback={<div className="h-full w-full flex flex-col gap-3 items-center justify-center bg-muted/10 animate-pulse text-muted-foreground text-sm font-medium"><div className="w-8 h-8 rounded-full border-2 border-indigo-500/50 border-t-indigo-500 animate-spin" />Loading Visualizer...</div>}>
                                    <ERDWorkspace
                                        key={activeTab.id}
                                        tabId={activeTab.id}
                                        connectionId={activeTab.metadata?.connectionId}
                                        database={activeTab.metadata?.database}
                                    />
                                </React.Suspense>
                            )}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};
