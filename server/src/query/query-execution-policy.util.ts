import type { Connection } from '../connections/entities/connection.entity';
import {
  analyzeDestructiveSql,
  containsMultipleStatements,
  getMongoActionFromPayload,
  isMongoActionAllowedOnReadOnly,
  isSqlAllowedOnReadOnly,
} from './query-guard.util';

type QueryExecutionAnalysis = {
  severity: 'low' | 'high';
  keywords: string[];
  affectedObject: string | null;
};

export type QueryExecutionDecision =
  | { kind: 'allow' }
  | {
      kind: 'block';
      reason: string;
      message: string;
      sqlSnippet?: string;
      extra?: Record<string, unknown>;
    }
  | {
      kind: 'confirmation_required';
      message: string;
      sqlSnippet: string;
      analysis: QueryExecutionAnalysis;
    }
  | {
      kind: 'confirmed_destructive';
      sqlSnippet: string;
      analysis: QueryExecutionAnalysis;
    };

type QueryExecutionPolicyInput = Pick<
  Connection,
  'allowQueryExecution' | 'readOnly' | 'type'
> & {
  sql: string;
  confirmed?: boolean;
};

function isMongoConnection(type: Connection['type']): boolean {
  return type === 'mongodb' || type === 'mongodb+srv';
}

function toAnalysis(sql: string): QueryExecutionAnalysis | null {
  const analysis = analyzeDestructiveSql(sql);
  if (!analysis.isDestructive) {
    return null;
  }

  return {
    severity: analysis.severity === 'high' ? 'high' : 'low',
    keywords: analysis.keywords,
    affectedObject: analysis.affectedObject,
  };
}

export function evaluateQueryExecutionPolicy({
  allowQueryExecution,
  readOnly,
  type,
  sql,
  confirmed,
}: QueryExecutionPolicyInput): QueryExecutionDecision {
  if (!allowQueryExecution) {
    return {
      kind: 'block',
      reason: 'QUERY_EXECUTION_DISABLED',
      message: 'Query execution is disabled for this connection.',
    };
  }

  if (!isMongoConnection(type) && containsMultipleStatements(sql)) {
    return {
      kind: 'block',
      reason: 'MULTI_STATEMENT_BLOCKED',
      message:
        'Multi-statement queries are not allowed. Please execute one statement at a time.',
      sqlSnippet: sql.slice(0, 120),
    };
  }

  if (isMongoConnection(type)) {
    const action = getMongoActionFromPayload(sql);
    if (readOnly && !isMongoActionAllowedOnReadOnly(action)) {
      return {
        kind: 'block',
        reason: 'READ_ONLY_CONNECTION',
        message:
          'This connection is read-only. Only read operations are allowed.',
        extra: { mongoAction: action },
      };
    }

    return { kind: 'allow' };
  }

  if (readOnly && !isSqlAllowedOnReadOnly(sql)) {
    return {
      kind: 'block',
      reason: 'READ_ONLY_CONNECTION',
      message: 'This connection is read-only. Only read queries are allowed.',
      sqlSnippet: sql.slice(0, 120),
    };
  }

  if (readOnly) {
    return { kind: 'allow' };
  }

  const analysis = toAnalysis(sql);
  if (!analysis) {
    return { kind: 'allow' };
  }

  if (!confirmed) {
    return {
      kind: 'confirmation_required',
      message: `This query contains destructive operations (${analysis.keywords.join(', ')}). Please confirm to proceed.`,
      sqlSnippet: sql.slice(0, 200),
      analysis,
    };
  }

  return {
    kind: 'confirmed_destructive',
    sqlSnippet: sql.slice(0, 200),
    analysis,
  };
}
