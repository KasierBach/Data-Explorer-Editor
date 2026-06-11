import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Database,
  Info,
  Loader2,
  RefreshCw,
  SearchCode,
  Zap,
} from 'lucide-react';
import { Badge } from '@/presentation/components/ui/badge';
import { Button } from '@/presentation/components/ui/button';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import { cn } from '@/lib/utils';

interface FieldStat {
  name: string;
  types: Record<string, number>;
  count: number;
  probability: number;
  sampleValues: unknown[];
}

export const NoSqlSchemaAnalysisView: React.FC = () => {
  const {
    nosqlActiveConnectionId,
    nosqlActiveCollection,
    nosqlActiveDatabase,
    setNosqlSchemaStats,
  } = useAppStore();

  const [stats, setStats] = useState<FieldStat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const analyzeSchema = useCallback(
    async (forceRefresh = false) => {
      if (
        !nosqlActiveConnectionId ||
        !nosqlActiveCollection ||
        !nosqlActiveDatabase
      ) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await apiService.post<FieldStat[]>('/nosql/analyze-schema', {
          connectionId: nosqlActiveConnectionId,
          database: nosqlActiveDatabase,
          collection: nosqlActiveCollection,
          sampleSize: 100,
          refresh: forceRefresh,
        });

        setStats(result);
        setNosqlSchemaStats(result);
        setIsCached(!forceRefresh);
      } catch (error) {
        const nextMessage =
          error instanceof Error
            ? error.message
            : 'Failed to analyze schema for this collection.';
        setErrorMessage(nextMessage);
        console.error('Failed to analyze schema:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      nosqlActiveCollection,
      nosqlActiveConnectionId,
      nosqlActiveDatabase,
      setNosqlSchemaStats,
    ],
  );

  useEffect(() => {
    analyzeSchema();
  }, [analyzeSchema]);

  if (!nosqlActiveDatabase || !nosqlActiveCollection) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground">
        <Activity className="h-12 w-12 opacity-30" />
        <div>
          <p className="text-lg font-semibold">Select a database and collection</p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Schema analysis needs an active NoSQL database context before it can
            sample documents.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && stats.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
        <div className="text-center">
          <p className="text-lg font-bold tracking-tight">
            Analyzing Collection Schema...
          </p>
          <p className="text-xs text-muted-foreground">
            Sampling documents from {nosqlActiveDatabase}.{nosqlActiveCollection}
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage && stats.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-5">
          <p className="text-base font-semibold text-destructive">
            Schema analysis failed
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {errorMessage}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => analyzeSchema(true)}
            className="mt-4 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry analysis
          </Button>
        </div>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground opacity-50">
        <Activity className="h-16 w-16" />
        <p className="whitespace-pre-wrap text-lg font-medium tracking-tight">
          No schema data found for this collection.
          {'\n'}
          Run analysis to discover fields.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => analyzeSchema(true)}
          className="mt-2 gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Run Initial Analysis
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 animate-in fade-in duration-700 p-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-500/10 p-2">
            <SearchCode className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              Schema Inference
              {isCached && (
                <Badge className="h-4 gap-1 border-none bg-indigo-500/10 px-1.5 text-[10px] text-indigo-500 hover:bg-indigo-500/20">
                  <Zap className="h-2.5 w-2.5 fill-current" />
                  Redis Cached
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              {nosqlActiveDatabase}.{nosqlActiveCollection}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-2 flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1.5 text-xs">
            <Database className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-medium">{stats.length} Fields Found</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 text-xs"
            onClick={() => analyzeSchema(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh Analysis
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {errorMessage}
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-xl border bg-card/30">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
            <tr className="border-b text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-4">Field Name</th>
              <th className="px-6 py-4">Type Distribution</th>
              <th className="px-6 py-4">Appearance</th>
              <th className="px-6 py-4">Sample Values</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {stats.map((field) => (
              <tr
                key={field.name}
                className="group transition-colors hover:bg-muted/30"
              >
                <td className="px-6 py-4 align-top">
                  <code className="rounded border border-indigo-500/10 bg-indigo-500/5 px-2 py-0.5 font-bold text-indigo-500">
                    {field.name}
                  </code>
                </td>
                <td className="max-w-xs px-6 py-4 align-top">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(field.types).map(([type, count]) => (
                      <Badge
                        key={type}
                        variant="secondary"
                        className={cn(
                          'h-4 text-[9px] font-bold uppercase',
                          type === 'string' &&
                            'border-blue-500/20 bg-blue-500/10 text-blue-500',
                          type === 'number' &&
                            'border-green-500/20 bg-green-500/10 text-green-500',
                          type === 'object' &&
                            'border-orange-500/20 bg-orange-500/10 text-orange-500',
                          type === 'array' &&
                            'border-purple-500/20 bg-purple-500/10 text-purple-500',
                          type === 'null' &&
                            'border-slate-500/20 bg-slate-500/10 text-slate-500',
                        )}
                      >
                        {type} ({Math.round((count / field.count) * 100)}%)
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span
                        className={
                          field.probability === 100
                            ? 'text-green-500'
                            : 'text-amber-500'
                        }
                      >
                        {field.probability.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full transition-all duration-1000',
                          field.probability === 100
                            ? 'bg-green-500'
                            : 'bg-amber-500',
                        )}
                        style={{ width: `${field.probability}%` }}
                      />
                    </div>
                    {field.probability === 100 ? (
                      <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                        Required
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <Info className="h-2.5 w-2.5 text-amber-500" />
                        Optional
                      </span>
                    )}
                  </div>
                </td>
                <td className="max-w-sm overflow-hidden px-6 py-4 align-top">
                  <div className="flex flex-wrap gap-1">
                    {field.sampleValues.map((value, index) => (
                      <span
                        key={index}
                        className="max-w-[150px] truncate rounded bg-muted/40 px-1.5 py-0.5 text-[10px] italic text-muted-foreground"
                      >
                        {typeof value === 'object'
                          ? JSON.stringify(value).slice(0, 30)
                          : String(value)}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
