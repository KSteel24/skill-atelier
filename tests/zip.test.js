import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, makeZip, readZip, ZipError } from "../src/zip.js";

const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);
const have = (cmd, args) => { try { execFileSync(cmd, args, { stdio: "ignore" }); return true; } catch { return false; } };

test("crc32: Standard-Prüfvektor 123456789 = CBF43926", () => {
  assert.equal(crc32(enc("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
});

test("makeZip und readZip: Rundreise mit Umlauten und leerer Datei", async () => {
  const files = [
    { path: "mein-skill/SKILL.md", data: enc("# Größe äöü ß\n") },
    { path: "mein-skill/leer.txt", data: new Uint8Array() },
  ];
  const out = await readZip(makeZip(files));
  assert.deepEqual(out.map((e) => e.path), files.map((f) => f.path));
  assert.equal(dec(out[0].data), "# Größe äöü ß\n");
  assert.equal(out[1].data.length, 0);
});

test("makeZip: von unzip und Python als gültig akzeptiert (Normkonformität)", { skip: !have("unzip", ["-v"]) && !have("python3", ["-V"]) }, () => {
  const dir = mkdtempSync(join(tmpdir(), "atelier-"));
  try {
    const f = join(dir, "t.zip");
    writeFileSync(f, makeZip([{ path: "a/SKILL.md", data: enc("Inhalt äö\n".repeat(50)) }, { path: "a/b.txt", data: enc("x") }]));
    if (have("unzip", ["-v"])) execFileSync("unzip", ["-tqq", f]);
    if (have("python3", ["-V"])) execFileSync("python3", ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.namelist()==['a/SKILL.md','a/b.txt']", f]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("readZip: liest auch komprimierte Archive (deflate), erzeugt mit Python", { skip: !have("python3", ["-V"]) }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "atelier-"));
  try {
    const f = join(dir, "d.zip");
    execFileSync("python3", ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED); z.writestr('x/SKILL.md','Hallo '*200); z.close()", f]);
    const { readFileSync } = await import("node:fs");
    const out = await readZip(new Uint8Array(readFileSync(f)));
    assert.equal(out[0].path, "x/SKILL.md");
    assert.equal(dec(out[0].data), "Hallo ".repeat(200));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("readZip: unsichere Pfade werden abgelehnt (.., absolut, Backslash-Laufwerk)", async () => {
  for (const p of ["../evil.md", "/etc/passwd", "a/../../b", "C:\\x.md"])
    await assert.rejects(() => readZip(makeZip([{ path: p, data: enc("x") }])), ZipError, p);
});

test("readZip: Grenzen gegen ZIP-Bomben (Dateizahl, Dateigröße)", async () => {
  const viele = Array.from({ length: 6 }, (_, i) => ({ path: `f${i}.md`, data: enc("x") }));
  await assert.rejects(() => readZip(makeZip(viele), { maxEntries: 5 }), ZipError);
  await assert.rejects(() => readZip(makeZip([{ path: "g.md", data: new Uint8Array(1000) }]), { maxBytes: 999 }), ZipError);
});

test("readZip: kaputte oder fremde Daten ergeben ZipError, keine Ausnahme anderer Art", async () => {
  await assert.rejects(() => readZip(enc("kein zip")), ZipError);
  await assert.rejects(() => readZip(new Uint8Array()), ZipError);
  const z = makeZip([{ path: "a.md", data: enc("hallo") }]);
  z[z.length - 30] ^= 0xff;
  await assert.rejects(() => readZip(z.slice(0, z.length - 10)), ZipError);
});

test("readZip: falsche Prüfsumme wird erkannt", async () => {
  const z = makeZip([{ path: "a.md", data: enc("hallo welt") }]);
  const i = z.indexOf(0x68, 30); // erstes 'h' der Nutzdaten
  z[i] = 0x48;
  await assert.rejects(() => readZip(z), /Prüfsumme/);
});
