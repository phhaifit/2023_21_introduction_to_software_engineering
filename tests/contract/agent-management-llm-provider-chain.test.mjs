import assert from "node:assert/strict";

import {
  LlmAgentDraftingService,
  LlmDraftingUnavailableError,
  MockLlmAgentDraftProvider,
  validateStructuredAgentDraftOutput
} from "@vcp/backend/modules/agent-management/application/llm-agent-drafting-port.ts";
import {
  DEFAULT_GEMINI_MODEL_ID,
  DEFAULT_OPENROUTER_MODEL_ID,
  GeminiAgentDraftProvider,
  OpenRouterAgentDraftProvider,
  createProductionLlmAgentDraftingService,
  parseStructuredJsonText
} from "@vcp/backend/modules/agent-management/infrastructure/llm-provider-adapters.ts";

const workspaceId = "workspace-a";

function structuredDraft(overrides = {}) {
  return {
    draft: {
      name: "Research Assistant",
      role: "Market research analyst",
      model: "gemini-2.5-flash",
      instructions: "Summarize market research into concise operating updates.",
      responsibilities: ["Collect context", "Prepare summaries"],
      requestedTools: [{ name: "Slack", reason: "Share updates" }],
      requestedKnowledge: [{ title: "Market Report", reason: "Ground analysis" }],
      warnings: [],
      clarifyingQuestions: [],
      ...overrides.draft
    },
    warnings: overrides.warnings ?? [],
    clarifyingQuestions: overrides.clarifyingQuestions ?? []
  };
}

function provider(providerId, options = {}) {
  const calls = [];
  return {
    providerId,
    modelId: options.modelId ?? `${providerId}-model`,
    calls,
    async generateStructuredDraft(input) {
      calls.push(input);
      if (options.error) {
        throw options.error;
      }
      return options.output ?? structuredDraft();
    }
  };
}

{
  const gemini = provider("gemini", { output: structuredDraft() });
  const openrouter = provider("openrouter");
  const service = new LlmAgentDraftingService([gemini, openrouter]);

  const response = await service.createDraft({
    workspaceId,
    prompt: "Create a research assistant for weekly market summaries."
  });

  assert.equal(response.draft.name, "Research Assistant");
  assert.equal(response.provider.providerId, "gemini");
  assert.equal(response.provider.modelId, "gemini-model");
  assert.equal(response.provider.fallbackUsed, false);
  assert.equal(gemini.calls.length, 1);
  assert.equal(openrouter.calls.length, 0);
}

{
  const gemini = provider("gemini", { error: new Error("raw provider failure with secret") });
  const openrouter = provider("openrouter", { output: structuredDraft({ draft: { model: "openrouter/owl-alpha" } }) });
  const service = new LlmAgentDraftingService([gemini, openrouter]);

  const response = await service.createDraft({
    workspaceId,
    prompt: "Create a support agent."
  });

  assert.equal(response.draft.model, "openrouter/owl-alpha");
  assert.equal(response.provider.providerId, "openrouter");
  assert.equal(response.provider.fallbackUsed, true);
  assert.equal(gemini.calls.length, 1);
  assert.equal(openrouter.calls.length, 1);
}

{
  const service = new LlmAgentDraftingService([
    provider("gemini", { output: { draft: { name: "Incomplete" } } }),
    provider("openrouter", { error: new Error("openrouter raw response") })
  ]);

  await assert.rejects(
    () =>
      service.createDraft({
        workspaceId,
        prompt: "Create a draft with invalid provider output."
      }),
    (error) => {
      assert.ok(error instanceof LlmDraftingUnavailableError);
      assert.deepEqual(error.failures, [
        { providerId: "gemini", reason: "draft.role_required" },
        { providerId: "openrouter", reason: "provider_unavailable" }
      ]);
      assert.doesNotMatch(error.message, /secret|raw response/i);
      return true;
    }
  );
}

{
  assert.throws(
    () =>
      validateStructuredAgentDraftOutput(
        { draft: { name: "Missing role" }, warnings: [], clarifyingQuestions: [] },
        { providerId: "gemini", modelId: DEFAULT_GEMINI_MODEL_ID, fallbackUsed: false }
      ),
    /draft.role_required/
  );
}

