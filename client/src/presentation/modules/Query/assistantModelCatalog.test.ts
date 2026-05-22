import { describe, expect, it } from 'vitest';
import { getAssistantModelCatalog } from './assistantModelCatalog';

describe('assistantModelCatalog', () => {
  it('includes a dedicated Beeknoee provider group for AI Assistant', () => {
    const groups = getAssistantModelCatalog();
    const beeknoeeGroup = groups.find((group) => group.group === 'Beeknoee');

    expect(beeknoeeGroup).toBeDefined();
    expect(beeknoeeGroup?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'beeknoee:glm-4.7-flash',
          label: 'GLM 4.7 Flash',
        }),
        expect.objectContaining({
          id: 'beeknoee:qwen-3-235b-a22b-instruct-2507',
          label: 'Qwen 3 235B A22B Instruct 2507',
        }),
      ]),
    );
  });
});
