import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeCursor, encodeCursor } from "./cursor.js";

describe("cursor", () => {
  it("round-trips a cursor and rejects malformed input", () => {
    const cursor = {
      at: "2026-08-10T10:00:00.000Z",
      id: "95e570a5-0e1d-4cac-9cad-d98a8c9f3a87",
    };
    assert.deepEqual(decodeCursor(encodeCursor(cursor)), cursor);
    assert.equal(decodeCursor("not-a-cursor"), undefined);
  });
});
