'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createAppModelRoleAdapter } = require('./ai-model-role-adapter.cjs');

function bootstrapApplicationServices(root, config, beginExecution) {
  require('ts-node').register({ transpileOnly: true, project: join(root, 'tsconfig.json') });
  const { Logger } = require('@nestjs/common');
  Logger.overrideLogger([]);
  const { ConfigService } = require('@nestjs/config');
  const { AiPromptBuilderService } = require('../../src/ai/ai.prompt-builder.service');
  const { AiProviderRunnerService } = require('../../src/ai/ai.provider-runner.service');
  const { AiRoutingService } = require('../../src/ai/ai.routing.service');
  const { AiChatCompletionService } = require('../../src/ai/ai.chat-completion.service');
  const { AiCircuitBreakerService } = require('../../src/ai/ai.circuit-breaker.service');
  const { AiAutocompleteService } = require('../../src/ai/ai.autocomplete-service');
  const { FreshnessService } = require('../../src/common/freshness/freshness.service');
  const values = {
    GEMINI_API_KEY: undefined,
    BEEKNOEE_API_KEY: config.apiKey,
    BEEKNOEE_BASE_URL: config.baseUrl,
    AI_KILL_SWITCH: 'false',
    AI_EGRESS_POLICY_JSON: JSON.stringify({
      enabled: true,
      providers: ['beeknoee'],
      origins: ['https://platform.beeknoee.com'],
    }),
  };
  const configService = new ConfigService(values);
  const prompt = new AiPromptBuilderService();
  const runner = new AiProviderRunnerService(configService, prompt);
  const routing = new AiRoutingService(configService);
  const cache = new Map();
  const cacheManager = {
    get: async (key) => cache.get(key),
    set: async (key, value) => { cache.set(key, value); },
  };
  const chat = new AiChatCompletionService(
    cacheManager,
    prompt,
    runner,
    routing,
    new AiCircuitBreakerService(),
  );
  const autocomplete = new AiAutocompleteService(
    cacheManager,
    runner,
    routing,
    new FreshnessService(cacheManager),
  );
  return { chat, autocomplete, beginExecution };
}

function readAuthorization(path, roster, now) {
  const bytes = readFileSync(path);
  if (bytes.length > 32 * 1024) throw new Error('MODEL_EVAL_AUTHORITY_TOO_LARGE');
  const value = JSON.parse(bytes.toString('utf8'));
  return {
    ...value,
    credentialPresent: true,
    provider: 'beeknoee',
    recipient: 'https://platform.beeknoee.com',
    modelIds: roster.map((item) => item.apiModel),
    authorizationSha256: createHash('sha256').update(bytes).digest('hex'),
    loadedAt: now,
  };
}

function createLiveModelRoleAdapter({
  root,
  roster,
  apiKey,
  baseUrl,
  authorizationPath,
  beginExecution,
  now = Date.now,
}) {
  if (!authorizationPath) throw new Error('MODEL_EVAL_AUTHORITY_FILE_REQUIRED');
  if (typeof beginExecution !== 'function')
    throw new Error('MODEL_EVAL_LEDGER_CAPABILITY_REQUIRED');
  const authorization = readAuthorization(authorizationPath, roster, now());
  const services = bootstrapApplicationServices(
    root,
    { apiKey, baseUrl },
    beginExecution,
  );
  const { AiEgressPolicyService } = require('../../src/ai/ai-egress-policy.service');
  const { ConfigService } = require('@nestjs/config');
  const policy = new AiEgressPolicyService(
    new ConfigService({
      AI_KILL_SWITCH: 'false',
      AI_EGRESS_POLICY_JSON: JSON.stringify({
        enabled: true,
        providers: ['beeknoee'],
        origins: ['https://platform.beeknoee.com'],
      }),
    }),
  );
  services.assertProvider = (plan) => policy.assertProvider(plan);
  return {
    authorization,
    adapter: createAppModelRoleAdapter({
      apiKey,
      baseUrl,
      deadlineAt: authorization.deadlineAt,
      services,
      now,
    }),
  };
}

module.exports = { createLiveModelRoleAdapter };
