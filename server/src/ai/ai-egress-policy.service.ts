import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ProviderPlan } from './ai.types';

export interface AiEgressContext {
  connectionId?: string;
  organizationId?: string | null;
  database?: string;
}

type Approval = {
  enabled?: boolean;
  providers?: string[];
  origins?: string[];
  databases?: string[];
};
type DeploymentPolicy = Approval & {
  connections?: Record<string, Approval>;
  organizations?: Record<string, Approval>;
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseApproval(value: unknown): Approval | undefined {
  if (!record(value) || typeof value.enabled !== 'boolean') return undefined;
  const approval: Approval = { enabled: value.enabled };
  for (const field of ['providers', 'origins', 'databases'] as const) {
    const entries = value[field];
    if (entries !== undefined) {
      if (
        !Array.isArray(entries) ||
        entries.length > 200 ||
        entries.some((entry) => typeof entry !== 'string' || !entry.trim())
      )
        return undefined;
      approval[field] = entries.map((entry) => entry.trim());
    }
  }
  return approval;
}

@Injectable()
export class AiEgressPolicyService {
  constructor(private readonly config: ConfigService) {}

  private policy(): DeploymentPolicy {
    try {
      const raw: unknown = JSON.parse(
        this.config.get<string>('AI_EGRESS_POLICY_JSON') ?? '{}',
      );
      const approval = parseApproval(raw);
      if (!approval || !record(raw)) return { enabled: false };
      const policy: DeploymentPolicy = { ...approval };
      for (const field of ['connections', 'organizations'] as const) {
        if (raw[field] === undefined) continue;
        if (!record(raw[field])) return { enabled: false };
        const scopes: Record<string, Approval> = {};
        for (const [key, value] of Object.entries(raw[field])) {
          const scope = parseApproval(value);
          if (!scope) return { enabled: false };
          scopes[key] = scope;
        }
        policy[field] = scopes;
      }
      return policy;
    } catch {
      return { enabled: false };
    }
  }

  private denied(
    message = 'AI egress is not approved for this context.',
  ): never {
    throw new ForbiddenException({ reason: 'AI_EGRESS_DENIED', message });
  }

  private approvals(context: AiEgressContext): Approval[] {
    if (this.config.get<string>('AI_KILL_SWITCH') === 'true')
      this.denied('AI processing is disabled by the deployment.');
    const policy = this.policy();
    const approvals: Approval[] = [policy];
    if (context.organizationId) {
      const organization = policy.organizations?.[context.organizationId];
      if (!organization) this.denied();
      approvals.push(organization);
    }
    if (context.connectionId) {
      const connection = policy.connections?.[context.connectionId];
      if (!connection) this.denied();
      approvals.push(connection);
    }
    if (approvals.some((approval) => approval.enabled !== true)) this.denied();
    if (
      approvals.some(
        (approval) =>
          approval.databases !== undefined &&
          (typeof context.database !== 'string' ||
            !context.database.trim() ||
            !approval.databases.includes(context.database)),
      )
    )
      this.denied();
    return approvals;
  }

  assertContext(context: AiEgressContext = {}): void {
    this.approvals(context);
  }

  assertProvider(plan: ProviderPlan, context: AiEgressContext = {}): void {
    const approvals = this.approvals(context);
    const baseUrl =
      plan.provider === 'gemini'
        ? 'https://generativelanguage.googleapis.com'
        : plan.baseUrl;
    if (!baseUrl)
      this.denied('The selected AI provider has no approved destination.');
    let origin: string;
    try {
      const url = new URL(baseUrl);
      if (
        url.username ||
        url.password ||
        (url.protocol !== 'https:' && url.protocol !== 'http:')
      )
        this.denied();
      origin = url.origin;
    } catch {
      this.denied();
    }
    for (const approval of approvals) {
      if (!approval.providers?.includes(plan.provider))
        this.denied('The selected AI provider is not approved.');
      if (!approval.origins?.includes(origin))
        this.denied('The selected AI destination is not approved.');
    }
  }

  beforeProviderAttempt(context: AiEgressContext = {}) {
    return async (plan: ProviderPlan) => this.assertProvider(plan, context);
  }
}