{
  const fetchCalls = [];
  const gemini = new GeminiAgentDraftProvider({
    fetchImplementation: async (...args) => {
      fetchCalls.push(args);
      return new Response("{}");
    }
  });
  const openrouter = new OpenRouterAgentDraftProvider({
    fetchImplementation: async (...args) => {
      fetchCalls.push(args);
      return new Response("{}");
    }
  });

  await assert.rejects(
    () =>
      gemini.generateStructuredDraft({
        workspaceId,
        source: "prompt",
        prompt: "Create an assistant."
      }),
    /missing_api_key/
  );
  await assert.rejects(
    () =>
      openrouter.generateStructuredDraft({
        workspaceId,
        source: "prompt",
        prompt: "Create an assistant."
      }),
    /missing_api_key/
  );
  assert.equal(fetchCalls.length, 0);
}

{
  const responseJson = structuredDraft({
    draft: {
      name: "Gemini Draft"
    }
  });
  const provider = new GeminiAgentDraftProvider({
    apiKey: "gemini-secret",
    fetchImplementation: async (url, init) => {
      assert.match(url, /gemini-2\.5-flash:generateContent/);
      assert.doesNotMatch(init.body, /gemini-secret/);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(responseJson) }]
              }
            }
          ]
        }),
        { status: 200 }
      );
    }
  });

  const output = await provider.generateStructuredDraft({
    workspaceId,
    source: "prompt",
    prompt: "Create an assistant."
  });

  assert.deepEqual(output, responseJson);
  assert.equal(provider.modelId, DEFAULT_GEMINI_MODEL_ID);
}

{
  const responseJson = structuredDraft({
    draft: {
      name: "OpenRouter Draft",
      model: DEFAULT_OPENROUTER_MODEL_ID
    }
  });
  const provider = new OpenRouterAgentDraftProvider({
    apiKey: "openrouter-secret",
    fetchImplementation: async (url, init) => {
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(init.headers.authorization, "Bearer openrouter-secret");
      assert.match(init.body, /openrouter\/owl-alpha/);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: `\`\`\`json\n${JSON.stringify(responseJson)}\n\`\`\``
              }
            }
          ]
        }),
        { status: 200 }
      );
    }
  });

  const output = await provider.generateStructuredDraft({
    workspaceId,
    source: "skill-import",
    markdown: "# Imported Agent\n\n## Role\nSupport",
    fileName: "skill.md"
  });

  assert.deepEqual(output, responseJson);
  assert.equal(provider.modelId, DEFAULT_OPENROUTER_MODEL_ID);
}

{
  const service = createProductionLlmAgentDraftingService({
    env: {
      GEMINI_API_KEY: "gemini-secret",
      OPENROUTER_API_KEY: "openrouter-secret"
    },
    fetchImplementation: async (url) => {
      if (String(url).includes("generativelanguage")) {
        return new Response("{}", { status: 500 });
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(structuredDraft({ draft: { name: "Fallback Draft" } }))
              }
            }
          ]
        }),
        { status: 200 }
      );
    }
  });

  const response = await service.createDraft({
    workspaceId,
    prompt: "Create an assistant with production provider chain."
  });

  assert.equal(response.draft.name, "Fallback Draft");
  assert.equal(response.provider.providerId, "openrouter");
  assert.equal(response.provider.fallbackUsed, true);
}

{
  const service = new LlmAgentDraftingService([
    new MockLlmAgentDraftProvider(structuredDraft({ draft: { name: "Deterministic Mock Draft" } }))
  ]);

  const response = await service.extractDraftFromSkillMarkdown({
    workspaceId,
    markdown: "# Skill\n\n## Role\nMock"
  });

  assert.equal(response.draft.name, "Deterministic Mock Draft");
  assert.equal(response.provider.providerId, "mock");
  assert.equal(response.provider.fallbackUsed, false);
}

{
  assert.deepEqual(parseStructuredJsonText('{"draft": null, "warnings": [], "clarifyingQuestions": ["What role?"]}'), {
    draft: null,
    warnings: [],
    clarifyingQuestions: ["What role?"]
  });
  assert.throws(() => parseStructuredJsonText("not json"), /invalid_json_response/);
}
