// Prüfregeln für SKILL.md nach dem God-Tier-Standard (reine Funktionen, laufen im Browser und in Node).
export const MAX_LINES = 35;
export const MAX_DESCRIPTION = 1024;

const norm = (t) => String(t ?? "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");

/** Zerlegt eine SKILL.md in Frontmatter-Felder und Körper. `lines` zählt die ganze Datei ohne abschließende Leerzeilen. */
export function parseSkill(text) {
  const t = norm(text);
  const lines = t.trimEnd() === "" ? 0 : t.trimEnd().split("\n").length;
  const m = t.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!m) return { hasFrontmatter: false, name: "", description: "", body: t, lines, fields: {} };
  const fields = {};
  for (const l of m[1].split("\n")) {
    const i = l.indexOf(":");
    if (i > 0) fields[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return {
    hasFrontmatter: true,
    name: fields.name ?? "",
    description: fields.description ?? "",
    body: t.slice(m[0].length),
    lines,
    fields,
  };
}

// Vorlagen-Platzhalter <<...>> (neu) und die exakten Texte der alten Vorlage mit einfachen Klammern. <NAME> und ähnliche bleiben erlaubt.
const PLACEHOLDER = /<<[^<>]+>>|<(?:Fachgebiet in einem Satz|Stichwort [12]|ein Satz|eine Zeile|Schritt (?:eins|zwei|drei)|Format der Antwort in einer Zeile\.)>/;

const lineOf = (t, re) => {
  const i = t.split("\n").findIndex((l) => re.test(l));
  return i < 0 ? undefined : i + 1;
};

/** Prüft einen Skill. Fehler blockieren den Export-Hinweis `ok`, Warnungen nicht. */
export function checkSkill(text, { folder, maxLines = MAX_LINES } = {}) {
  const t = norm(text);
  const p = parseSkill(t);
  const issues = [];
  const add = (level, code, msg, line) => issues.push({ level, code, msg, ...(line ? { line } : {}) });

  if (!p.hasFrontmatter) {
    add("fehler", "frontmatter", "Frontmatter fehlt: Die Datei beginnt mit --- , dann name: und description:, dann ---.");
    return { ok: false, issues, parsed: p };
  }
  if (!/^[a-z0-9-]{1,64}$/.test(p.name)) add("fehler", "name", "name: nur a-z, 0-9 und Bindestrich, 1 bis 64 Zeichen.");
  if (folder !== undefined && p.name && folder !== p.name) add("fehler", "ordner", `Ordnername „${folder}“ passt nicht zu name „${p.name}“.`);
  if (!p.description) add("fehler", "beschreibung", "description: fehlt oder ist leer.");
  else if (p.description.length > MAX_DESCRIPTION) add("fehler", "beschreibung", `description: ${p.description.length} Zeichen, erlaubt sind ${MAX_DESCRIPTION}.`);
  else if (!/Nutzen bei/i.test(p.description)) add("warnung", "trigger", "description: enthält kein „Nutzen bei …“ mit Auslösewörtern.");
  if (p.lines > maxLines) add("fehler", "zeilen", `${p.lines} Zeilen, erlaubt sind ${maxLines}.`);
  if (!p.body.trim()) add("fehler", "koerper", "Der Körper ist leer.");
  const vt = lineOf(t, PLACEHOLDER);
  if (vt) add("fehler", "vorlage", "Nicht ausgefüllter Vorlagen-Platzhalter: durch echten Text ersetzen.", vt);
  const d = lineOf(t, /[—–]/);
  if (d) add("warnung", "gedankenstrich", "Gedankenstrich gefunden: durch Komma, Punkt oder Doppelpunkt ersetzen.", d);
  const ph = lineOf(t, /\b(TODO|TBD|XXX|FIXME)\b/);
  if (ph) add("warnung", "platzhalter", "Platzhalter gefunden (TODO, TBD, XXX, FIXME).", ph);
  return { ok: !issues.some((i) => i.level === "fehler"), issues, parsed: p };
}
