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

test("newSkill: Vorlage ist bis zum Ausfüllen unfertig (nur Fehler: vorlage), danach fehlerfrei", () => {
  const t = newSkill("Kauf Berater");
  const p = parseSkill(t);
  assert.equal(p.name, "kauf-berater");
  const codes = (r) => r.issues.filter((i) => i.level === "fehler").map((i) => i.code);
  assert.deepEqual(codes(checkSkill(t, { folder: "kauf-berater" })), ["vorlage"]);
  const gefuellt = t.replace(/<<[^<>]+>>/g, "Text");
  assert.deepEqual(codes(checkSkill(gefuellt, { folder: "kauf-berater" })), []);
  assert.ok(p.lines <= 35);
});

test("newSkill: ungültiger Name ergibt einen Standardnamen", () => {
  assert.equal(parseSkill(newSkill("???")).name, "neuer-skill");
});
