import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decryptAttribute, encryptAttribute } from '../utils/crypto.util';
import { validateExternalUrl } from '../common/utils/ssrf-validator.util';
import { normalizeProviderBaseUrl } from './ai-url.util';
import type { AiProviderOverride } from './ai.types';
import type { SaveAiProviderConnectionDto } from './dto/ai-provider-connection.dto';

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

@Injectable()
export class AiProviderConnectionService {
  constructor(private readonly prisma: PrismaService) {}

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

  async listModels(baseUrl: string, apiKey?: string) {
    const response = await fetch(await this.safeUrl(baseUrl, 'models'), {
      method: 'GET',
      headers: this.headers(apiKey),
      redirect: 'manual',
    }).catch((error: unknown) => {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Unable to reach provider',
      );
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new BadRequestException(
        this.providerError(payload) || `Provider returned ${response.status}`,
      );
    }
    return Array.isArray((payload as { data?: unknown[] } | null)?.data)
      ? Array.from(
          new Set(
            (payload as { data: Array<{ id?: unknown }> }).data
              .map((item) =>
                typeof item?.id === 'string' ? item.id.trim() : '',
              )
              .filter(Boolean),
          ),
        ).sort((left, right) => left.localeCompare(right))
      : [];
  }

  async test(userId: string, id?: string, input?: SaveAiProviderConnectionDto) {
    const source = id ? await this.getSecretSource(userId, id) : null;
    const baseUrl = input?.baseUrl || source?.baseUrl || '';
    const model = input?.model || source?.model || '';
    const apiKey = input?.apiKey?.trim()
      ? input.apiKey.trim()
      : source?.apiKey
        ? decryptAttribute(source.apiKey)
        : '';
    if (!baseUrl || !model) {
      throw new BadRequestException('Base URL and model are required');
    }

    const startedAt = Date.now();
    let models: string[] = [];
    let modelDiscoveryError: string | null = null;
    let error: string | null = null;
    try {
      models = await this.listModels(baseUrl, apiKey);
    } catch (caught) {
      modelDiscoveryError =
        caught instanceof Error ? caught.message : 'Model discovery failed';
    }

    try {
      const response = await fetch(
        await this.safeUrl(baseUrl, 'chat/completions'),
        {
          method: 'POST',
          headers: this.headers(apiKey),
          redirect: 'manual',
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Reply with OK.' }],
            temperature: 0,
            max_tokens: 8,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          this.providerError(payload) || `Provider returned ${response.status}`,
        );
      }
      const content = (
        payload as {
          choices?: Array<{ message?: { content?: unknown } }>;
        } | null
      )?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('Provider returned an empty chat response');
      }
    } catch (caught) {
      error = this.redact(
        caught instanceof Error ? caught.message : 'Provider test failed',
        apiKey,
      );
    }

    const result = {
      ok: !error,
      models,
      latencyMs: Date.now() - startedAt,
      error,
      modelDiscoveryError: modelDiscoveryError
        ? this.redact(modelDiscoveryError, apiKey)
        : null,
    };
    if (id) {
      await this.prisma.aiProviderConnection.update({
        where: { id },
        data: {
          models,
          lastTestedAt: new Date(),
          lastStatus: result.ok ? 'healthy' : 'failed',
          lastError: error,
          lastLatencyMs: result.latencyMs,
        },
      });
    }
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
    if (!(await validateExternalUrl(requestUrl))) {
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
