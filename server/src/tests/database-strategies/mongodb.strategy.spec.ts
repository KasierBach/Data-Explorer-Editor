import { MongoDbStrategy } from '../../database-strategies/mongodb.strategy';
import { MongoClient, ObjectId } from 'mongodb';

jest.mock('mongodb', () => {
  return {
    MongoClient: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      close: jest.fn(),
      db: jest.fn(),
    })),
    ObjectId: Object.assign(jest.fn(), { isValid: jest.fn() }),
  };
});

describe('MongoDbStrategy', () => {
  let strategy: MongoDbStrategy;
  let mockClient: any;
  let mockDb: any;
  let mockCollection: any;

  beforeEach(() => {
    strategy = new MongoDbStrategy();

    mockCollection = {
      find: jest.fn().mockReturnThis(),
      aggregate: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockReturnThis(),
      countDocuments: jest.fn().mockResolvedValue(3),
      distinct: jest.fn().mockResolvedValue(['a', 'b']),
      insertOne: jest.fn().mockResolvedValue({ insertedId: 'new-id' }),
      insertMany: jest.fn().mockResolvedValue({ insertedCount: 1 }),
      updateOne: jest.fn().mockResolvedValue({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
      }),
      updateMany: jest
        .fn()
        .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      toArray: jest.fn().mockResolvedValue([]),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    mockClient = new MongoClient('mongodb://localhost');
    mockClient.db.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPool', () => {
    it('should structure MongoClient connection with aggressive timeout configurations', async () => {
      const config = {
        host: '127.0.0.1',
        port: 27017,
        username: 'admin',
        password: 'password',
        database: 'test_db',
        type: 'mongodb',
      };

      await strategy.createPool(config);

      expect(MongoClient).toHaveBeenCalledWith(
        'mongodb://admin:password@127.0.0.1:27017/test_db',
        expect.objectContaining({
          serverSelectionTimeoutMS: 15000,
          connectTimeoutMS: 15000,
          socketTimeoutMS: 30000,
        }),
      );
    });

    it('should apply a selected database to an existing MongoDB URL', async () => {
      await strategy.createPool(
        {
          url: 'mongodb://admin:password@127.0.0.1:27017/default_db?retryWrites=true',
          type: 'mongodb',
        },
        'reports',
      );

      expect(MongoClient).toHaveBeenCalledWith(
        'mongodb://admin:password@127.0.0.1:27017/reports?retryWrites=true',
        expect.any(Object),
      );
    });
  });

  describe('executeQuery (OOM Protections & Timeouts)', () => {
    it('rejects oversized MongoDB payload arrays before execution', async () => {
      const payload = {
        action: 'aggregate',
        collection: 'test_col',
        pipeline: new Array(101).fill({ $match: {} }),
      };

      await expect(
        strategy.executeQuery(mockClient, JSON.stringify(payload)),
      ).rejects.toThrow('pipeline exceeds the maximum of 100 stages');
      expect(mockCollection.aggregate).not.toHaveBeenCalled();
    });

    it('should restrict find() limit to 50000 even if payload requested more, and append maxTimeMS 30s', async () => {
      const payload = {
        action: 'find',
        collection: 'test_col',
        limit: 1000000, // User trying to crash server
      };

      await strategy.executeQuery(mockClient, JSON.stringify(payload));

      expect(mockCollection.find).toHaveBeenCalledWith({}, {});
      expect(mockCollection.limit).toHaveBeenCalledWith(50001);
      expect(mockCollection.maxTimeMS).toHaveBeenCalledWith(30000);
      expect(mockCollection.toArray).toHaveBeenCalled();
    });

    it('should allow lower limits normally', async () => {
      const payload = {
        action: 'find',
        collection: 'test_col',
        limit: 10, // User only wants 10
      };

      await strategy.executeQuery(mockClient, JSON.stringify(payload));

      expect(mockCollection.limit).toHaveBeenCalledWith(11);
      expect(mockCollection.maxTimeMS).toHaveBeenCalledWith(30000);
    });

    it('returns one page and marks find results when another page exists', async () => {
      mockCollection.toArray.mockResolvedValue([
        { _id: 1 },
        { _id: 2 },
        { _id: 3 },
      ]);

      const result = await strategy.executeQuery(
        mockClient,
        JSON.stringify({ action: 'find', collection: 'test_col' }),
        { limit: 2, offset: 4 },
      );

      expect(mockCollection.skip).toHaveBeenCalledWith(4);
      expect(mockCollection.limit).toHaveBeenCalledWith(3);
      expect(result.rows).toEqual([{ _id: 1 }, { _id: 2 }]);
      expect(result.truncated).toBe(true);
      expect(result.hasNextPage).toBe(true);
      expect(result.appliedOffset).toBe(4);
    });

    it('should slice aggregate() results to 50000 and append maxTimeMS 30s', async () => {
      const payload = {
        action: 'aggregate',
        collection: 'test_col',
        pipeline: [],
      };

      const massiveArray = new Array(50001).fill({ _id: 1 });
      mockCollection.toArray.mockResolvedValue(massiveArray);

      const result = await strategy.executeQuery(
        mockClient,
        JSON.stringify(payload),
      );

      expect(mockCollection.aggregate).toHaveBeenCalledWith([], {});
      expect(mockCollection.maxTimeMS).toHaveBeenCalledWith(30000);
      expect(mockCollection.limit).toHaveBeenCalledWith(50001);
      expect(result.rows.length).toBe(50000);
      expect(result.truncated).toBe(true);
      expect(result.appliedLimit).toBe(50000);
      expect(result.limitSource).toBe('protective_default');
    });

    it('applies the requested offset to aggregate queries', async () => {
      const payload = {
        action: 'aggregate',
        collection: 'test_col',
        pipeline: [],
      };

      await strategy.executeQuery(mockClient, JSON.stringify(payload), {
        limit: 10,
        offset: 20,
      });

      expect(mockCollection.skip).toHaveBeenCalledWith(20);
    });

    it('applies the 30s server timeout to count and distinct queries', async () => {
      await strategy.executeQuery(
        mockClient,
        JSON.stringify({ action: 'count', collection: 'test_col' }),
      );
      await strategy.executeQuery(
        mockClient,
        JSON.stringify({
          action: 'distinct',
          collection: 'test_col',
          field: 'status',
        }),
      );

      expect(mockCollection.countDocuments).toHaveBeenCalledWith(
        {},
        { maxTimeMS: 30000 },
      );
      expect(mockCollection.distinct).toHaveBeenCalledWith(
        'status',
        {},
        { maxTimeMS: 30000 },
      );
    });

    it('sanitizes mutation options and enforces a 30s timeout', async () => {
      await strategy.executeQuery(
        mockClient,
        JSON.stringify({
          action: 'updateMany',
          collection: 'test_col',
          filter: {},
          update: { $set: { active: true } },
          options: { upsert: false, maxTimeMS: 999999 },
        }),
      );

      expect(mockCollection.updateMany).toHaveBeenCalledWith(
        {},
        { $set: { active: true } },
        { upsert: false, maxTimeMS: 30000 },
      );
    });

    it('serializes nested ObjectIds in returned documents', async () => {
      const objectId = { _bsontype: 'ObjectId', toString: () => 'nested-id' };
      mockCollection.toArray.mockResolvedValue([
        { _id: objectId, nested: { ref: objectId }, refs: [objectId] },
      ]);

      const result = await strategy.executeQuery(
        mockClient,
        JSON.stringify({ action: 'find', collection: 'test_col' }),
      );

      expect(result.rows).toEqual([
        { _id: 'nested-id', nested: { ref: 'nested-id' }, refs: ['nested-id'] },
      ]);
    });

    it('should throw an error for invalid JSON payload', async () => {
      await expect(
        strategy.executeQuery(mockClient, 'INVALID JSON'),
      ).rejects.toThrow();
    });
  });

  describe('updateRow', () => {
    it('does not retry with a different filter when an _id is invalid', async () => {
      (ObjectId as any).isValid = jest.fn().mockReturnValue(false);

      await strategy.updateRow(mockClient, {
        schema: 'public',
        table: 'test_col',
        pkColumn: '_id',
        pkValue: 'not-an-object-id',
        updates: { name: 'updated' },
      });

      expect(mockCollection.updateOne).toHaveBeenCalledTimes(1);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: 'not-an-object-id' },
        { $set: { name: 'updated' } },
      );
    });
  });
});
