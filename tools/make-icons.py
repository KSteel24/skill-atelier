#!/usr/bin/env python3
"""Erzeugt die PNG-Symbole (nur Standardbibliothek): Dokument mit Textzeilen auf grünem Grund. Aufruf: python3 tools/make-icons.py"""
import struct, zlib, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "icons"
BG, DOC, INK = (15, 118, 110), (255, 255, 255), (15, 118, 110)

def inside(x, y, x0, y0, x1, y1):
    return x0 <= x < x1 and y0 <= y < y1

def pixel(u, v):
    # u, v in [0,1); Inhalt liegt in der sicheren Zone (maskable)
    if inside(u, v, .30, .22, .70, .78):
        if v < .34 and u - v > .36:  # abgeschnittene Ecke oben rechts
            return BG
        for y0 in (.44, .54, .64):
            if inside(u, v, .36, y0, .64 if y0 != .64 else .54, y0 + .035):
                return INK
        return DOC
    return BG

def png(size, path):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel((x + .5) / size, (y + .5) / size))
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(data)

OUT.mkdir(exist_ok=True)
for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
    png(size, OUT / name)
    print(name, size)
