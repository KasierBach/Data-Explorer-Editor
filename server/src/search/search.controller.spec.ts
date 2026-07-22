import { BadRequestException } from '@nestjs/common';
import { SearchController } from './search.controller';

describe('SearchController', () => {
  it('rejects repeated q parameters', async () => {
    const controller = new SearchController({} as never);

    await expect(controller.search({} as never, ['users'])).rejects.toThrow(
      BadRequestException,
    );
  });
});
