import { test } from "node:test";
import assert from "node:assert/strict";
import { exportSkillZip, exportBundle, importZip } from "../src/bundle.js";
import { readZip } from "../src/zip.js";
import { newSkill } from "../src/template.js";

const dec = (b) => new TextDecoder().decode(b);

test("exportSkillZip: Ordner im Stamm, SKILL.md darin", async () => {
  const text = newSkill("Test Eins");
  const out = await readZip(exportSkillZip("test-eins", text));
  assert.deepEqual(out.map((e) => e.path), ["test-eins/SKILL.md"]);
  assert.equal(dec(out[0].data), text);
});

test("exportBundle: je Skill ein ZIP im äußeren ZIP", async () => {
  const skills = [{ name: "a-eins", text: newSkill("a eins") }, { name: "b-zwei", text: newSkill("b zwei") }];
  const outer = await readZip(exportBundle(skills));
  assert.deepEqual(outer.map((e) => e.path), ["a-eins.zip", "b-zwei.zip"]);
  const inner = await readZip(outer[1].data);
  assert.equal(inner[0].path, "b-zwei/SKILL.md");
});

test("importZip: einzelnes Skill-ZIP, Bündel und lose SKILL.md", async () => {
  const t1 = newSkill("Eins"), t2 = newSkill("Zwei");
  const e1 = await importZip(exportSkillZip("eins", t1));
  assert.deepEqual(e1.skills.map((s) => s.name), ["eins"]);
  const b = await importZip(exportBundle([{ name: "eins", text: t1 }, { name: "zwei", text: t2 }]));
  assert.deepEqual(b.skills.map((s) => s.name).sort(), ["eins", "zwei"]);
  assert.equal(b.skills.find((s) => s.name === "zwei").text, t2);
});

test("importZip: fremde Dateien werden gezählt und ignoriert", async () => {
  const { makeZip } = await import("../src/zip.js");
  const enc = (s) => new TextEncoder().encode(s);
  const r = await importZip(makeZip([{ path: "x/SKILL.md", data: enc(newSkill("x")) }, { path: "x/run.sh", data: enc("rm -rf /") }, { path: "x/bild.png", data: enc("..") }]));
  assert.equal(r.skills.length, 1);
  assert.equal(r.ignored, 2);
});

test("importZip: kein gültiges UTF-8 in SKILL.md wird abgelehnt statt still verändert", async () => {
  const { makeZip } = await import("../src/zip.js");
  const r = await importZip(makeZip([{ path: "x/SKILL.md", data: new Uint8Array([0xff, 0xfe, 0x41]) }]));
  assert.equal(r.skills.length, 0);
  assert.equal(r.ignored, 1);
});
