import { describe, expect, it } from "vitest";
import { BEEKNOEE_ASSESSMENT_MODEL_IDS } from "./beeknoeeModelCatalog";
import { getBeeknoeeRoleGuidance } from "./modelRoleEvidence";

describe("Beeknoee role evidence", () => {
  it.each(BEEKNOEE_ASSESSMENT_MODEL_IDS)(
    "does not infer a role from the name %s",
    (model) => {
      const evidence = getBeeknoeeRoleGuidance(model, "en");
      expect(evidence?.model).toBe(model);
      expect(evidence?.status).toBe("not-assessed");
      expect(evidence?.recommendedRoles).toEqual([]);
      expect(evidence?.samples).toBe(0);
      expect(evidence?.note).toContain("not assessed");
      expect(evidence?.note).not.toMatch(/best|accuracy|100%/i);
    },
  );

  it("keeps Beeknoee guidance separate from direct Gemini and custom providers", () => {
    expect(getBeeknoeeRoleGuidance("gemini-3.8-flash", "en")).toBeUndefined();
    expect(
      getBeeknoeeRoleGuidance("custom-provider:beeknoee", "en"),
    ).toBeUndefined();
    expect(getBeeknoeeRoleGuidance("beeknoee:unknown", "en")).toBeUndefined();
  });

  it("states the unknown status in Vietnamese without modifying preferences", () => {
    const evidence = getBeeknoeeRoleGuidance("beeknoee:claude-opus-4-6", "vi");
    expect(evidence?.note).toContain("chưa được đánh giá");
    expect(evidence?.note).toContain("Tên model");
    expect(evidence?.recommendedRoles).toEqual([]);
  });
});
