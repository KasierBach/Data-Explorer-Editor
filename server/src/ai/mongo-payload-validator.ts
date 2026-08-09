const SUPPORTED_AGGREGATION_STAGES = new Set([
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
]);

const GROUP_ACCUMULATORS = new Set([
  '$accumulator',
  '$addToSet',
  '$avg',
  '$bottom',
  '$bottomN',
  '$count',
  '$first',
  '$firstN',
  '$last',
  '$lastN',
  '$max',
  '$maxN',
  '$median',
  '$mergeObjects',
  '$min',
  '$minN',
  '$percentile',
  '$push',
  '$stdDevPop',
  '$stdDevSamp',
  '$sum',
  '$top',
  '$topN',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateObjectStage(
  stageType: string,
  stageBody: unknown,
  stageLabel: string,
): string[] {
  return isPlainObject(stageBody)
    ? []
    : [`${stageLabel} ${stageType} must contain a JSON object.`];
}

function validateGroupStage(stageBody: unknown, stageLabel: string): string[] {
  if (!isPlainObject(stageBody)) {
    return [`${stageLabel} $group must contain a JSON object.`];
  }

  const issues: string[] = [];
  if (!Object.prototype.hasOwnProperty.call(stageBody, '_id')) {
    issues.push(`${stageLabel} $group must define an _id grouping expression.`);
  }

  for (const [field, expression] of Object.entries(stageBody)) {
    if (field === '_id') continue;
    if (field.startsWith('$')) {
      issues.push(
        `${stageLabel} $group output field "${field}" cannot start with $.`,
      );
      continue;
    }
    if (!isPlainObject(expression)) {
      issues.push(
        `${stageLabel} $group field "${field}" must be an accumulator object such as { "$sum": 1 }.`,
      );
      continue;
    }

    const accumulatorKeys = Object.keys(expression);
    if (
      accumulatorKeys.length !== 1 ||
      !GROUP_ACCUMULATORS.has(accumulatorKeys[0])
    ) {
      issues.push(
        `${stageLabel} $group field "${field}" must use exactly one supported accumulator operator.`,
      );
    }
  }

  return issues;
}

function validateSortStage(stageBody: unknown, stageLabel: string): string[] {
  if (!isPlainObject(stageBody)) {
    return [`${stageLabel} $sort must contain a JSON object.`];
  }

  return Object.entries(stageBody).flatMap(([field, direction]) => {
    if (direction === 1 || direction === -1) return [];
    if (
      isPlainObject(direction) &&
      typeof direction.$meta === 'string' &&
      Object.keys(direction).length === 1
    ) {
      return [];
    }
    return [`${stageLabel} $sort field "${field}" must use 1 or -1.`];
  });
}

function validateUnwindStage(stageBody: unknown, stageLabel: string): string[] {
  if (typeof stageBody === 'string' && stageBody.startsWith('$')) return [];
  if (
    isPlainObject(stageBody) &&
    typeof stageBody.path === 'string' &&
    stageBody.path.startsWith('$')
  ) {
    return [];
  }
  return [
    `${stageLabel} $unwind must be a field path like "$genres" or an object with a path field.`,
  ];
}

function validatePipeline(
  pipeline: unknown[],
  prefix = 'Stage',
  requireNonEmpty = true,
): string[] {
  if (requireNonEmpty && pipeline.length === 0) {
    return ['Aggregation pipeline must contain at least one stage.'];
  }

  return pipeline.flatMap((stage, index) => {
    const stageLabel = `${prefix} #${index + 1}`;
    if (!isPlainObject(stage)) {
      return [`${stageLabel} must be a JSON object.`];
    }

    const entries = Object.entries(stage);
    if (entries.length !== 1) {
      return [`${stageLabel} must contain exactly one stage operator.`];
    }

    const [stageType, stageBody] = entries[0];
    if (!SUPPORTED_AGGREGATION_STAGES.has(stageType)) {
      return [`${stageLabel} uses unsupported stage ${stageType}.`];
    }

    switch (stageType) {
      case '$group':
        return validateGroupStage(stageBody, stageLabel);
      case '$sort':
        return validateSortStage(stageBody, stageLabel);
      case '$limit':
        return Number.isInteger(stageBody) && (stageBody as number) > 0
          ? []
          : [`${stageLabel} $limit must be a positive integer.`];
      case '$skip':
        return Number.isInteger(stageBody) && (stageBody as number) >= 0
          ? []
          : [`${stageLabel} $skip must be a non-negative integer.`];
      case '$unwind':
        return validateUnwindStage(stageBody, stageLabel);
      case '$facet': {
        if (!isPlainObject(stageBody)) {
          return [`${stageLabel} $facet must contain a JSON object.`];
        }
        return Object.entries(stageBody).flatMap(([name, nestedPipeline]) =>
          Array.isArray(nestedPipeline)
            ? validatePipeline(
                nestedPipeline,
                `${stageLabel} facet "${name}" stage`,
                false,
              )
            : [`${stageLabel} $facet branch "${name}" must be an array.`],
        );
      }
      default:
        return validateObjectStage(stageType, stageBody, stageLabel);
    }
  });
}

export function validateMongoExecutablePayload(value: unknown): string[] {
  if (!isPlainObject(value)) {
    return ['MongoDB payload must be a JSON object.'];
  }

  if (typeof value.action !== 'string') {
    return ['MongoDB payload must include an action.'];
  }
  if (typeof value.collection !== 'string' || !value.collection.trim()) {
    return ['MongoDB payload must include a collection.'];
  }

  if (value.action !== 'aggregate') return [];
  if (!Array.isArray(value.pipeline)) {
    return ['Aggregation payload must include a pipeline array.'];
  }

  return validatePipeline(value.pipeline);
}

export function validateMongoExecutableCommand(command: string): string[] {
  try {
    return validateMongoExecutablePayload(JSON.parse(command) as unknown);
  } catch {
    return ['MongoDB payload must be valid JSON.'];
  }
}
