import { BadRequestException } from '@nestjs/common';
import { MetadataService } from './metadata.service';

describe('MetadataService', () => {
  it('rejects repeated parentId fields before touching a connection', async () => {
    const service = new MetadataService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getHierarchy('connection-id', ['db:main'], 'user-id'),
    ).rejects.toThrow(BadRequestException);
  });
});
