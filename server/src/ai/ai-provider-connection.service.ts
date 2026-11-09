import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptAttribute, encryptAttribute } from '../utils/crypto.util';
import {
  AiProviderTransportError,
  fetchAiProvider,
  readAiProviderJson,
  validateAiProviderUrl,
} from './ai-provider-transport';
import { AiEgressPolicyService } from './ai-egress-policy.service';
import { normalizeProviderBaseUrl } from './ai-url.util';
import type { AiProviderOverride } from './ai.types';
import {
  AiAccountPolicyService,
  isAiDisabledError,
} from './ai-account-policy.service';
import type { SaveAiProviderConnectionDto } from './dto/ai-provider-connection.dto';
import {
  AiExecutionLedgerService,
  type AiExecutionContext,
  type AiExecutionFailure,
  type AiExecutionTask,
  type AiExecutionUsage,
} from './ai-execution-ledger.service';
import { isAiHttpFatalError, runAiLedgerOperation } from './ai-http-execution';
import {
  AiRequestStoppedError,
  assertAiRequestActive,
  createAiRequestScope,
  waitForAiResult,
} from './ai-request-lifecycle';
import type { ProviderPlan } from './ai.types';

type ProviderDeadline = ReturnType<typeof createAiRequestScope>;

type ProviderCapabilities = { vision?: boolean; document?: boolean };
type PublicProviderRecord = {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string | null;
  model: string;
  models: string[];
  capabilities: Prisma.JsonValue;
  lastTestedAt: Date | null;
  lastStatus: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const PUBLIC_SELECT = {
  id: true,
  name: true,
  type: true,
  baseUrl: true,
  model: true,
  models: true,
  capabilities: true,
  apiKey: true,
  lastTestedAt: true,
  lastStatus: true,
  lastError: true,
  lastLatencyMs: true,
  createdAt: true,
  updatedAt: true,
} as const;

const PROVIDER_RESPONSE_BYTES = 512 * 1024;
const PROVIDER_TIMEOUT_MS = 15_000;
const MAX_MODEL_IDS = 200;
const MAX_MODEL_ID_LENGTH = 255;

function providerRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function providerModelIds(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > MAX_MODEL_IDS ||
    value.some(
      (id) =>
        typeof id !== 'string' ||
        !id.trim() ||
        id.length > MAX_MODEL_ID_LENGTH ||
        Array.from(id).some((character) => {
          const code = character.charCodeAt(0);
          return code <= 31 || code === 127;
        }),
    )
  ) {
    throw new BadRequestException('Provider returned invalid model IDs');
  }
  return Array.from(new Set((value as string[]).map((id) => id.trim())));
}

function providerFailure(error: unknown, fallback: string): string {
  return error instanceof AiProviderTransportError ? error.message : fallback;
}

function providerDeadline() {
  return createAiRequestScope({ timeoutMs: PROVIDER_TIMEOUT_MS });
}

function providerOutcome(
  error: unknown,
  deadline: ProviderDeadline,
): AiExecutionFailure {
  const reason = deadline.signal.aborted ? deadline.signal.reason : error;
  if (
    (reason instanceof AiRequestStoppedError &&
      reason.reason === 'AI_REQUEST_TIMEOUT') ||
    (reason instanceof AiProviderTransportError && reason.code === 'TIMEOUT') ||
    Date.now() >= deadline.deadlineAt
  )
    return 'timed_out';
  if (
    deadline.signal.aborted ||
    (reason instanceof Error && reason.name === 'AbortError')
  )
    return 'cancelled';
  return 'failed';
}

function providerUsage(payload: unknown): AiExecutionUsage | null {
  if (!providerRecord(payload) || !providerRecord(payload.usage)) return null;
  const counts = payload.usage;
  const counter = (value: unknown) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
      ? value
      : undefined;
  const usage = {
    promptTokens: counter(counts.prompt_tokens),
    completionTokens: counter(counts.completion_tokens),
    totalTokens: counter(counts.total_tokens),
  };
  return Object.values(usage).some((value) => value !== undefined)
    ? usage
    : null;
}

