import type { NoSqlPipelineStage } from "@/core/services/store/slices/nosqlSlice";

export const NOSQL_STAGE_TYPES = [
  "$match",
  "$group",
  "$project",
  "$sort",
  "$limit",
  "$skip",
  "$lookup",
  "$unwind",
  "$facet",
  "$addFields",
] as const;

export interface AggregationBuildIssue {
  stageId: string;
  stageIndex: number;
  stageType: string;
  message: string;
}

const DEFAULT_STAGE_VALUES: Record<string, string> = {
  $match: "{\n  \n}",
  $group: '{\n  "_id": "$field",\n  "count": { "$sum": 1 }\n}',
  $project: '{\n  "_id": 0,\n  "field": 1\n}',
  $sort: '{\n  "field": 1\n}',
  $limit: "50",
  $skip: "0",
  $lookup:
    '{\n  "from": "otherCollection",\n  "localField": "fieldId",\n  "foreignField": "_id",\n  "as": "joinedData"\n}',
  $unwind: '"$items"',
  $facet: '{\n  "results": []\n}',
  $addFields: '{\n  "newField": null\n}',
};

const GROUP_ACCUMULATORS = new Set([
  "$accumulator",
  "$addToSet",
  "$avg",
  "$bottom",
  "$bottomN",
  "$count",
  "$first",
  "$firstN",
  "$last",
  "$lastN",
  "$max",
  "$maxN",
  "$median",
  "$mergeObjects",
  "$min",
  "$minN",
  "$percentile",
  "$push",
  "$stdDevPop",
  "$stdDevSamp",
  "$sum",
  "$top",
  "$topN",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateGroupBody(value: unknown): string | null {
  if (!isPlainObject(value)) return "$group must contain a JSON object.";
  if (!Object.prototype.hasOwnProperty.call(value, "_id")) {
    return '$group must define an "_id" grouping expression.';
  }

  for (const [field, expression] of Object.entries(value)) {
    if (field === "_id") continue;
    if (field.startsWith("$")) {
      return `$group output field "${field}" cannot start with $.`;
    }
    if (!isPlainObject(expression)) {
      return `$group field "${field}" must be an accumulator object, for example { "$sum": 1 }.`;
    }
    const operators = Object.keys(expression);
    if (operators.length !== 1 || !GROUP_ACCUMULATORS.has(operators[0])) {
      return `$group field "${field}" must use exactly one accumulator operator.`;
    }
  }

  return null;
}

function validateStageBody(stageType: string, value: unknown): string | null {
  if (stageType === "$group") return validateGroupBody(value);
  if (stageType === "$limit") {
    return Number.isInteger(value) && (value as number) > 0
      ? null
      : "$limit must be a positive integer.";
  }
  if (stageType === "$skip") {
    return Number.isInteger(value) && (value as number) >= 0
      ? null
      : "$skip must be a non-negative integer.";
  }
  if (stageType === "$unwind") {
    if (typeof value === "string" && value.startsWith("$")) return null;
    if (
      isPlainObject(value) &&
      typeof value.path === "string" &&
      value.path.startsWith("$")
    ) {
      return null;
    }
    return '$unwind must be a field path like "$genres" or an options object with a path field.';
  }
  if (stageType === "$sort") {
    if (!isPlainObject(value)) return "$sort must contain a JSON object.";
    const invalidField = Object.entries(value).find(
      ([, direction]) => direction !== 1 && direction !== -1,
    );
    return invalidField
      ? `$sort field "${invalidField[0]}" must use 1 or -1.`
      : null;
  }
  if (stageType === "$lookup") {
    if (!isPlainObject(value)) return "$lookup must contain a JSON object.";
    if (typeof value.from !== "string" || typeof value.as !== "string") {
      return '$lookup must define string fields "from" and "as".';
    }
  }

  return isPlainObject(value) ? null : "Stage body must be a JSON object.";
}

export function getDefaultStageValue(stageType: string) {
  return DEFAULT_STAGE_VALUES[stageType] ?? "{\n  \n}";
}

function generateStageId() {
  return Math.random().toString(36).slice(2, 11);
}

export function createPipelineStage(
  overrides: Partial<NoSqlPipelineStage> = {},
): NoSqlPipelineStage {
  const type = overrides.type ?? "$match";
  return {
    id: generateStageId(),
    type,
    value: overrides.value ?? getDefaultStageValue(type),
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
      const parsed = JSON.parse(stage.value || "{}") as unknown;
      const validationIssue = validateStageBody(stage.type, parsed);
      if (validationIssue) throw new Error(validationIssue);
      pipeline.push({ [stage.type]: parsed });
    } catch (error) {
      issues.push({
        stageId: stage.id,
        stageIndex: index,
        stageType: stage.type,
        message:
          error instanceof SyntaxError
            ? "Stage body must contain valid JSON."
            : error instanceof Error
              ? error.message
              : "Stage body must contain valid JSON.",
      });
    }
  });

  const payload = {
    action: "aggregate",
    collection: collection || "yourCollection",
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

    if (parsed.action !== "aggregate" || !Array.isArray(parsed.pipeline)) {
      return null;
    }

    const stages = parsed.pipeline
      .map((stage) => {
        if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
          return null;
        }
        const entries = Object.entries(stage);
        if (entries.length !== 1) {
          return null;
        }
        const [type, value] = entries[0];
        if (!(NOSQL_STAGE_TYPES as readonly string[]).includes(type)) {
          return null;
        }
        return createPipelineStage({
          type,
          value: JSON.stringify(value ?? {}, null, 2),
          enabled: true,
        });
      })
      .filter((stage): stage is NoSqlPipelineStage => Boolean(stage));

    if (stages.length !== parsed.pipeline.length) {
      return null;
    }

    const collection =
      typeof parsed.collection === "string" ? parsed.collection : null;
    if (buildAggregationQuery(collection, stages).issues.length > 0) {
      return null;
    }

    return {
      collection,
      stages: stages.length > 0 ? stages : [createPipelineStage()],
    };
  } catch {
    return null;
  }
}
