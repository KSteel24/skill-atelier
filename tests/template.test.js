import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, newSkill } from "../src/template.js";
import { checkSkill, parseSkill } from "../src/validate.js";

test("slugify: Umlaute, Sonderzeichen, Länge", () => {
  assert.equal(slugify("Mein Skill ÄÖÜ ß!"), "mein-skill-aeoeue-ss");
  assert.equal(slugify("  --a__b--  "), "a-b");
  assert.equal(slugify("!!!"), "");
  assert.equal(slugify("x".repeat(100)).length, 64);
});

test("newSkill: Vorlage besteht die eigene Prüfung und trägt den Namen", () => {
  const t = newSkill("Kauf Berater");
  const p = parseSkill(t);
  assert.equal(p.name, "kauf-berater");
  const r = checkSkill(t, { folder: "kauf-berater" });
  assert.deepEqual(r.issues.filter((i) => i.level === "fehler"), []);
  assert.ok(p.lines <= 35);
});

test("newSkill: ungültiger Name ergibt einen Standardnamen", () => {
  assert.equal(parseSkill(newSkill("???")).name, "neuer-skill");
});
