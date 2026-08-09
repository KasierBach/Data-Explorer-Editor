import {
  validateMongoExecutableCommand,
  validateMongoExecutablePayload,
} from './mongo-payload-validator';

describe('MongoDB executable payload validation', () => {
  it('accepts a valid top-genres aggregation pipeline', () => {
    expect(
      validateMongoExecutablePayload({
        action: 'aggregate',
        collection: 'movies',
        pipeline: [
          { $unwind: '$genres' },
          { $group: { _id: '$genres', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ],
      }),
    ).toEqual([]);
  });

  it('rejects grouped output fields that are not accumulators', () => {
    const issues = validateMongoExecutablePayload({
      action: 'aggregate',
      collection: 'movies',
      pipeline: [{ $group: { _id: '$genres', count: 1 } }],
    });

    expect(issues).toEqual([
      'Stage #1 $group field "count" must be an accumulator object such as { "$sum": 1 }.',
    ]);
  });

  it('rejects malformed JSON before it can reach MongoDB', () => {
    expect(validateMongoExecutableCommand('{ bad json')).toEqual([
      'MongoDB payload must be valid JSON.',
    ]);
  });
});
