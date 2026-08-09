import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu"
import { FileText, LifeBuoy, Github, Cloud, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/core/services/store';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface NavMenusProps {
    lang: string;
    openQueryTab: () => void;
    isSidebarOpen: boolean;
    setSidebarOpen: (v: boolean) => void;
    isNoSql?: boolean;
}

const buildDefaultNoSqlQuery = (collection: string | null) => JSON.stringify({
    action: 'find',
    collection: collection || 'yourCollection',
    filter: {},
    options: {},
    limit: 50,
}, null, 2);

export const NavMenus: React.FC<NavMenusProps> = ({
    lang,
    openQueryTab,
    isSidebarOpen,
    setSidebarOpen,
    isNoSql
}) => {
    const {
        openTab,
        closeAllTabs,
        isResultPanelOpen,
        toggleResultPanel,
        nosqlActiveCollection,
        nosqlMqlQuery,
        nosqlViewMode,
        setNosqlCollection,
        setNosqlMqlQuery,
        setNosqlResult,
        setNosqlViewMode,
    } = useAppStore();
    const text = getWorkspaceText(lang).navMenus;
    const noSqlText = lang === 'vi'
        ? {
            workspace: 'Không gian NoSQL',
            editor: 'Trình soạn MQL',
            results: 'Kết quả NoSQL',
            newQuery: 'MQL mới',
            aggregationBuilder: 'Aggregation Builder',
            closeCollection: 'Đóng collection',
            formatMql: 'Format MQL',
            copyMql: 'Sao chép MQL',
            pasteMql: 'Dán MQL từ clipboard',
            treeView: 'Tree (JSON)',
            gridView: 'Grid',
            schemaView: 'Schema Analysis',
            formatSuccess: 'Đã format MQL',
            copySuccess: 'Đã sao chép MQL',
            pasteSuccess: 'Đã dán MQL từ clipboard',
            invalidJson: 'MQL hiện tại không phải JSON hợp lệ',
            clipboardUnavailable: 'Clipboard không sẵn sàng trong trình duyệt này',
            clipboardReadFailed: 'Không đọc được nội dung clipboard',
            noSqlShortcuts: 'NoSQL shortcuts: Ctrl+I, Ctrl+B, Ctrl+J',
        }
        : {
            workspace: 'NoSQL Workspace',
            editor: 'MQL Editor',
            results: 'NoSQL Results',
            newQuery: 'New MQL Query',
            aggregationBuilder: 'Aggregation Builder',
            closeCollection: 'Close collection',
            formatMql: 'Format MQL',
            copyMql: 'Copy MQL',
            pasteMql: 'Paste MQL from clipboard',
            treeView: 'Tree (JSON)',
            gridView: 'Grid',
            schemaView: 'Schema Analysis',
            formatSuccess: 'MQL formatted',
            copySuccess: 'MQL copied',
            pasteSuccess: 'MQL pasted from clipboard',
            invalidJson: 'Current MQL is not valid JSON',
            clipboardUnavailable: 'Clipboard is not available in this browser',
            clipboardReadFailed: 'Could not read the clipboard',
            noSqlShortcuts: 'NoSQL shortcuts: Ctrl+I, Ctrl+B, Ctrl+J',
        };

    const handleDuplicateTab = () => {
        const state = useAppStore.getState();
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (activeTab) {
            openTab({
                ...activeTab,
                id: `tab-${Date.now()}`,
                title: `${activeTab.title} (Copy)`,
            });
        }
    };

    const handleResetNoSqlQuery = () => {
        setNosqlMqlQuery(buildDefaultNoSqlQuery(nosqlActiveCollection));
        setNosqlResult(null);
        setNosqlViewMode('tree');
    };

    const handleFormatNoSqlQuery = () => {
        try {
            const parsed = JSON.parse(nosqlMqlQuery || '{}');
            setNosqlMqlQuery(JSON.stringify(parsed, null, 2));
            toast.success(noSqlText.formatSuccess);
        } catch {
            toast.error(noSqlText.invalidJson);
        }
    };

    const handleCopyNoSqlQuery = async () => {
        if (!navigator.clipboard?.writeText) {
            toast.error(noSqlText.clipboardUnavailable);
            return;
        }

        await navigator.clipboard.writeText(nosqlMqlQuery || '');
        toast.success(noSqlText.copySuccess);
    };

    const handlePasteNoSqlQuery = async () => {
        if (!navigator.clipboard?.readText) {
            toast.error(noSqlText.clipboardUnavailable);
            return;
        }

        try {
            const clipboardText = await navigator.clipboard.readText();
            setNosqlMqlQuery(clipboardText);
            toast.success(noSqlText.pasteSuccess);
        } catch {
            toast.error(noSqlText.clipboardReadFailed);
        }
    };

    const shortcutFooter = isNoSql ? noSqlText.noSqlShortcuts : text.globalShortcuts;
    const hasActiveNoSqlCollection = Boolean(nosqlActiveCollection);

    return (
        <nav className="flex items-center gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {text.file}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" sideOffset={8} align="start">
                    <DropdownMenuLabel>{isNoSql ? noSqlText.workspace : text.fileOperations}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isNoSql ? (
                        <>
                            <DropdownMenuItem onClick={handleResetNoSqlQuery}>
                                <FileText className="mr-2 h-4 w-4" />
                                <span>{noSqlText.newQuery}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setNosqlViewMode('aggregation')} disabled={!hasActiveNoSqlCollection}>
                                <span>{noSqlText.aggregationBuilder}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setNosqlCollection(null)} className="text-destructive focus:text-destructive" disabled={!hasActiveNoSqlCollection}>
                                <X className="mr-2 h-4 w-4" />
                                <span>{noSqlText.closeCollection}</span>
                            </DropdownMenuItem>
                        </>
                    ) : (
                        <>
                            <DropdownMenuItem onClick={openQueryTab}>
                                <FileText className="mr-2 h-4 w-4" />
                                <span>{text.newQuery}</span>
                                <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDuplicateTab}>
                                <Copy className="mr-2 h-4 w-4" />
                                <span>{text.duplicateTab}</span>
                                <DropdownMenuShortcut>Ctrl+D</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={closeAllTabs} className="text-destructive focus:text-destructive">
                                <X className="mr-2 h-4 w-4" />
                                <span>{text.closeAllTabs}</span>
                                <DropdownMenuShortcut>Ctrl+Shift+W</DropdownMenuShortcut>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {text.edit}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" sideOffset={8} align="start">
                    {isNoSql ? (
                        <>
                            <DropdownMenuLabel>{noSqlText.editor}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleFormatNoSqlQuery}>{noSqlText.formatMql}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleCopyNoSqlQuery()}>{noSqlText.copyMql}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handlePasteNoSqlQuery()}>{noSqlText.pasteMql}</DropdownMenuItem>
                        </>
                    ) : (
                        <>
                            <DropdownMenuItem>{text.undo} <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut></DropdownMenuItem>
                            <DropdownMenuItem>{text.redo} <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut></DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>{text.cut} <DropdownMenuShortcut>Ctrl+X</DropdownMenuShortcut></DropdownMenuItem>
                            <DropdownMenuItem>{text.copy} <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut></DropdownMenuItem>
                            <DropdownMenuItem>{text.paste} <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut></DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {text.view}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" sideOffset={8} align="start">
                    {isNoSql && <DropdownMenuLabel>{noSqlText.results}</DropdownMenuLabel>}
                    <DropdownMenuItem onClick={() => setSidebarOpen(!isSidebarOpen)}>
                        {isSidebarOpen ? text.hideSidebar : text.showSidebar}
                        <DropdownMenuShortcut>Ctrl+B</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleResultPanel}>
                        {isResultPanelOpen ? text.hideResultPanel : text.showResultPanel}
                        <DropdownMenuShortcut>Ctrl+J</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    {isNoSql && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setNosqlViewMode('tree')} disabled={!hasActiveNoSqlCollection || nosqlViewMode === 'tree'}>{noSqlText.treeView}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setNosqlViewMode('grid')} disabled={!hasActiveNoSqlCollection || nosqlViewMode === 'grid'}>{noSqlText.gridView}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setNosqlViewMode('schema')} disabled={!hasActiveNoSqlCollection || nosqlViewMode === 'schema'}>{noSqlText.schemaView}</DropdownMenuItem>
                        </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>{text.toggleFullScreen} <DropdownMenuShortcut>F11</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted">
                        {text.help}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" sideOffset={8} align="start">
                    <DropdownMenuItem className="cursor-pointer" onClick={() => window.open('/docs', '_blank')}>
                        <LifeBuoy className="mr-2 h-4 w-4" />
                        <span>{text.documentation}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => window.open('https://github.com/KasierBach/Data-Explorer-Editor.git', '_blank')}>
                        <Github className="mr-2 h-4 w-4" />
                        <span>GitHub</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                        <Cloud className="mr-2 h-4 w-4" />
                        <span>{text.checkUpdates}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="opacity-50 text-[10px] flex justify-center py-1">
                        {shortcutFooter}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </nav>
    );
};
