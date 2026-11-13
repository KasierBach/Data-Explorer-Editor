import { BEEKNOEE_MODELS } from "./beeknoeeModelCatalog";

export type AssistantRole =
  | "assistant"
  | "sql"
  | "nosql"
  | "explain"
  | "autocomplete";

export type ModelOperationalStatus =
  | "not-assessed"
  | "reachable"
  | "unconfigured"
  | "auth-denied"
  | "rate-limited"
  | "credits-required"
  | "unavailable"
  | "timeout"
  | "invalid-output";

export type ModelRoleVerdict =
  | "not-assessed"
  | "observed-match"
  | "observed-failure"
  | "requires-review";

export interface ModelRoleGuidance {
  model: string;
  status: ModelOperationalStatus;
  samples: number;
  recommendedRoles: readonly AssistantRole[];
  note: string;
}

export function getBeeknoeeRoleGuidance(
  model: string,
  lang: string,
): ModelRoleGuidance | undefined {
  if (!BEEKNOEE_MODELS.some((entry) => entry.id === model)) return undefined;
  return {
    model,
    status: "not-assessed",
    samples: 0,
    recommendedRoles: [],
    note:
      lang === "vi"
        ? "Vai trò Beeknoee chưa được đánh giá bằng test thực tế. Tên model và lỗi quota/kết nối không chứng minh năng lực; lựa chọn hiện tại vẫn được giữ."
        : "Beeknoee roles are not assessed with live task tests. Model names and quota/network failures do not establish ability; your current selection is preserved.",
  };
}
