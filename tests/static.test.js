import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const sw = read("sw.js");
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]$/, "]"));

test("Service Worker: jede gelistete Datei existiert", () => {
  for (const a of assets.filter((x) => x !== "./")) assert.ok(existsSync(join(root, a)), a);
});

test("Service Worker: alle lokal eingebundenen Dateien stehen in der Liste", () => {
  const html = read("index.html");
  const refs = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 5);
  for (const r of refs) assert.ok(assets.includes(r), `fehlt im Service Worker: ${r}`);
  for (const f of readdirSync(join(root, "src")).filter((x) => x.endsWith(".js"))) assert.ok(assets.includes("src/" + f), `fehlt: src/${f}`);
  const manifest = JSON.parse(read("manifest.webmanifest"));
  for (const i of manifest.icons) assert.ok(assets.includes(i.src), i.src);
});

test("Datenschutz: keine externen Adressen in Seite, Stil, Skripten und Manifest", () => {
  const files = ["index.html", "styles.css", "manifest.webmanifest", "sw.js", ...readdirSync(join(root, "src")).map((f) => "src/" + f)];
  for (const f of files) assert.doesNotMatch(read(f), /(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i, `externe Adresse in ${f}`);
});

test("Sicherheit: strenge CSP, kein Inline-Skript, kein Inline-Stil, keine Ereignis-Attribute, kein innerHTML", () => {
  const html = read("index.html");
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  for (const d of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(d), d);
  assert.doesNotMatch(csp, /unsafe|\*|https?:/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, "Inline-Skript");
  assert.doesNotMatch(html, /<style/i);
  assert.doesNotMatch(html, /\son[a-z]+=/i, "Ereignis-Attribut");
  assert.doesNotMatch(html, /style="/i);
  for (const f of readdirSync(join(root, "src")).filter((x) => x.endsWith(".js")))
    assert.doesNotMatch(read("src/" + f), /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, f);
});

test("Eingabefeld: iOS-Auto-Korrektur aus (sonst werden aus -- Gedankenstriche)", () => {
  const html = read("index.html");
  for (const a of ['autocorrect="off"', 'autocapitalize="off"', 'spellcheck="false"']) assert.ok(html.includes(a), a);
});
