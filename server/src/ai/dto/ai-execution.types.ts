export const AI_EXECUTION_TASKS = [
  'generate_sql',
  'optimize_sql',
  'explain_sql',
  'fix_sql',
  'generate_mql',
  'optimize_mql',
  'explain_mql',
  'fix_mql',
  'autocomplete',
  'schema_analysis',
  'chat',
  'provider_discovery',
  'provider_test',
] as const;

export type AiExecutionTask = (typeof AI_EXECUTION_TASKS)[number];
export type AiExecutionFailure = 'failed' | 'cancelled' | 'timed_out';
export type AiExecutionOutcome =
  | 'running'
  | 'succeeded'
  | 'rejected'
  | AiExecutionFailure;
export type AiUsageCoverage = 'complete' | 'partial' | 'unavailable';
export type AiFeedbackRating = 'up' | 'down';

/** Identifiers only. Never pass/persist a request body, SQL, prompt, or key. */
export interface AiExecutionMetadata {
  connectionId?: string;
  database?: string;
  requestedModel?: string;
  /** The effective deadline is capped at 90 seconds from begin. */
  deadlineAt?: number;
}

/** A structural subset of ProviderPlan; credentials and URLs are ignored. */
export interface AiExecutionAttemptPlan {
  provider: string;
  model: string;
}

export interface AiExecutionUsage {
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
}

export interface AiExecutionResultMetadata {
  provider?: string;
  model?: string;
}

export interface AiExecutionAttemptResult extends AiExecutionResultMetadata {
  /** Counts received from the provider only; do not estimate missing counts. */
  usage?: AiExecutionUsage | null;
}

export interface AiExecutionSummary {
  generationId: string;
  outcome: AiExecutionOutcome;
  provider: string | null;
  model: string | null;
  attemptCount: number;
  measuredAttemptCount: number;
  usageCoverage: AiUsageCoverage;
  /** Observed subtotals, NOT an estimate of unknown attempts or a bill. */
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  } | null;
  /** No approved tariff exists in this operational ledger. */
  costCoverage: 'unavailable';
}

export interface AiExecutionAttempt {
  attemptId: string;
  complete(result?: AiExecutionAttemptResult): Promise<void>;
  fail(
    outcome?: AiExecutionFailure,
    result?: AiExecutionAttemptResult,
  ): Promise<void>;
}

/** Server-created capability. Never accept this object from a client. */
export interface AiExecutionContext {
  generationId: string;
  deadlineAt: number;
  /** Call for EVERY actual request, including retries and format fallbacks. */
  beforeAttempt(plan: AiExecutionAttemptPlan): Promise<AiExecutionAttempt>;
  complete(result?: AiExecutionResultMetadata): Promise<AiExecutionSummary>;
  fail(outcome?: AiExecutionFailure): Promise<AiExecutionSummary>;
  /** Always call in finally. It only releases the lease, not the outcome. */
  release(): Promise<void>;
}
