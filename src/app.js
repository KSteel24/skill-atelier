import { checkSkill, parseSkill, MAX_LINES } from "./validate.js";
import { scanText } from "./scan.js";
import { newSkill } from "./template.js";
import { exportSkillZip, exportBundle, importZip } from "./bundle.js";

const KEY = "atelier.v1";
const APP_VERSION = "v3";
const $ = (id) => document.getElementById(id);
const el = { select: $("select"), editor: $("editor"), lines: $("lines"), counts: $("counts"), issues: $("issues"), scan: $("scan"), status: $("status") };

let skills = [];
let sel = "";
let deleteArmed = 0;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const nameOf = (s) => parseSkill(s.text).name || "unbenannt";
const current = () => skills.find((s) => s.id === sel);
const say = (msg) => { el.status.textContent = msg; };

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    if (d && Array.isArray(d.skills)) {
      skills = d.skills.filter((s) => s && typeof s.id === "string" && typeof s.text === "string");
      sel = d.sel;
    }
  } catch { /* leer starten */ }
  if (!skills.length) { skills = [{ id: uid(), text: newSkill("Mein erster Skill") }]; }
  if (!current()) sel = skills[0].id;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ skills, sel })); }
  catch { say("Speichern im Browser nicht möglich (privater Modus oder voll). Bitte jetzt exportieren."); }
}

function uniqueName(base) {
  const taken = new Set(skills.map(nameOf));
  let n = base, i = 2;
  while (taken.has(n)) n = `${base}-${i++}`;
  return n;
}

function li(cls, text, small) {
  const x = document.createElement("li");
  x.className = cls;
  x.textContent = text;
  if (small) { const s = document.createElement("small"); s.textContent = small; x.append(s); }
  return x;
}

function renderSelect() {
  el.select.replaceChildren(...skills.map((s) => {
    const o = document.createElement("option");
    const r = checkSkill(s.text);
    o.value = s.id;
    o.textContent = `${r.ok ? "✓" : "✗"} ${nameOf(s)}`;
    o.selected = s.id === sel;
    return o;
  }));
}

function renderChecks() {
  const s = current();
  const r = checkSkill(s.text);
  const errs = r.issues.filter((i) => i.level === "fehler").length;
  const warns = r.issues.length - errs;
  el.lines.textContent = `Zeilen ${r.parsed.lines}/${MAX_LINES}`;
  el.lines.className = "chip " + (r.parsed.lines > MAX_LINES ? "err" : "ok");
  el.counts.textContent = `${errs} Fehler · ${warns} Warnungen`;
  el.counts.className = "chip " + (errs ? "err" : warns ? "warn" : "ok");
  el.issues.replaceChildren(...(r.issues.length
    ? r.issues.map((i) => li(i.level === "fehler" ? "err" : "warn", `${i.level === "fehler" ? "Fehler" : "Warnung"}${i.line ? ` (Zeile ${i.line})` : ""}: ${i.msg}`))
    : [li("ok", "Alle Prüfungen bestanden.")]));
  const f = scanText(s.text);
  el.scan.replaceChildren(...(f.length
    ? f.map((x) => li("err", `Zeile ${x.line}: ${x.title}`, x.snippet))
    : [li("ok", "Keine Treffer.")]));
}

function render() { renderSelect(); el.editor.value = current().text; renderChecks(); }

function onInput() {
  current().text = el.editor.value;
  save();
  renderSelect();
  renderChecks();
}

function dupNames() {
  const seen = new Set(), dup = new Set();
  for (const s of skills) { const n = nameOf(s); (seen.has(n) ? dup : seen).add(n); }
  return [...dup];
}

async function deliver(bytes, filename) {
  const file = new File([bytes], filename, { type: "application/zip" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return `${filename} geteilt.`; }
    catch (e) { if (e && e.name === "AbortError") return "Abgebrochen."; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return `${filename} heruntergeladen.`;
}

$("select").addEventListener("change", () => { sel = el.select.value; save(); render(); say(""); });
el.editor.addEventListener("input", onInput);
$("new").addEventListener("click", () => {
  const s = { id: uid(), text: newSkill(uniqueName("neuer-skill")) };
  skills.push(s); sel = s.id; save(); render(); say("Neuer Skill aus der Vorlage."); el.editor.focus();
});
$("delete").addEventListener("click", () => {
  const b = $("delete");
  if (!deleteArmed) {
    deleteArmed = setTimeout(() => { deleteArmed = 0; b.textContent = "Löschen"; }, 4000);
    b.textContent = "Wirklich löschen?";
    return;
  }
  clearTimeout(deleteArmed); deleteArmed = 0; b.textContent = "Löschen";
  const gone = nameOf(current());
  skills = skills.filter((s) => s.id !== sel);
  if (!skills.length) skills = [{ id: uid(), text: newSkill("Mein erster Skill") }];
  sel = skills[0].id; save(); render(); say(`„${gone}“ gelöscht.`);
});
$("export").addEventListener("click", async () => {
  const s = current(), r = checkSkill(s.text), n = nameOf(s);
  if (!r.ok) { const e = r.issues.find((i) => i.level === "fehler"); return say(`Nicht exportiert. Zuerst beheben: ${e.msg}`); }
  say(await deliver(exportSkillZip(n, s.text), `${n}.zip`));
});
$("bundle").addEventListener("click", async () => {
  const d = dupNames();
  if (d.length) return say(`Nicht exportiert: Name doppelt (${d.join(", ")}).`);
  const bad = skills.filter((s) => !checkSkill(s.text).ok).map(nameOf);
  if (bad.length) return say(`Nicht exportiert: Fehler in ${bad.join(", ")}.`);
  say(await deliver(exportBundle(skills.map((s) => ({ name: nameOf(s), text: s.text }))), "skills-buendel.zip"));
});
$("import").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", async (ev) => {
  const f = ev.target.files[0];
  ev.target.value = "";
  if (!f) return;
  try {
    const r = await importZip(new Uint8Array(await f.arrayBuffer()));
    const have = new Set(skills.map(nameOf));
    let added = 0, skipped = 0;
    for (const s of r.skills) {
      if (have.has(s.name)) { skipped++; continue; }
      skills.push({ id: uid(), text: s.text }); have.add(s.name); added++;
    }
    if (added) sel = skills[skills.length - 1].id;
    save(); render();
    say(`${added} importiert, ${skipped} übersprungen (Name schon vorhanden), ${r.ignored} Dateien ignoriert.`);
  } catch (e) {
    say(`Import fehlgeschlagen: ${e && e.name === "ZipError" ? e.message : "Datei nicht lesbar"}.`);
  }
});

load();
render();
$("ver").textContent = `Version ${APP_VERSION}`;
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) say("Neue Version geladen. Bitte die App einmal schließen und neu öffnen.");
  });
}
