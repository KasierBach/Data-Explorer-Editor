import type { NoSqlPipelineStage } from '@/core/services/store/slices/nosqlSlice';

export const NOSQL_STAGE_TYPES = [
  '$match',
  '$group',
  '$project',
  '$sort',
  '$limit',
  '$skip',
  '$lookup',
  '$unwind',
  '$facet',
  '$addFields',
] as const;

export interface AggregationBuildIssue {
  stageId: string;
  stageIndex: number;
  stageType: string;
  message: string;
}

const DEFAULT_STAGE_VALUE = '{\n  \n}';

function generateStageId() {
  return Math.random().toString(36).slice(2, 11);
}

export function createPipelineStage(
  overrides: Partial<NoSqlPipelineStage> = {},
): NoSqlPipelineStage {
  return {
    id: generateStageId(),
    type: '$match',
    value: DEFAULT_STAGE_VALUE,
    enabled: true,
    ...overrides,
  };
}

export function getPipelineStageSignature(stages: NoSqlPipelineStage[]) {
  return JSON.stringify(
    stages.map((stage) => ({
      type: stage.type,
      value: stage.value,
      enabled: stage.enabled,
    })),
  );
}

export function buildAggregationQuery(
  collection: string | null,
  stages: NoSqlPipelineStage[],
) {
  const issues: AggregationBuildIssue[] = [];
  const pipeline: Record<string, unknown>[] = [];

  stages.forEach((stage, index) => {
    if (!stage.enabled) return;

    try {
      const parsed = JSON.parse(stage.value || '{}') as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Stage body must be a JSON object.');
      }
      pipeline.push({ [stage.type]: parsed });
    } catch {
      issues.push({
        stageId: stage.id,
        stageIndex: index,
        stageType: stage.type,
        message: 'Stage body must be valid JSON object syntax.',
      });
    }
  });

  const payload = {
    action: 'aggregate',
    collection: collection || 'yourCollection',
    pipeline,
  };

  return {
    payload,
    serialized: JSON.stringify(payload, null, 2),
    issues,
  };
}

export function parseAggregationQuery(query: string) {
  try {
    const parsed = JSON.parse(query) as {
      action?: unknown;
      collection?: unknown;
      pipeline?: unknown;
    };

    if (parsed.action !== 'aggregate' || !Array.isArray(parsed.pipeline)) {
      return null;
    }

    const stages = parsed.pipeline
      .map((stage) => {
        if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
          return null;
        }
        const entries = Object.entries(stage);
        if (entries.length !== 1) {
          return null;
        }
        const [type, value] = entries[0];
        return createPipelineStage({
          type,
          value: JSON.stringify(value ?? {}, null, 2),
          enabled: true,
        });
      })
      .filter((stage): stage is NoSqlPipelineStage => Boolean(stage));

    return {
      collection:
        typeof parsed.collection === 'string' ? parsed.collection : null,
      stages: stages.length > 0 ? stages : [createPipelineStage()],
    };
  } catch {
    return null;
  }
}
