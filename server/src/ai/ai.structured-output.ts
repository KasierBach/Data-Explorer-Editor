import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import type { AiResponseFormat } from './ai.types';

const OPENAI_RECOMMENDATION_SCHEMA = {
  type: 'object',
  description:
    'A grounded follow-up suggestion that the UI can display separately.',
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      description:
        'Recommendation type. Use query_fix, index_suggestion, schema_suggestion, or chart_suggestion.',
      enum: [
        'query_fix',
        'index_suggestion',
        'schema_suggestion',
        'chart_suggestion',
      ],
    },
    title: {
      type: 'string',
      description: 'Short action-oriented label for the suggestion.',
    },
    summary: {
      type: 'string',
      description: 'Concise explanation of why this suggestion matters.',
    },
    sql: {
      type: 'string',
      description:
        'Optional executable SQL, MongoDB payload JSON, or Redis command.',
    },
    chartType: {
      type: 'string',
      description: 'Optional chart type if this suggestion is about visualization.',
    },
    fields: {
      type: 'array',
      description: 'Optional field names relevant to the suggestion.',
      items: {
        type: 'string',
      },
      maxItems: 6,
    },
  },
  required: ['type', 'title', 'summary'],
} as const;

const OPENAI_STRUCTURED_RESPONSE_SCHEMA = {
  type: 'object',
  description:
    'Structured Data Explorer AI response for chat, SQL, MongoDB, or Redis generation.',
  additionalProperties: false,
  properties: {
    message: {
      type: 'string',
      description:
        'Primary user-facing answer in markdown. Keep it concise and truthful.',
    },
    sql: {
      type: 'string',
      description:
        'Executable SQL query, MongoDB payload JSON string, or Redis command string.',
    },
    explanation: {
      type: 'string',
      description:
        'Short explanation of the generated command, assumptions, or safety notes.',
    },
    sources: {
      type: 'array',
      description:
        'Optional http or https URLs used for live external research. Omit when no live sources were used.',
      items: {
        type: 'string',
      },
    },
    recommendations: {
      type: 'array',
      description:
        'Optional grounded follow-up suggestions. Include at most three specific items.',
      items: OPENAI_RECOMMENDATION_SCHEMA,
      maxItems: 3,
    },
  },
  required: ['message'],
} as const;

const GEMINI_RECOMMENDATION_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  description:
    'A grounded follow-up suggestion that the UI can display separately.',
  properties: {
    type: {
      type: SchemaType.STRING,
      description:
        'Recommendation type. Use query_fix, index_suggestion, schema_suggestion, or chart_suggestion.',
    },
    title: {
      type: SchemaType.STRING,
      description: 'Short action-oriented label for the suggestion.',
    },
    summary: {
      type: SchemaType.STRING,
      description: 'Concise explanation of why this suggestion matters.',
    },
    sql: {
      type: SchemaType.STRING,
      description:
        'Optional executable SQL, MongoDB payload JSON, or Redis command.',
    },
    chartType: {
      type: SchemaType.STRING,
      description: 'Optional chart type if this suggestion is about visualization.',
    },
    fields: {
      type: SchemaType.ARRAY,
      description: 'Optional field names relevant to the suggestion.',
      items: {
        type: SchemaType.STRING,
      },
      maxItems: 6,
    },
  },
  required: ['type', 'title', 'summary'],
};

const GEMINI_STRUCTURED_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  description:
    'Structured Data Explorer AI response for chat, SQL, MongoDB, or Redis generation.',
  properties: {
    message: {
      type: SchemaType.STRING,
      description:
        'Primary user-facing answer in markdown. Keep it concise and truthful.',
    },
    sql: {
      type: SchemaType.STRING,
      description:
        'Executable SQL query, MongoDB payload JSON string, or Redis command string.',
    },
    explanation: {
      type: SchemaType.STRING,
      description:
        'Short explanation of the generated command, assumptions, or safety notes.',
    },
    sources: {
      type: SchemaType.ARRAY,
      description:
        'Optional http or https URLs used for live external research. Omit when no live sources were used.',
      items: {
        type: SchemaType.STRING,
      },
    },
    recommendations: {
      type: SchemaType.ARRAY,
      description:
        'Optional grounded follow-up suggestions. Include at most three specific items.',
      items: GEMINI_RECOMMENDATION_SCHEMA,
      maxItems: 3,
    },
  },
  required: ['message'],
};

export function buildOpenAiStructuredResponseFormat(
  responseFormat: AiResponseFormat,
) {
  if (responseFormat !== 'structured') {
    return undefined;
  }

  return {
    type: 'json_schema',
    json_schema: {
      name: 'data_explorer_ai_response',
      strict: true,
      schema: OPENAI_STRUCTURED_RESPONSE_SCHEMA,
    },
  } as const;
}

export function buildGeminiStructuredGenerationConfig(
  responseFormat: AiResponseFormat,
) {
  if (responseFormat !== 'structured') {
    return undefined;
  }

  return {
    responseMimeType: 'application/json',
    responseSchema: GEMINI_STRUCTURED_RESPONSE_SCHEMA,
  } as const;
}
