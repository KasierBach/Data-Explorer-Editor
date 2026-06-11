import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/services/store';
import { VisualizeWorkplace } from '@/presentation/modules/Visualization/VisualizeWorkplace';
import { NoSqlVisualizeView } from '@/presentation/modules/NoSqlExplorer/NoSqlVisualizeView';
import { ArrowLeft, Database, Loader2, PieChart, Plus, Wifi } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/select';
import { ConnectionDialog } from '@/presentation/modules/Connection/ConnectionDialog';
import { useNoSqlQuery } from '@/presentation/hooks/useNoSqlQuery';

const isNoSqlConnectionType = (type: string) => {
  const normalizedType = type.toLowerCase();
  return normalizedType.includes('mongo') || normalizedType.includes('redis');
};

export function VisualizePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isNoSql = location.pathname.startsWith('/nosql');
  const goBackPath = isNoSql ? '/nosql-explorer' : '/sql-explorer';

  const lang = useAppStore((state) => state.lang);
  const connections = useAppStore((state) => state.connections);
  const openConnectionDialog = useAppStore((state) => state.openConnectionDialog);

  const sqlActiveConnectionId = useAppStore((state) => state.activeConnectionId);
  const setSqlActiveConnectionId = useAppStore((state) => state.setActiveConnectionId);
  const nosqlActiveConnectionId = useAppStore((state) => state.nosqlActiveConnectionId);
  const setNosqlActiveConnectionId = useAppStore((state) => state.setNosqlActiveConnectionId);
  const nosqlActiveCollection = useAppStore((state) => state.nosqlActiveCollection);
  const nosqlResult = useAppStore((state) => state.nosqlResult);
  const { executeMql, isLoading: isLoadingNoSqlSample, error: nosqlVisualizeError } =
    useNoSqlQuery();
  const lastAutoLoadedCollectionRef = useRef<string | null>(null);

  const activeConnectionId = isNoSql ? nosqlActiveConnectionId : sqlActiveConnectionId;
  const setActiveConnectionId = isNoSql
    ? setNosqlActiveConnectionId
    : setSqlActiveConnectionId;

  const filteredConnections = connections.filter((connection) =>
    isNoSql
      ? isNoSqlConnectionType(connection.type)
      : !isNoSqlConnectionType(connection.type),
  );
  const activeConnection = filteredConnections.find(
    (connection) => connection.id === activeConnectionId,
  );
  const hostLabel = lang === 'vi' ? 'cục bộ' : 'local';
  const backLabel = lang === 'vi' ? 'Quay lại' : 'Go Back';
  const autoLoadKey = useMemo(() => {
    if (!isNoSql || !nosqlActiveConnectionId || !nosqlActiveCollection) {
      return null;
    }

    return `${nosqlActiveConnectionId}:${nosqlActiveCollection}`;
  }, [isNoSql, nosqlActiveCollection, nosqlActiveConnectionId]);

  useEffect(() => {
    if (!autoLoadKey) {
      lastAutoLoadedCollectionRef.current = null;
      return;
    }

    if (nosqlResult?.length || isLoadingNoSqlSample) {
      return;
    }

    if (lastAutoLoadedCollectionRef.current === autoLoadKey) {
      return;
    }

    lastAutoLoadedCollectionRef.current = autoLoadKey;
    void executeMql();
  }, [autoLoadKey, executeMql, isLoadingNoSqlSample, nosqlResult]);

  if (filteredConnections.length === 0) {
    return (
      <div className="h-dvh min-h-screen w-full flex items-center justify-center bg-background page-enter">
        <div className="text-center space-y-4">
          <PieChart className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">
            {lang === 'vi'
              ? `Chưa có kết nối ${isNoSql ? 'NoSQL' : 'SQL'}`
              : `No ${isNoSql ? 'NoSQL' : 'SQL'} Connections`}
          </h2>
          <p className="text-muted-foreground">
            {lang === 'vi'
              ? `Thêm kết nối ${isNoSql ? 'MongoDB hoặc Redis' : 'cơ sở dữ liệu SQL'} để bắt đầu trực quan hóa.`
              : `Add a ${isNoSql ? 'MongoDB or Redis' : 'SQL database'} connection to start visualizing.`}
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate(goBackPath)}>
              {backLabel}
            </Button>
            <Button onClick={() => openConnectionDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              {lang === 'vi' ? 'Thêm kết nối' : 'Add Connection'}
            </Button>
          </div>
        </div>
        <ConnectionDialog />
      </div>
    );
  }

  if (!activeConnection) {
    return (
      <div className="h-dvh min-h-screen w-full flex items-center justify-center bg-background page-enter">
        <div className="text-center space-y-4 max-w-sm">
          <Wifi className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold">
            {lang === 'vi'
              ? `Chọn kết nối ${isNoSql ? 'NoSQL' : 'SQL'}`
              : `Select ${isNoSql ? 'NoSQL' : 'SQL'} Connection`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {lang === 'vi'
              ? 'Chọn một kết nối cơ sở dữ liệu để bắt đầu trực quan hóa.'
              : 'Choose a database connection to start visualizing.'}
          </p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
            {filteredConnections.map((connection) => (
              <button
                key={connection.id}
                onClick={() => setActiveConnectionId(connection.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card hover:bg-muted/20 transition-all text-left"
              >
                <Database className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{connection.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {connection.type} - {connection.host || hostLabel}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigate(goBackPath)}
          >
            <ArrowLeft className="w-3 h-3 mr-2" />
            {backLabel}
          </Button>
        </div>
        <ConnectionDialog />
      </div>
    );
  }

  if (isNoSql) {
    if (!nosqlActiveCollection) {
      return (
        <div className="h-dvh min-h-screen w-full flex items-center justify-center bg-background page-enter">
          <div className="max-w-lg text-center space-y-4 px-6">
            <PieChart className="w-12 h-12 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold">
              {lang === 'vi' ? 'Chưa chọn collection' : 'No collection selected'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {lang === 'vi'
                ? 'Mở một collection trong không gian NoSQL trước, rồi chạy query hoặc pipeline để tạo tập dữ liệu cho trang trực quan này.'
                : 'Open a collection in the NoSQL workspace first, then run a query or pipeline to build a result set for this page.'}
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => navigate(goBackPath)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {lang === 'vi' ? 'Về không gian NoSQL' : 'Back to NoSQL workspace'}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (isLoadingNoSqlSample) {
      return (
        <div className="h-dvh min-h-screen w-full flex items-center justify-center bg-background page-enter">
          <div className="max-w-xl text-center space-y-4 px-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold">
              {lang === 'vi'
                ? 'Đang nạp dữ liệu trực quan'
                : 'Loading visualization data'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {lang === 'vi'
                ? `Đang lấy mẫu tài liệu từ collection ${nosqlActiveCollection} để dựng chart đầu tiên.`
                : `Fetching a document sample from ${nosqlActiveCollection} to build the first chart.`}
            </p>
          </div>
        </div>
      );
    }

    if (!nosqlResult?.length) {
      return (
        <div className="h-dvh min-h-screen w-full flex items-center justify-center bg-background page-enter">
          <div className="max-w-xl text-center space-y-4 px-6">
            <PieChart className="w-12 h-12 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold">
              {lang === 'vi'
                ? 'Chưa có dữ liệu để trực quan hóa'
                : 'No results to visualize yet'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {lang === 'vi'
                ? nosqlVisualizeError?.message
                  ? `Không thể nạp dữ liệu mẫu cho ${nosqlActiveCollection}: ${nosqlVisualizeError.message}`
                  : `Collection ${nosqlActiveCollection} chưa có tài liệu phù hợp để dựng chart. Hãy chạy query khác hoặc kiểm tra dữ liệu nguồn.`
                : nosqlVisualizeError?.message
                  ? `Could not load a sample from ${nosqlActiveCollection}: ${nosqlVisualizeError.message}`
                  : `The ${nosqlActiveCollection} collection does not have chart-ready documents yet. Try another query or check the source data.`}
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => void executeMql()}>
                {lang === 'vi' ? 'Thử nạp lại' : 'Retry sample load'}
              </Button>
              <Button variant="outline" onClick={() => navigate(goBackPath)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {lang === 'vi' ? 'Về trình soạn NoSQL' : 'Back to NoSQL editor'}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-dvh min-h-screen w-full bg-background flex flex-col overflow-hidden page-enter">
        <header className="border-b bg-card px-4 py-3 md:px-6 shrink-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => navigate(goBackPath)}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-500/10 p-2 rounded-xl">
                    <PieChart className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold">
                      {lang === 'vi' ? 'Trực quan NoSQL' : 'NoSQL Visualize'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'vi'
                        ? 'Trang riêng để rút insight từ tập kết quả hiện tại, không còn chèn trong MQL editor.'
                        : 'A dedicated page for extracting insight from the current result set without crowding the MQL editor.'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                    {activeConnection.name}
                  </span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-500">
                    {nosqlActiveCollection}
                  </span>
                  <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                    {nosqlResult.length} {lang === 'vi' ? 'tài liệu' : 'documents'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate(goBackPath)}>
                {lang === 'vi' ? 'Về trình soạn NoSQL' : 'Back to NoSQL editor'}
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-sm text-muted-foreground">
              {lang === 'vi'
                ? 'Nếu cần nhóm toàn collection hoặc metric phức tạp hơn, hãy quay về Aggregation Builder, chạy pipeline rồi mở lại trang này.'
                : 'If you need collection-wide grouping or more advanced metrics, go back to the Aggregation Builder, run the pipeline, then return here.'}
            </div>

            <div className="flex min-h-[720px] flex-1 flex-col">
              <NoSqlVisualizeView data={nosqlResult} />
            </div>
          </div>
        </div>
        <ConnectionDialog />
      </div>
    );
  }

  return (
    <div className="h-dvh min-h-screen w-full bg-background flex flex-col overflow-hidden page-enter">
      <header className="h-12 border-b bg-card flex items-center px-3 md:px-4 justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate(goBackPath)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-emerald-500/10 p-1.5 rounded-lg">
              <PieChart className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-sm font-bold hidden sm:inline">
              {lang === 'vi' ? 'Studio trực quan' : 'Chart Studio'}
            </span>
          </div>
          <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
          <Select
            value={activeConnectionId as string}
            onValueChange={(id) => setActiveConnectionId(id)}
          >
            <SelectTrigger className="h-8 w-auto min-w-[100px] sm:min-w-[140px] bg-muted/10 border-border/20 text-xs rounded-lg gap-1 pr-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {filteredConnections.map((connection) => (
                <SelectItem key={connection.id} value={connection.id} className="text-xs">
                  <span className="font-bold">{connection.name}</span>
                  <span className="text-muted-foreground ml-1.5">
                    ({connection.type})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <VisualizeWorkplace />
      </div>
      <ConnectionDialog />
    </div>
  );
}
