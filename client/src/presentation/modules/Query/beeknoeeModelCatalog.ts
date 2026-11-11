export const BEEKNOEE_MODELS = [
  {
    id: "beeknoee:bee/gemini-3.8-flash",
    label: "Gemini 3.8 Flash (Bee)",
    isNew: true,
    assessmentTarget: true,
  },
  {
    id: "beeknoee:bee-tok/claude-sonnet-5-5",
    label: "Claude Sonnet 5.5 (Bee Token)",
    isNew: true,
    assessmentTarget: true,
  },
  {
    id: "beeknoee:bee-tok/claude-opus-5-5",
    label: "Claude Opus 5.5 (Bee Token)",
    isNew: true,
    assessmentTarget: true,
  },
  {
    id: "beeknoee:bee/gemini-4-argon",
    label: "Gemini 4 Argon (Bee)",
    isNew: true,
    assessmentTarget: true,
  },
  {
    id: "beeknoee:bee/gemini-3.6-flash",
    label: "Gemini 3.6 Flash (Bee)",
    isNew: true,
    assessmentTarget: false,
  },
  {
    id: "beeknoee:bee-tok/gemini-3.6-flash",
    label: "Gemini 3.6 Flash (Bee Token)",
    isNew: true,
    assessmentTarget: false,
  },
  {
    id: "beeknoee:gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (Reasoning)",
    assessmentTarget: true,
  },
  {
    id: "beeknoee:claude-opus-4-6",
    label: "Claude Opus 4.6",
    isNew: true,
    assessmentTarget: true,
  },
  {
    id: "beeknoee:claude-opus-4-6-thinking",
    label: "Claude Opus 4.6 Thinking",
    assessmentTarget: true,
  },
  {
    id: "beeknoee:claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    assessmentTarget: true,
  },
  {
    id: "beeknoee:minimax/minimax-m2.7",
    label: "MiniMax M2.7",
    assessmentTarget: false,
  },
  {
    id: "beeknoee:glm-4.7-flash",
    label: "GLM 4.7 Flash",
    assessmentTarget: false,
  },
] as const;

export const BEEKNOEE_ASSESSMENT_MODEL_IDS = BEEKNOEE_MODELS.filter(
  (model) => model.assessmentTarget,
).map((model) => model.id);

export const UNVERIFIED_BEEKNOEE_CAPABILITY_IDS = new Set<string>([
  "beeknoee:bee-tok/claude-sonnet-5-5",
  "beeknoee:bee-tok/claude-opus-5-5",
  "beeknoee:bee/gemini-4-argon",
  "beeknoee:claude-opus-4-6",
]);
