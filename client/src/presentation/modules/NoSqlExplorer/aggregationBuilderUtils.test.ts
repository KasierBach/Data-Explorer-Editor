import { describe, expect, it } from "vitest";
import {
  buildAggregationQuery,
  createPipelineStage,
  parseAggregationQuery,
} from "./aggregationBuilderUtils";

describe("aggregationBuilderUtils", () => {
  it("builds an aggregate payload from enabled stages", () => {
    const stages = [
      createPipelineStage({
        id: "match",
        type: "$match",
        value: '{\n  "status": "active"\n}',
      }),
      createPipelineStage({
        id: "group",
        type: "$group",
        value: '{\n  "_id": "$category",\n  "count": { "$sum": 1 }\n}',
      }),
    ];

    const result = buildAggregationQuery("products", stages);

    expect(result.issues).toHaveLength(0);
    expect(result.payload).toEqual({
      action: "aggregate",
      collection: "products",
      pipeline: [
        { $match: { status: "active" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ],
    });
  });

  it("reports invalid JSON stage bodies instead of silently dropping them", () => {
    const stages = [
      createPipelineStage({
        id: "broken",
        type: "$match",
        value: "{ invalid json }",
      }),
    ];

    const result = buildAggregationQuery("products", stages);

    expect(result.payload.pipeline).toEqual([]);
    expect(result.issues).toEqual([
      {
        stageId: "broken",
        stageIndex: 0,
        stageType: "$match",
        message: "Stage body must contain valid JSON.",
      },
    ]);
  });

  it("supports scalar values for limit, skip, and unwind stages", () => {
    const stages = [
      createPipelineStage({ id: "limit", type: "$limit", value: "25" }),
      createPipelineStage({ id: "skip", type: "$skip", value: "10" }),
      createPipelineStage({ id: "unwind", type: "$unwind", value: '"$items"' }),
    ];

    const result = buildAggregationQuery("orders", stages);

    expect(result.issues).toHaveLength(0);
    expect(result.payload.pipeline).toEqual([
      { $limit: 25 },
      { $skip: 10 },
      { $unwind: "$items" },
    ]);
  });

  it("rejects invalid group accumulator semantics before execution", () => {
    const result = buildAggregationQuery("movies", [
      createPipelineStage({
        id: "bad-group",
        type: "$group",
        value: JSON.stringify({ _id: "$genres", count: 1 }),
      }),
    ]);

    expect(result.issues).toEqual([
      expect.objectContaining({
        stageId: "bad-group",
        message: expect.stringContaining("must be an accumulator object"),
      }),
    ]);
    expect(result.payload.pipeline).toEqual([]);
  });

  it("uses a stage-specific starter value", () => {
    expect(createPipelineStage({ type: "$limit" }).value).toBe("50");
    expect(createPipelineStage({ type: "$unwind" }).value).toBe('"$items"');
  });

  it("parses an aggregate payload back into editable stages", () => {
    const parsed = parseAggregationQuery(
      JSON.stringify({
        action: "aggregate",
        collection: "orders",
        pipeline: [{ $match: { status: "paid" } }],
      }),
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.collection).toBe("orders");
    expect(parsed?.stages).toHaveLength(1);
    expect(parsed?.stages[0].type).toBe("$match");
    expect(parsed?.stages[0].value).toContain('"status": "paid"');
  });

  it("returns null for non-aggregate payloads", () => {
    expect(
      parseAggregationQuery(
        JSON.stringify({
          action: "find",
          collection: "orders",
          filter: {},
        }),
      ),
    ).toBeNull();
  });

  it("rejects a partially invalid or unsupported pipeline", () => {
    expect(
      parseAggregationQuery(
        JSON.stringify({
          action: "aggregate",
          collection: "orders",
          pipeline: [{ $match: {} }, { $count: "total" }],
        }),
      ),
    ).toBeNull();

    expect(
      parseAggregationQuery(
        JSON.stringify({
          action: "aggregate",
          collection: "orders",
          pipeline: [{ $match: {} }, null],
        }),
      ),
    ).toBeNull();

    expect(
      parseAggregationQuery(
        JSON.stringify({
          action: "aggregate",
          collection: "movies",
          pipeline: [{ $group: { _id: "$genres", count: 1 } }],
        }),
      ),
    ).toBeNull();
  });
});
