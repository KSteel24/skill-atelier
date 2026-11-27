// Export und Import von Skills als ZIP (Ordner im Stamm, SKILL.md darin; Bündel: je Skill ein ZIP).
import { makeZip, readZip } from "./zip.js";
import { parseSkill } from "./validate.js";

const enc = new TextEncoder();
const strict = new TextDecoder("utf-8", { fatal: true });

export const exportSkillZip = (name, text) => makeZip([{ path: `${name}/SKILL.md`, data: enc.encode(text) }]);
export const exportBundle = (skills) => makeZip(skills.map((s) => ({ path: `${s.name}.zip`, data: exportSkillZip(s.name, s.text) })));

/** Liest ein Skill-ZIP oder ein Bündel (eine Ebene tief). Alles andere wird gezählt und ignoriert, nie ausgeführt. */
export async function importZip(bytes, depth = 0) {
  const result = { skills: [], ignored: 0 };
  for (const e of await readZip(bytes)) {
    if (/\.zip$/i.test(e.path)) {
      if (depth >= 1) { result.ignored++; continue; }
      try {
        const inner = await importZip(e.data, depth + 1);
        result.skills.push(...inner.skills);
        result.ignored += inner.ignored;
      } catch { result.ignored++; }
      continue;
    }
    const m = e.path.match(/^(?:(.+)\/)?SKILL\.md$/);
    if (!m) { result.ignored++; continue; }
    let text;
    try { text = strict.decode(e.data); } catch { result.ignored++; continue; }
    const name = (m[1] ?? "").split("/").pop() || parseSkill(text).name || "importiert";
    result.skills.push({ name, text });
  }
  return result;
}
