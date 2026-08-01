import { validateExternalUrl } from '../common/utils/ssrf-validator.util';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderConnectionService } from './ai-provider-connection.service';

jest.mock('../common/utils/ssrf-validator.util', () => ({
  validateExternalUrl: jest.fn(),
}));
jest.mock('../utils/crypto.util', () => ({
  encryptAttribute: (value: string) => `encrypted:${value}`,
  decryptAttribute: (value: string) => value.replace(/^encrypted:/, ''),
}));

describe('AiProviderConnectionService', () => {
  it('encrypts API keys and never returns them to the client', async () => {
    jest.mocked(validateExternalUrl).mockResolvedValue(true);
    const create = jest.fn().mockImplementation(({ data }) => ({
      ...data,
      id: 'provider-1',
      capabilities: data.capabilities || {},
      lastTestedAt: null,
      lastStatus: null,
      lastError: null,
      lastLatencyMs: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    }));
    const service = new AiProviderConnectionService({
      aiProviderConnection: { create },
    } as unknown as PrismaService);

    const result = await service.create('user-1', {
      name: 'Local provider',
      type: 'openai-compatible',
      baseUrl: 'https://provider.example.com/v1/',
      apiKey: 'sk-secret',
      model: 'model-a',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          apiKey: 'encrypted:sk-secret',
          baseUrl: 'https://provider.example.com/v1',
          userId: 'user-1',
        }),
      }),
    );
    expect(result).not.toHaveProperty('apiKey');
    expect(result.apiKeyConfigured).toBe(true);
  });

  it('resolves saved provider secrets and capabilities for its owner', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'provider-1',
      userId: 'user-1',
      name: 'Saved provider',
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'encrypted:sk-secret',
      model: 'model-a',
      capabilities: { vision: true, document: false },
    });
    const service = new AiProviderConnectionService({
      aiProviderConnection: { findFirst },
    } as unknown as PrismaService);

    const result = await service.resolveOverride('user-1', {
      type: 'openai-compatible',
      providerId: 'provider-1',
      model: 'vision-model',
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'provider-1', userId: 'user-1' },
    });
    expect(result).toEqual({
      type: 'openai-compatible',
      name: 'Saved provider',
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'sk-secret',
      model: 'vision-model',
      capabilities: { vision: true, document: false },
    });
  });
});
