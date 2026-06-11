import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Info,
  Loader2,
  RefreshCw,
  Search,
  SearchCode,
  Zap,
} from 'lucide-react';
import { Badge } from '@/presentation/components/ui/badge';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
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

type SchemaHealthFilter =
  | 'all'
  | 'required'
  | 'optional'
  | 'mixed'
  | 'sparse';

const SCHEMA_SAMPLE_SIZE = 100;

const getSortedTypes = (field: FieldStat) =>
  Object.entries(field.types).sort((left, right) => right[1] - left[1]);

const isMixedTypeField = (field: FieldStat) => getSortedTypes(field).length > 1;

const isSparseField = (field: FieldStat) => field.probability < 50;

const getHealthState = (
  field: FieldStat,
): Exclude<SchemaHealthFilter, 'all'> => {
  if (isMixedTypeField(field)) {
    return 'mixed';
  }

  if (isSparseField(field)) {
    return 'sparse';
  }

  if (field.probability < 100) {
    return 'optional';
  }

  return 'required';
};

const getFieldPriority = (field: FieldStat) => {
  const typePenalty = isMixedTypeField(field) ? 120 : 0;
  const coveragePenalty = 100 - field.probability;
  return typePenalty + coveragePenalty;
};

export const NoSqlSchemaAnalysisView: React.FC = () => {
  const {
    nosqlActiveConnectionId,
    nosqlActiveCollection,
    nosqlActiveDatabase,
    setNosqlSchemaStats,
    lang,
  } = useAppStore();

  const [stats, setStats] = useState<FieldStat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<SchemaHealthFilter>('all');

  const isVietnamese = lang === 'vi';

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
          sampleSize: SCHEMA_SAMPLE_SIZE,
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

  const overview = useMemo(() => {
    const requiredFields = stats.filter((field) => field.probability === 100).length;
    const mixedTypeFields = stats.filter(isMixedTypeField).length;
    const sparseFields = stats.filter(isSparseField).length;
    const optionalFields = stats.length - requiredFields;
    const lowestCoverageField =
      [...stats].sort(
        (left, right) =>
          left.probability - right.probability ||
          getFieldPriority(right) - getFieldPriority(left) ||
          left.name.localeCompare(right.name),
      )[0] ?? null;

    const dominantTypeCounts = stats.reduce<Record<string, number>>((acc, field) => {
      const primaryType = getSortedTypes(field)[0]?.[0];
      if (!primaryType) {
        return acc;
      }

      acc[primaryType] = (acc[primaryType] || 0) + 1;
      return acc;
    }, {});

    const dominantType =
      Object.entries(dominantTypeCounts).sort((left, right) => right[1] - left[1])[0]
        ?.[0] ?? null;

    return {
      requiredFields,
      mixedTypeFields,
      sparseFields,
      optionalFields,
      lowestCoverageField,
      dominantType,
    };
  }, [stats]);

  const filterOptions = useMemo(
    () => [
      {
        id: 'all' as const,
        label: isVietnamese ? 'Tất cả' : 'All fields',
        count: stats.length,
      },
      {
        id: 'mixed' as const,
        label: isVietnamese ? 'Nhiều kiểu' : 'Mixed types',
        count: stats.filter(isMixedTypeField).length,
      },
      {
        id: 'sparse' as const,
        label: isVietnamese ? 'Thưa dữ liệu' : 'Sparse',
        count: stats.filter(isSparseField).length,
      },
      {
        id: 'optional' as const,
        label: isVietnamese ? 'Không bắt buộc' : 'Optional',
        count: stats.filter((field) => field.probability < 100).length,
      },
      {
        id: 'required' as const,
        label: isVietnamese ? 'Ổn định' : 'Required',
        count: stats.filter((field) => field.probability === 100).length,
      },
    ],
    [isVietnamese, stats],
  );

  const filteredStats = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...stats]
      .sort(
        (left, right) =>
          getFieldPriority(right) - getFieldPriority(left) ||
          right.count - left.count ||
          left.name.localeCompare(right.name),
      )
      .filter((field) => {
        if (!normalizedSearch) {
          return true;
        }

        return field.name.toLowerCase().includes(normalizedSearch);
      })
      .filter((field) => {
        if (activeFilter === 'all') {
          return true;
        }

        return getHealthState(field) === activeFilter;
      });
  }, [activeFilter, searchTerm, stats]);

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

      <div className="grid gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-blue-500/15 bg-blue-500/5 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/80">
            <Database className="h-4 w-4 text-blue-400" />
            {isVietnamese ? 'Tổng quan field' : 'Field inventory'}
          </div>
          <div className="mt-4 text-3xl font-bold text-foreground">{stats.length}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            {isVietnamese
              ? 'Field đang được suy luận trong collection hiện tại.'
              : 'Fields inferred from the current collection sample.'}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {isVietnamese ? 'Field ổn định' : 'Required fields'}
          </div>
          <div className="mt-4 text-3xl font-bold text-foreground">
            {overview.requiredFields}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {isVietnamese
              ? 'Xuất hiện trong mọi document đã lấy mẫu.'
              : 'Present in every sampled document.'}
          </p>
        </div>

        <div className="rounded-2xl border border-fuchsia-500/15 bg-fuchsia-500/5 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-200/80">
            <AlertTriangle className="h-4 w-4 text-fuchsia-400" />
            {isVietnamese ? 'Field nhiều kiểu' : 'Mixed-type fields'}
          </div>
          <div className="mt-4 text-3xl font-bold text-foreground">
            {overview.mixedTypeFields}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {isVietnamese
              ? 'Nên kiểm tra trước khi viết aggregate hoặc AI query.'
              : 'Review these before writing aggregations or AI-generated queries.'}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            <Info className="h-4 w-4 text-amber-400" />
            {isVietnamese ? 'Field thưa' : 'Sparse fields'}
          </div>
          <div className="mt-4 text-3xl font-bold text-foreground">
            {overview.sparseFields}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {isVietnamese
              ? 'Xuất hiện dưới 50% trong mẫu hiện tại.'
              : 'Appearing in less than 50% of the current sample.'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-500/15 bg-gradient-to-r from-indigo-500/10 via-card/80 to-card/80 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isVietnamese
                ? 'Tóm tắt collection trước khi đi sâu vào từng field'
                : 'Collection-level summary before drilling into individual fields'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isVietnamese
                ? 'Kiểu trải nghiệm này thực dụng hơn cho NoSQL: nhìn nhanh field ổn định, field lệch kiểu và field thưa trước khi viết MQL.'
                : 'This keeps the NoSQL workflow practical: spot stable fields, type drift, and sparse paths before writing more MQL.'}
            </p>
          </div>
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={
                isVietnamese
                  ? 'Tìm field theo tên...'
                  : 'Search fields by name...'
              }
              className="pl-9 text-xs"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="border-none bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-200 hover:bg-indigo-500/20">
            {isVietnamese
              ? `Mẫu tối đa ${SCHEMA_SAMPLE_SIZE} document`
              : `Sampling up to ${SCHEMA_SAMPLE_SIZE} documents`}
          </Badge>
          {overview.dominantType && (
            <Badge className="border-none bg-blue-500/10 px-2 py-1 text-[10px] text-blue-200 hover:bg-blue-500/20">
              {isVietnamese
                ? `Kiểu trội: ${overview.dominantType}`
                : `Dominant field type: ${overview.dominantType}`}
            </Badge>
          )}
          {overview.lowestCoverageField && (
            <Badge className="border-none bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100 hover:bg-amber-500/20">
              {isVietnamese
                ? `Field cần chú ý: ${overview.lowestCoverageField.name} (${overview.lowestCoverageField.probability.toFixed(0)}%)`
                : `Coverage gap: ${overview.lowestCoverageField.name} (${overview.lowestCoverageField.probability.toFixed(0)}%)`}
            </Badge>
          )}
          {overview.optionalFields > 0 && (
            <Badge className="border-none bg-slate-500/10 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-500/20">
              {isVietnamese
                ? `${overview.optionalFields} field không xuất hiện đủ mẫu`
                : `${overview.optionalFields} fields do not appear across the full sample`}
            </Badge>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option.id}
              variant={activeFilter === option.id ? 'secondary' : 'outline'}
              size="sm"
              className={cn(
                'h-8 gap-2 rounded-full px-3 text-[11px]',
                activeFilter === option.id && 'border-indigo-500/20 bg-indigo-500/10 text-indigo-100',
              )}
              onClick={() => setActiveFilter(option.id)}
            >
              <span>{option.label}</span>
              <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {option.count}
              </span>
            </Button>
          ))}

          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3 text-[11px]"
              onClick={() => setSearchTerm('')}
            >
              {isVietnamese ? 'Xóa tìm kiếm' : 'Clear search'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border bg-card/30">
        {filteredStats.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
            <SearchCode className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isVietnamese
                  ? 'Không có field nào khớp bộ lọc hiện tại.'
                  : 'No fields match the current filter.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isVietnamese
                  ? 'Thử đổi bộ lọc hoặc xóa từ khóa tìm kiếm để xem lại toàn bộ schema.'
                  : 'Try another filter or clear the search term to inspect the full schema again.'}
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
              <tr className="border-b text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-4">
                  {isVietnamese ? 'Field' : 'Field name'}
                </th>
                <th className="px-6 py-4">
                  {isVietnamese ? 'Mức độ' : 'Health'}
                </th>
                <th className="px-6 py-4">
                  {isVietnamese ? 'Phân bố kiểu' : 'Type distribution'}
                </th>
                <th className="px-6 py-4">
                  {isVietnamese ? 'Độ phủ' : 'Appearance'}
                </th>
                <th className="px-6 py-4">
                  {isVietnamese ? 'Ví dụ giá trị' : 'Sample values'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredStats.map((field) => {
                const healthState = getHealthState(field);
                const sortedTypes = getSortedTypes(field);

                return (
                  <tr
                    key={field.name}
                    className="group transition-colors hover:bg-muted/30"
                  >
                    <td className="px-6 py-4 align-top">
                      <code className="rounded border border-indigo-500/10 bg-indigo-500/5 px-2 py-0.5 font-bold text-indigo-500">
                        {field.name}
                      </code>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex max-w-[180px] flex-col gap-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'w-fit border text-[10px] font-semibold uppercase',
                            healthState === 'required' &&
                              'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
                            healthState === 'optional' &&
                              'border-sky-500/20 bg-sky-500/10 text-sky-300',
                            healthState === 'sparse' &&
                              'border-amber-500/20 bg-amber-500/10 text-amber-300',
                            healthState === 'mixed' &&
                              'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300',
                          )}
                        >
                          {healthState === 'required'
                            ? isVietnamese
                              ? 'Ổn định'
                              : 'Required'
                            : healthState === 'optional'
                              ? isVietnamese
                                ? 'Thiếu một phần'
                                : 'Optional'
                              : healthState === 'sparse'
                                ? isVietnamese
                                  ? 'Thưa dữ liệu'
                                  : 'Sparse'
                                : isVietnamese
                                  ? 'Lệch kiểu'
                                  : 'Mixed types'}
                        </Badge>
                        <p className="text-[11px] leading-5 text-muted-foreground">
                          {healthState === 'required'
                            ? isVietnamese
                              ? 'Xuất hiện đều trong toàn bộ mẫu.'
                              : 'Appears consistently across the sample.'
                            : healthState === 'optional'
                              ? isVietnamese
                                ? 'Thiếu ở một phần document.'
                                : 'Missing from some sampled documents.'
                              : healthState === 'sparse'
                                ? isVietnamese
                                  ? 'Hiếm gặp, nên cẩn thận khi group/filter.'
                                  : 'Rarely populated, so grouping and filtering need care.'
                                : isVietnamese
                                  ? 'Có nhiều BSON type trong cùng field.'
                                  : 'Multiple BSON types detected for the same field.'}
                        </p>
                      </div>
                    </td>
                    <td className="max-w-xs px-6 py-4 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {sortedTypes.map(([type, count]) => (
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
                            {type} ({Math.round((count / Math.max(field.count, 1)) * 100)}%)
                          </Badge>
                        ))}
                      </div>
                      {sortedTypes[0] && (
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {isVietnamese
                            ? `Kiểu chính: ${sortedTypes[0][0]}`
                            : `Primary type: ${sortedTypes[0][0]}`}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span
                            className={cn(
                              field.probability === 100
                                ? 'text-green-500'
                                : field.probability < 50
                                  ? 'text-amber-400'
                                  : 'text-sky-400',
                            )}
                          >
                            {field.probability.toFixed(0)}%
                          </span>
                          <span className="text-muted-foreground">
                            {field.count}/{SCHEMA_SAMPLE_SIZE}
                          </span>
                        </div>
                        <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full transition-all duration-1000',
                              field.probability === 100
                                ? 'bg-green-500'
                                : field.probability < 50
                                  ? 'bg-amber-500'
                                  : 'bg-sky-500',
                            )}
                            style={{ width: `${field.probability}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {isVietnamese
                            ? `Có mặt trong ${field.count} document mẫu`
                            : `Present in ${field.count} sampled documents`}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-sm overflow-hidden px-6 py-4 align-top">
                      <div className="flex flex-wrap gap-1">
                        {field.sampleValues.length === 0 ? (
                          <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] italic text-muted-foreground">
                            {isVietnamese ? 'Không có mẫu' : 'No samples'}
                          </span>
                        ) : (
                          field.sampleValues.map((value, index) => (
                            <span
                              key={index}
                              className="max-w-[180px] truncate rounded bg-muted/40 px-1.5 py-0.5 text-[10px] italic text-muted-foreground"
                            >
                              {typeof value === 'object'
                                ? JSON.stringify(value).slice(0, 36)
                                : String(value)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