@Injectable()
export class AiProviderConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountPolicy: AiAccountPolicyService,
    @Optional()
    private readonly egressPolicy: AiEgressPolicyService = new AiEgressPolicyService(
      new ConfigService(),
    ),
    @Optional()
    private readonly ledger?: AiExecutionLedgerService,
  ) {}

  async list(userId: string) {
    const providers = await this.prisma.aiProviderConnection.findMany({
      where: { userId },
      select: PUBLIC_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
    return providers.map((provider) => this.toPublic(provider));
  }

  async create(userId: string, dto: SaveAiProviderConnectionDto) {
    const data = await this.normalizeInput(dto, true);
    const provider = await this.prisma.aiProviderConnection.create({
      data: { ...data, userId },
      select: PUBLIC_SELECT,
    });
    return this.toPublic(provider);
  }

  async update(userId: string, id: string, dto: SaveAiProviderConnectionDto) {
    await this.requireOwned(userId, id);
    const data = await this.normalizeInput(dto, false);
    const provider = await this.prisma.aiProviderConnection.update({
      where: { id },
      data,
      select: PUBLIC_SELECT,
    });
    return this.toPublic(provider);
  }

  async remove(userId: string, id: string) {
    await this.requireOwned(userId, id);
    await this.prisma.aiProviderConnection.delete({ where: { id } });
    return { success: true };
  }

  private async assertRecipient(
    userId: string,
    plan: ProviderPlan,
    deadline: ProviderDeadline,
  ) {
    assertAiRequestActive(deadline);
    this.egressPolicy.assertProvider(plan);
    await waitForAiResult(
      this.accountPolicy.assertEnabled(userId),
      deadline.signal,
    );
    assertAiRequestActive(deadline);
    this.egressPolicy.assertProvider(plan);
  }

  private async ledgerOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await runAiLedgerOperation(operation);
    } catch (error) {
      // Operational cap/lease denials must not become an optional discovery
      // failure followed by an unreserved test POST.
      if (error instanceof Error)
        Object.assign(error, { aiRequestFatal: true });
      throw error;
    }
  }

  private async runProviderOperation<T>(
    userId: string,
    task: AiExecutionTask,
    plan: ProviderPlan,
    operation: (
      execution: AiExecutionContext,
      deadline: ProviderDeadline,
    ) => Promise<T>,
  ): Promise<T> {
    const deadline = providerDeadline();
    let execution: AiExecutionContext | undefined;
    let settled = false;
    try {
      await this.assertRecipient(userId, plan, deadline);
      if (!this.ledger)
        throw new ServiceUnavailableException(
          'AI execution storage is unavailable.',
        );
      // Persistence is not raced: a late reservation must remain owned so it
      // can be failed/released rather than leak a lease after the deadline.
      execution = await this.ledgerOperation(() =>
        this.ledger!.begin(userId, task, {
          requestedModel: plan.model,
          deadlineAt: deadline.deadlineAt,
        }),
      );
      assertAiRequestActive(deadline);
      const result = await operation(execution, deadline);
      assertAiRequestActive(deadline);
      const summary = await this.ledgerOperation(() =>
        execution!.complete({ provider: plan.provider, model: plan.model }),
      );
      settled = true;
      if (summary.outcome !== 'succeeded')
        throw new ServiceUnavailableException(
          'AI execution was not durably completed.',
        );
      assertAiRequestActive(deadline);
      return result;
    } catch (error) {
      if (execution && !settled) {
        settled = true;
        await this.ledgerOperation(() =>
          execution!.fail(providerOutcome(error, deadline)),
        );
      }
      throw error;
    } finally {
      deadline.abort();
      try {
        if (execution) await this.ledgerOperation(() => execution!.release());
      } finally {
        deadline.dispose();
      }
    }
  }

  private async requestProviderJson<T>(
    userId: string,
    plan: ProviderPlan,
    path: string,
    apiKey: string | undefined,
    execution: AiExecutionContext,
    deadline: ProviderDeadline,
    decode: (payload: unknown) => T,
    body?: string,
  ): Promise<T> {
    await this.assertRecipient(userId, plan, deadline);
    const requestUrl = await this.safeUrl(plan.baseUrl!, path);
    assertAiRequestActive(deadline);
    const identity = { provider: plan.provider, model: plan.model };
    const attempt = await this.ledgerOperation(() =>
      execution.beforeAttempt(identity),
    );
    let settled = false;
    let usage: AiExecutionUsage | null = null;
    let response: Response | undefined;
    try {
      await this.assertRecipient(userId, plan, deadline);
      response = await waitForAiResult(
        fetchAiProvider(
          requestUrl,
          {
            method: body === undefined ? 'GET' : 'POST',
            headers: this.headers(apiKey),
            signal: deadline.signal,
            redirect: 'manual',
            ...(body === undefined ? {} : { body }),
          },
          {
            timeoutMs: Math.max(1, Math.ceil(deadline.deadlineAt - Date.now())),
            maxRequestBytes: 16 * 1024,
            maxResponseBytes: PROVIDER_RESPONSE_BYTES,
            beforeDispatch: () => this.assertRecipient(userId, plan, deadline),
          },
        ),
        deadline.signal,
      );
      const payload = await waitForAiResult(
        readAiProviderJson(response, PROVIDER_RESPONSE_BYTES),
        deadline.signal,
      );
      assertAiRequestActive(deadline);
      if (!response.ok)
        throw new BadRequestException(`Provider returned ${response.status}`);
      // Discovery is not token generation. Missing provider counters remain
      // unavailable; never estimate or attach error-body counters as usage.
      usage = body === undefined ? null : providerUsage(payload);
      const result = decode(payload);
      assertAiRequestActive(deadline);
      settled = true;
      await this.ledgerOperation(() =>
        attempt.complete({ ...identity, usage }),
      );
      assertAiRequestActive(deadline);
      return result;
    } catch (error) {
      if (!settled) {
        settled = true;
        await this.ledgerOperation(() =>
          attempt.fail(providerOutcome(error, deadline), {
            ...identity,
            usage,
          }),
        );
      }
      throw error;
    } finally {
      if (response?.body && !response.body.locked) {
        void response.body.cancel().catch(() => undefined);
      }
    }
  }

  private async readModelList(
    baseUrl: string,
    apiKey: string | undefined,
    userId: string,
    execution: AiExecutionContext,
    deadline: ProviderDeadline,
  ) {
    return this.requestProviderJson(
      userId,
      { provider: 'custom', model: 'discovery', baseUrl },
      'models',
      apiKey,
      execution,
      deadline,
      (payload) => {
        if (
          !providerRecord(payload) ||
          !Array.isArray(payload.data) ||
          payload.data.length > MAX_MODEL_IDS
        ) {
          throw new BadRequestException('Provider returned invalid model IDs');
        }
        const ids = payload.data.map((item: unknown) =>
          providerRecord(item) ? item.id : undefined,
        );
        return providerModelIds(ids).sort((left, right) =>
          left.localeCompare(right),
        );
      },
    );
  }

  async listModels(
    baseUrl: string,
    apiKey: string | undefined,
    userId: string,
  ) {
    try {
      return await this.runProviderOperation(
        userId,
        'provider_discovery',
        { provider: 'custom', model: 'discovery', baseUrl },
        (execution, deadline) =>
          this.readModelList(baseUrl, apiKey, userId, execution, deadline),
      );
    } catch (error) {
      if (
        isAiDisabledError(error) ||
        error instanceof ForbiddenException ||
        isAiHttpFatalError(error)
      )
        throw error;
      throw new BadRequestException(
        providerFailure(error, 'Provider discovery failed'),
      );
    }
  }

  async test(userId: string, id?: string, input?: SaveAiProviderConnectionDto) {
    await this.accountPolicy.assertEnabled(userId);
    const source = id ? await this.getSecretSource(userId, id) : null;
    const baseUrl = input?.baseUrl || source?.baseUrl || '';
    const model = input?.model || source?.model || '';
    if (!baseUrl || !model)
      throw new BadRequestException('Base URL and model are required');
    const plan = { provider: 'custom' as const, model, baseUrl };
    this.egressPolicy.assertProvider(plan);
    const apiKey =
      input?.apiKey?.trim() ||
      (source?.apiKey ? decryptAttribute(source.apiKey) : '');
    const startedAt = Date.now();
    let models: string[] = [];
    let modelDiscoveryError: string | null = null;
    let error: string | null = null;
    try {
      await this.runProviderOperation(
        userId,
        'provider_test',
        plan,
        async (execution, deadline) => {
          try {
            models = await this.readModelList(
              baseUrl,
              apiKey,
              userId,
              execution,
              deadline,
            );
          } catch (caught) {
            if (
              isAiDisabledError(caught) ||
              caught instanceof ForbiddenException ||
              isAiHttpFatalError(caught) ||
              deadline.signal.aborted
            )
              throw caught;
            modelDiscoveryError = providerFailure(
              caught,
              'Model discovery failed',
            );
          }
          assertAiRequestActive(deadline);
          await this.requestProviderJson(
            userId,
            plan,
            'chat/completions',
            apiKey,
            execution,
            deadline,
            (payload) => {
              const content = (
                payload as {
                  choices?: Array<{ message?: { content?: unknown } }>;
                } | null
              )?.choices?.[0]?.message?.content;
              if (typeof content !== 'string' || !content.trim())
                throw new BadRequestException(
                  'Provider returned an empty chat response',
                );
            },
            JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Reply with OK.' }],
              temperature: 0,
              max_tokens: 8,
            }),
          );
        },
      );
    } catch (caught) {
      if (
        isAiDisabledError(caught) ||
        caught instanceof ForbiddenException ||
        isAiHttpFatalError(caught)
      )
        throw caught;
      error = this.redact(
        providerFailure(caught, 'Provider test failed'),
        apiKey,
      );
    }
    const result = {
      ok: !error,
      models,
      latencyMs: Date.now() - startedAt,
      error,
      modelDiscoveryError,
    };
    if (id)
      await this.prisma.aiProviderConnection.update({
        where: { id },
        data: {
          models,
          lastTestedAt: new Date(),
          lastStatus: result.ok ? 'reachable' : 'failed',
          lastError: error,
          lastLatencyMs: result.latencyMs,
        },
      });
    return result;
  }

  async resolveOverride(
    userId: string,
    override?: AiProviderOverride,
  ): Promise<AiProviderOverride | undefined> {
    if (!override?.providerId) return override;
    const provider = await this.getSecretSource(userId, override.providerId);
    return {
      type: 'openai-compatible',
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey ? decryptAttribute(provider.apiKey) : 'no-key',
      model: override.model,
      capabilities: this.capabilities(provider.capabilities),
    };
  }

  private async requireOwned(userId: string, id: string) {
    const provider = await this.prisma.aiProviderConnection.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!provider) throw new NotFoundException('AI provider not found');
  }

  private async getSecretSource(userId: string, id: string) {
    const provider = await this.prisma.aiProviderConnection.findFirst({
      where: { id, userId },
    });
    if (!provider) throw new NotFoundException('AI provider not found');
    return provider;
  }

  private async normalizeInput(
    dto: SaveAiProviderConnectionDto,
    includeEmptyKey: boolean,
  ) {
    const baseUrl = normalizeProviderBaseUrl(dto.baseUrl);
    await this.safeUrl(baseUrl, 'models');
    const apiKey = dto.apiKey?.trim();
    return {
      name: dto.name.trim(),
      type: 'openai-compatible',
      baseUrl,
      model: dto.model.trim(),
      models: Array.from(
        new Set(
          [...(dto.models || []), dto.model]
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ),
      capabilities: (dto.capabilities || {}) as Prisma.InputJsonValue,
      ...(apiKey
        ? { apiKey: encryptAttribute(apiKey) }
        : includeEmptyKey
          ? { apiKey: null }
          : {}),
    };
  }

  private async safeUrl(baseUrl: string, path: string) {
    let requestUrl: string;
    try {
      requestUrl = new URL(
        path,
        `${normalizeProviderBaseUrl(baseUrl)}/`,
      ).toString();
    } catch {
      throw new BadRequestException('Invalid Base URL');
    }
    try {
      validateAiProviderUrl(requestUrl);
    } catch {
      throw new BadRequestException('Unsafe provider URL');
    }
    return requestUrl;
  }

  private headers(apiKey?: string) {
    return {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    };
  }

  private capabilities(value: Prisma.JsonValue): ProviderCapabilities {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as ProviderCapabilities)
      : {};
  }

  private toPublic(provider: PublicProviderRecord) {
    const { apiKey, ...metadata } = provider;
    return {
      ...metadata,
      apiKeyConfigured: Boolean(apiKey),
      capabilities: this.capabilities(provider.capabilities),
    };
  }

  private providerError(payload: unknown) {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
    if (record.error && typeof record.error === 'object') {
      const message = (record.error as Record<string, unknown>).message;
      if (typeof message === 'string') return message;
    }
    return '';
  }

  private redact(message: string, apiKey: string) {
    return message
      .split(apiKey || '__no_api_key__')
      .join('[redacted]')
      .replace(/(Bearer\s+)[^\s,;]+/gi, '$1[redacted]')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .slice(0, 300);
  }
}
