// Minimaler ZIP-Schreiber und -Leser ohne Abhängigkeiten. Schreiben: ohne Kompression (gültig und von jedem Programm lesbar).
// Lesen: gespeichert und deflate. Mit Grenzen gegen ZIP-Bomben und Pfad-Tricks.
export class ZipError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "ZipError";
  }
}

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // fester Zeitstempel: gleiche Eingabe ergibt gleiche Datei
const enc = new TextEncoder();

export function makeZip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const f of files) {
    const name = enc.encode(f.path);
    const data = f.data;
    const crc = crc32(data);
    const head = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(DOS_DATE),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
    ]);
    parts.push(head, name, data);
    central.push(
      Uint8Array.from([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(DOS_DATE),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
      ]),
      name,
    );
    offset += head.length + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0),
  ]);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const b of all) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

const unsafe = (p) => !p || p.startsWith("/") || /^[A-Za-z]:/.test(p) || p.includes("\0") || p.split(/[\\/]/).includes("..");

async function inflate(bytes, maxBytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ZipError("Datei entpackt zu groß");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

/** Liest ein ZIP. Gibt [{path, data}] in Archivreihenfolge zurück, Verzeichnisse werden übersprungen. */
export async function readZip(bytes, { maxEntries = 200, maxBytes = 2 * 1024 * 1024 } = {}) {
  try {
    return await read(bytes, maxEntries, maxBytes);
  } catch (e) {
    if (e instanceof ZipError) throw e;
    throw new ZipError("ZIP nicht lesbar");
  }
}

async function read(bytes, maxEntries, maxBytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 22) throw new ZipError("Kein ZIP");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("Kein ZIP (Endkennung fehlt)");
  const count = dv.getUint16(eocd + 10, true);
  let cd = dv.getUint32(eocd + 16, true);
  if (count === 0xffff || cd === 0xffffffff) throw new ZipError("ZIP64 wird nicht unterstützt");
  if (count > maxEntries) throw new ZipError(`Zu viele Dateien (${count}, erlaubt ${maxEntries})`);
  const dec = new TextDecoder("utf-8");
  const out = [];
  for (let n = 0; n < count; n++) {
    if (cd + 46 > bytes.length || dv.getUint32(cd, true) !== 0x02014b50) throw new ZipError("Zentralverzeichnis beschädigt");
    const flags = dv.getUint16(cd + 8, true);
    const method = dv.getUint16(cd + 10, true);
    const crc = dv.getUint32(cd + 16, true);
    const csize = dv.getUint32(cd + 20, true);
    const usize = dv.getUint32(cd + 24, true);
    const nlen = dv.getUint16(cd + 28, true);
    const xlen = dv.getUint16(cd + 30, true);
    const clen = dv.getUint16(cd + 32, true);
    const lho = dv.getUint32(cd + 42, true);
    if (csize === 0xffffffff || usize === 0xffffffff) throw new ZipError("ZIP64 wird nicht unterstützt");
    if (flags & 1) throw new ZipError("Verschlüsselte ZIPs werden nicht unterstützt");
    const path = dec.decode(bytes.subarray(cd + 46, cd + 46 + nlen));
    cd += 46 + nlen + xlen + clen;
    if (unsafe(path)) throw new ZipError(`Unsicherer Pfad: ${path.slice(0, 80)}`);
    if (path.endsWith("/")) continue;
    if (usize > maxBytes) throw new ZipError(`Datei zu groß: ${path.slice(0, 80)}`);
    if (lho + 30 > bytes.length || dv.getUint32(lho, true) !== 0x04034b50) throw new ZipError("Lokaler Kopf beschädigt");
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    if (start + csize > bytes.length) throw new ZipError("Daten abgeschnitten");
    const raw = bytes.subarray(start, start + csize);
    let data;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflate(raw, maxBytes);
    else throw new ZipError(`Kompressionsart ${method} wird nicht unterstützt`);
    if (data.length !== usize) throw new ZipError(`Größe stimmt nicht: ${path.slice(0, 80)}`);
    if (crc32(data) !== crc) throw new ZipError(`Prüfsumme stimmt nicht: ${path.slice(0, 80)}`);
    out.push({ path, data });
  }
  return out;
}
