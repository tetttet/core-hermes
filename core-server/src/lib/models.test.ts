import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTO_MODEL_ID,
  TEXT_FALLBACK_MODEL_IDS,
  getModelReasoning,
  isSupportedModel,
  resolveModelRoute,
} from "./models.js";

describe("model routing", () => {
  it("accepts safe free model ids without allowing paid or malformed ids", () => {
    assert.equal(isSupportedModel("provider/future-model:free"), true);
    assert.equal(isSupportedModel("provider/paid-model"), false);
    assert.equal(isSupportedModel("../../model:free"), false);
  });

  it("uses verified fallbacks for Auto and manual text models", () => {
    assert.deepEqual(
      resolveModelRoute(AUTO_MODEL_ID, [], true),
      [...TEXT_FALLBACK_MODEL_IDS],
    );
    assert.deepEqual(
      resolveModelRoute("liquid/lfm-2.5-2.6b:free", [], true),
      ["liquid/lfm-2.5-2.6b:free", ...TEXT_FALLBACK_MODEL_IDS],
    );
  });

  it("keeps mandatory reasoning enabled and disables optional reasoning", () => {
    assert.deepEqual(getModelReasoning("openai/gpt-oss-20b:free"), {
      effort: "minimal",
      exclude: true,
    });
    assert.deepEqual(getModelReasoning("inclusionai/ling-3.0-tiny:free"), {
      effort: "none",
      exclude: true,
    });
  });
});
