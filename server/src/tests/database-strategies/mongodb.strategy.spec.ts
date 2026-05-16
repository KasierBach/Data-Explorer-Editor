import { MongoDbStrategy } from '../../database-strategies/mongodb.strategy';
import { MongoClient } from 'mongodb';

jest.mock('mongodb', () => {
  return {
    MongoClient: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      close: jest.fn(),
      db: jest.fn(),
    })),
    ObjectId: jest.fn(),
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
      expect(mockCollection.limit).toHaveBeenCalledWith(50000);
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

      expect(mockCollection.limit).toHaveBeenCalledWith(10);
      expect(mockCollection.maxTimeMS).toHaveBeenCalledWith(30000);
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

      expect(mockCollection.aggregate).toHaveBeenCalledWith([]);
      expect(mockCollection.maxTimeMS).toHaveBeenCalledWith(30000);
      expect(result.rows.length).toBe(50000);
    });

    it('should throw an error for invalid JSON payload', async () => {
      await expect(
        strategy.executeQuery(mockClient, 'INVALID JSON'),
      ).rejects.toThrow();
    });
  });
});
