// Vorlage und Namensbildung nach dem God-Tier-Standard.
export function slugify(s) {
  const t = String(s ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return t.slice(0, 64).replace(/-+$/, "");
}

export function newSkill(title) {
  const name = slugify(title) || "neuer-skill";
  const heading = String(title ?? "").replace(/[\r\n]+/g, " ").trim() || name;
  return `---
name: ${name}
description: <Fachgebiet in einem Satz>. Nutzen bei "<Stichwort 1>", "<Stichwort 2>".
---

# ${heading}

Ziel: <ein Satz>. Grenzen: <eine Zeile>.

## Ablauf
1. <Schritt eins>
2. <Schritt zwei>
3. <Schritt drei>

## Abgabe
<Format der Antwort in einer Zeile.>
`;
}
