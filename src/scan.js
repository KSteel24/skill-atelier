// Browser-Fassung der Textregeln aus scripts/vet-scan.sh. Eine Hilfe, kein Ersatz: das Skript und das Lesen bleiben maßgeblich.
// Netzwerk- und Ausführungsregeln für Code gibt es hier nicht, weil nur SKILL.md-Text geprüft wird.
const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]/;
const RULES = [
  ["html-kommentar", "HTML-Kommentar (für Menschen unsichtbar, von Claude gelesen)", /<!--/],
  ["unsichtbar", "Unsichtbares oder umlenkendes Unicode-Zeichen", INVISIBLE],
  ["base64", "Lange Base64-artige Kette (kodierte Nutzlast)", /[A-Za-z0-9+/]{80,}={0,2}/],
  ["wirkung", "Konfiguration mit Wirkung (hooks, allowed-tools, mcpServers)", /(^|[{,\s])"?(hooks|allowed-tools|allowedTools|mcpServers|PreToolUse|SessionStart)"?\s*:/],
  [
    "ausleitung",
    "Geheimnis neben Versand (mögliche Ausleitung)",
    /(\.env|id_rsa|api[_-]?key|token|password|secret|credential).*(send|post|upload|sync|curl|wget|fetch|webhook)|(send|post|upload|sync|curl|wget|fetch|webhook).*(\.env|id_rsa|api[_-]?key|token|password|secret|credential)/i,
  ],
  ["telemetrie", "Telemetrie, Analytics, Konten", /(telemetry|analytics|posthog|sentry|mixpanel|segment\.io|amplitude)/i],
  ["verschweigen", "Anweisung zum Verschweigen oder Überstimmen", /(do not (tell|mention|reveal)|never (mention|tell)|ignore (all |any )?(previous|prior|above)|nicht erwähn|verschweig)/i],
];
export const RULE_TITLES = Object.fromEntries(RULES.map(([id, title]) => [id, title]));

const MAX_PER_RULE = 20;
const MAX_LEN = 200;

/** Macht fremden Text anzeigbar: Steuerzeichen raus, unsichtbare Zeichen sichtbar markieren, Länge begrenzen. */
const safe = (l) =>
  l
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(new RegExp(INVISIBLE.source, "g"), (c) => `⟦U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}⟧`)
    .slice(0, MAX_LEN);

export function scanText(text) {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  for (const [rule, title, re] of RULES) {
    let n = 0;
    for (let i = 0; i < lines.length && n < MAX_PER_RULE; i++) {
      if (re.test(lines[i])) {
        out.push({ rule, title, line: i + 1, snippet: safe(lines[i]) });
        n++;
      }
    }
  }
  return out.sort((a, b) => a.line - b.line);
}
