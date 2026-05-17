import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSchemaDto } from './update-schema.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(UpdateSchemaDto, payload);
  return validate(dto, {
    forbidNonWhitelisted: true,
    whitelist: true,
  });
}

describe('UpdateSchemaDto', () => {
  const basePayload = {
    connectionId: 'conn-1',
    schema: 'public',
    table: 'users',
  };

  it('accepts safe schema operations', async () => {
    const errors = await validateDto({
      ...basePayload,
      operations: [
        {
          type: 'add_column',
          name: 'display_name',
          dataType: 'varchar(255)',
          isNullable: true,
        },
        {
          type: 'add_fk',
          name: 'fk_users_organization_id',
          columns: ['organization_id'],
          refTable: 'organizations',
          refColumns: ['id'],
        },
      ],
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects DDL fragments in column data types', async () => {
    const errors = await validateDto({
      ...basePayload,
      operations: [
        {
          type: 'add_column',
          name: 'nickname',
          dataType: 'text; DROP TABLE users; --',
        },
      ],
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects unsafe schema identifiers', async () => {
    const errors = await validateDto({
      ...basePayload,
      operations: [
        {
          type: 'add_fk',
          name: 'fk_users_org; DROP TABLE organizations; --',
          columns: ['organization_id'],
          refTable: 'organizations',
          refColumns: ['id'],
        },
      ],
    });

    expect(errors).not.toHaveLength(0);
  });
});
