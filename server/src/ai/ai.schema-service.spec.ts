import { AiSchemaService } from './ai.schema-service';

describe('AiSchemaService', () => {
  it('caches an empty semantic result instead of calling the provider again', async () => {
    let cached: string[] | undefined;
    const cacheManager = {
      get: jest.fn(async () => cached),
      set: jest.fn(async (_key: string, value: string[]) => {
        cached = value;
      }),
    };
    const providerRunner = {
      isGeminiAvailable: jest.fn().mockReturnValue(true),
      completeGeminiText: jest.fn().mockResolvedValue(''),
    };
    const service = new AiSchemaService(
      cacheManager as never,
      {} as never,
      providerRunner as never,
    );

    await expect(
      service.suggestTablesBySemantic('missing', ['users']),
    ).resolves.toEqual([]);
    await expect(
      service.suggestTablesBySemantic('missing', ['users']),
    ).resolves.toEqual([]);

    expect(providerRunner.completeGeminiText).toHaveBeenCalledTimes(1);
  });
});
