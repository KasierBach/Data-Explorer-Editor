import React from 'react';
import { useAppStore } from '@/core/services/store';
import { DataGrid } from '@/presentation/modules/DataGrid/DataGrid';
import { TabsBar } from './TabsBar';
import { Dashboard } from '@/presentation/pages/Dashboard';
import { InsightsDashboard } from '@/presentation/modules/Dashboard/InsightsDashboard';
import { SavedDashboardView } from '@/presentation/modules/Dashboard/SavedDashboardView';
import { VisualizeWorkplace } from '@/presentation/modules/Visualization/VisualizeWorkplace';
import { LoadingState } from '@/presentation/components/shared/LoadingState';
const ERDWorkspace = React.lazy(() => import('@/presentation/modules/Visualization/ERDWorkspace').then(m => ({ default: m.ERDWorkspace })));
const QueryEditor = React.lazy(() => import('@/presentation/modules/Query/QueryEditor').then(m => ({ default: m.QueryEditor })));

export const MainContent: React.FC = () => {
    const { tabs, activeTabId, lang } = useAppStore();
    const activeTab = tabs.find(t => t.id === activeTabId);

    return (
        <div className="flex flex-col h-full w-full">
            <TabsBar />

            <div className="flex-1 overflow-hidden relative">
                {tabs.length === 0 ? (
                    <Dashboard />
                ) : (
                    activeTab && (
                        <>
                            {tabs.filter((tab) => tab.type === 'table' || tab.type === 'query').map((tab) => {
                                const isActive = tab.id === activeTabId;

                                return (
                                    <div key={tab.id} className={isActive ? 'h-full w-full bg-background' : 'hidden'}>
                                        {tab.type === 'table' ? (
                                            <DataGrid tableId={tab.metadata?.tableId || tab.id} tabId={tab.id} isActive={isActive} />
                                        ) : (
                                            <React.Suspense fallback={<LoadingState label={lang === 'vi' ? 'Đang tải trình soạn thảo...' : 'Loading query editor...'} variant="workspace" />}>
                                                <QueryEditor tabId={tab.id} isActive={isActive} />
                                            </React.Suspense>
                                        )}
                                    </div>
                                );
                            })}
                            {activeTab.type !== 'table' && activeTab.type !== 'query' && (
                                <div className="h-full w-full bg-background">
                                    {activeTab.type === 'insights' && (
                                <InsightsDashboard
                                    key={activeTab.id}
                                    connectionId={activeTab.metadata?.connectionId}
                                    database={activeTab.metadata?.database}
                                />
                            )}
                            {activeTab.type === 'dashboard' && (
                                <SavedDashboardView
                                    key={activeTab.id}
                                    dashboardId={activeTab.metadata?.dashboardId || ''}
                                />
                            )}
                            {activeTab.type === 'visualize' && (
                                <VisualizeWorkplace key={activeTab.id} />
                            )}
                            {activeTab.type === 'erd' && (
                                <React.Suspense fallback={<LoadingState label={lang === 'vi' ? 'Đang tải trình trực quan...' : 'Loading visualizer...'} variant="workspace" />}>
                                    <ERDWorkspace
                                        key={activeTab.id}
                                        tabId={activeTab.id}
                                        connectionId={activeTab.metadata?.connectionId || ''}
                                        database={activeTab.metadata?.database}
                                    />
                                </React.Suspense>
                            )}
                                </div>
                            )}
                        </>
                    )
                )}
            </div>
        </div>
    );
};
