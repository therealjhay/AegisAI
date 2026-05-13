import { strict as assert } from "node:assert";
import test from "node:test";
import { scoreSourceCredibility } from "./verification.js";

test("scoreSourceCredibility returns high score for trusted sources", () => {
  assert.equal(scoreSourceCredibility("gdacs"), 0.95);
});

test("scoreSourceCredibility returns default low score for unknown source", () => {
  assert.equal(scoreSourceCredibility("unrecognized_feed"), 0.2);
});
