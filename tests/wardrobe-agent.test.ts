import test from "node:test";
import assert from "node:assert/strict";
import { defaultPlans, garments, wardrobeAgent } from "../src/lib/wardrobe-agent.ts";
import { imageExtension } from "../src/lib/image-validation.ts";

test("the provided day-to-evening schedule picks the overshirt", () => {
  assert.equal(wardrobeAgent(defaultPlans).garment.id, "black-overshirt");
  assert.match(wardrobeAgent(defaultPlans).reason, /class.*dinner/);
});

test("evening keywords override comfort keywords", () => {
  for (const word of ["dinner", "date", "restaurant", "going out", "event"]) {
    assert.equal(wardrobeAgent(`A comfortable ${word}`).garment.id, "black-overshirt", word);
  }
});

test("formal plans get a sweater, including smart casual", () => {
  for (const word of ["meeting", "presentation", "interview", "formal", "smart casual"]) {
    assert.equal(wardrobeAgent(word).garment.id, "white-sweater", word);
  }
});

test("mixed class and social plans take priority over other categories", () => {
  assert.equal(wardrobeAgent("Classes, a presentation, then dinner").garment.id, "black-overshirt");
  assert.equal(wardrobeAgent("Class then food with friends tonight").garment.id, "black-overshirt");
});

test("relaxed and unspecified days default to a hoodie", () => {
  for (const text of ["study", "library", "casual", "relaxing", "comfortable", "", "walking the dog"]) {
    assert.equal(wardrobeAgent(text).garment.id, "grey-hoodie", text);
  }
});

test("word matching avoids incidental substrings and supports case", () => {
  assert.equal(wardrobeAgent("Update my notes").garment.id, "grey-hoodie");
  assert.equal(wardrobeAgent("DINNER").garment.id, "black-overshirt");
});

test("exactly three presets all use upper body swapping", () => {
  assert.equal(garments.length, 3);
  assert.ok(garments.every((item) => item.garmentType === "upper_body"));
});

test("image validation accepts JPEG/PNG signatures and rejects disguised files", () => {
  assert.equal(imageExtension(new Uint8Array([255, 216, 255, 224])), "jpg");
  assert.equal(imageExtension(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), "png");
  assert.equal(imageExtension(new TextEncoder().encode("<svg></svg>")), null);
  assert.equal(imageExtension(new Uint8Array()), null);
});
