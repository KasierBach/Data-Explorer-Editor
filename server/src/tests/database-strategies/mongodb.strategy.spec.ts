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
      updateOne: jest.fn().mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
      }),
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
  });

  describe('executeQuery (OOM Protections & Timeouts)', () => {
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
