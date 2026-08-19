import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_PROMPT } from "./openrouter.js";

test("system prompt requires the response to match the latest user message language", () => {
  assert.match(
    SYSTEM_PROMPT,
    /Always answer in the language of the user's latest message/,
  );
  assert.match(SYSTEM_PROMPT, /only from the user's own request text/);
});
