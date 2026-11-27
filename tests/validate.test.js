import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSkill, checkSkill, MAX_LINES } from "../src/validate.js";

const GOOD = `---
name: mein-skill
description: Kurze Beschreibung für Tests. Nutzen bei "test", "prüfen".
---

# Mein Skill

Ziel: etwas Nützliches tun.

## Ablauf
1. Erst prüfen.
2. Dann liefern.
`;

const codes = (r) => r.issues.map((i) => i.code);
const errors = (r) => r.issues.filter((i) => i.level === "fehler").map((i) => i.code);

test("parseSkill: liest Name, Beschreibung, Körper und Zeilenzahl", () => {
  const p = parseSkill(GOOD);
  assert.equal(p.name, "mein-skill");
  assert.match(p.description, /^Kurze Beschreibung/);
  assert.match(p.body, /# Mein Skill/);
  assert.equal(p.lines, GOOD.trimEnd().split("\n").length);
});

test("checkSkill: sauberer Skill hat keinen Fehler", () => {
  const r = checkSkill(GOOD);
  assert.deepEqual(errors(r), []);
  assert.equal(r.ok, true);
});

test("checkSkill: fehlendes Frontmatter ist ein Fehler", () => {
  const r = checkSkill("# Nur Text\n\nohne Kopf");
  assert.ok(errors(r).includes("frontmatter"));
  assert.equal(r.ok, false);
});

test("checkSkill: Name nur a-z, 0-9, Bindestrich, höchstens 64 Zeichen", () => {
  assert.ok(errors(checkSkill(GOOD.replace("mein-skill", "Mein_Skill"))).includes("name"));
  assert.ok(errors(checkSkill(GOOD.replace("mein-skill", "a".repeat(65)))).includes("name"));
  assert.ok(!errors(checkSkill(GOOD)).includes("name"));
});

test("checkSkill: Ordnername muss zum Namen passen", () => {
  assert.ok(errors(checkSkill(GOOD, { folder: "anderer-name" })).includes("ordner"));
  assert.ok(!errors(checkSkill(GOOD, { folder: "mein-skill" })).includes("ordner"));
});

test("checkSkill: Beschreibung höchstens 1024 Zeichen und nicht leer", () => {
  const lang = GOOD.replace(/description: .*/, "description: " + "x".repeat(1025));
  assert.ok(errors(checkSkill(lang)).includes("beschreibung"));
  const leer = GOOD.replace(/description: .*/, "description: ");
  assert.ok(errors(checkSkill(leer)).includes("beschreibung"));
});

test("checkSkill: Zeilenlimit 35 (ganze Datei), Grenze exakt", () => {
  assert.equal(MAX_LINES, 35);
  const pad = (n) => GOOD.trimEnd() + "\n" + Array.from({ length: n }, (_, i) => `- Punkt ${i}`).join("\n");
  const base = GOOD.trimEnd().split("\n").length;
  assert.ok(!errors(checkSkill(pad(MAX_LINES - base))).includes("zeilen"), "genau 35 ist erlaubt");
  assert.ok(errors(checkSkill(pad(MAX_LINES - base + 1))).includes("zeilen"), "36 ist zu viel");
  assert.ok(!errors(checkSkill(pad(MAX_LINES - base + 1), { maxLines: 60 })).includes("zeilen"), "Limit einstellbar");
});

test("checkSkill: leerer Körper ist ein Fehler", () => {
  const r = checkSkill("---\nname: leer\ndescription: Nutzen bei x.\n---\n");
  assert.ok(errors(r).includes("koerper"));
});

test("checkSkill: Gedankenstriche, Platzhalter und fehlendes Nutzen-bei warnen", () => {
  assert.ok(codes(checkSkill(GOOD + "\nEin Satz – mit Strich.")).includes("gedankenstrich"));
  assert.ok(codes(checkSkill(GOOD + "\nTODO: später")).includes("platzhalter"));
  assert.ok(codes(checkSkill(GOOD + "\nTBD")).includes("platzhalter"));
  assert.ok(codes(checkSkill(GOOD.replace("Nutzen bei", "Gut für"))).includes("trigger"));
  assert.deepEqual(codes(checkSkill(GOOD)), []);
});

test("checkSkill: Warnungen blockieren nicht (ok bleibt wahr)", () => {
  const r = checkSkill(GOOD + "\nTODO");
  assert.equal(r.ok, true);
  assert.ok(r.issues.length > 0);
});

test("checkSkill: Windows-Zeilenenden (CRLF) werden wie LF behandelt", () => {
  const r = checkSkill(GOOD.replace(/\n/g, "\r\n"));
  assert.deepEqual(errors(r), []);
  assert.equal(parseSkill(GOOD.replace(/\n/g, "\r\n")).name, "mein-skill");
});

test("checkSkill: nicht ausgefüllte Vorlagen-Platzhalter sind ein Fehler, mit Zeilennummer", () => {
  const text = GOOD + "\nZiel: <<ein Satz>>.";
  const r = checkSkill(text);
  assert.ok(errors(r).includes("vorlage"));
  assert.equal(r.ok, false);
  assert.equal(r.issues.find((i) => i.code === "vorlage").line, text.split("\n").length); // Platzhalter steht in der letzten Zeile
});

test("checkSkill: auch die alte Vorlagen-Schreibweise mit einfachen Klammern wird erkannt", () => {
  for (const p of ["<Schritt eins>", "<Fachgebiet in einem Satz>", '<Stichwort 1>', "<eine Zeile>"])
    assert.ok(errors(checkSkill(GOOD + "\n" + p)).includes("vorlage"), p);
});

test("checkSkill: echte Platzhalter wie <NAME> oder <IBAN> im Skilltext sind erlaubt", () => {
  assert.ok(!errors(checkSkill(GOOD + "\nPlatzhalter <NAME>, <IBAN>, <AKTENZEICHEN> sind Absicht.")).includes("vorlage"));
});

