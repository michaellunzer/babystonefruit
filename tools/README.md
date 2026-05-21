# tools/ — vector-icon spike

Working tooling for converting Twemoji SVGs into Pebble Draw Command (PDC)
binaries. PDC is a vector format Pebble's runtime renders directly, which
keeps icons at a few hundred bytes each in RAM instead of ~20 KB per
72×72 RGBA bitmap. See [Pebble vector animations docs](https://developer.repebble.com/tutorials/advanced/vector-animations/).

## Files

| File | Purpose |
|---|---|
| `svg2pdc.py` | The original Pebble Examples script, ported to Python 3 (4 small fixes) |
| `pebble_image_routines.py` | Stub of the `pebble_image_routines` package — 64-color Pebble palette quantizer |
| `poop.svg` | Twemoji 1F4A9 source SVG, preprocessed (4 `<ellipse>` → `<circle>` since svg2pdc doesn't support ellipses) |
| `poop.pdc` | Generated vector icon — **227 bytes** vs 858 bytes for the source PNG, vs ~20 KB decoded RGBA |
| `poop.svg.png` | QuickLook rasterization of the preprocessed SVG — exactly what the watch will render (modulo coordinate snapping to Pebble's 0.5-pixel grid) |

## Reproducing

```bash
python3 svg2pdc.py poop.svg
```

Generates `poop.pdc` alongside the input. The script warns about coordinates
being snapped to the nearest 0.5-pixel grid (Pebble's fixed-point precision),
which is harmless.

## Python 3 fixes vs upstream svg2pdc.py

The upstream [`svg2pdc.py`](https://github.com/pebble-examples/cards-example/blob/master/tools/svg2pdc.py)
is Python 2. To make it run on modern Python:

1. `print "..."` → `print("...")` (auto-converted via `python3 -m lib2to3 -w svg2pdc.py`)
2. `group.getchildren()` → `list(group)` (removed in Python 3)
3. `output = "PDCS" / "PDCI"` → `output = b"PDCS" / b"PDCI"` (bytes vs str)
4. `open(out_path, 'w')` → `open(out_path, 'wb')` (bytes I/O)
5. `pack('H', self.radius)` → `pack('H', int(round(self.radius)))` (struct needs int)

## SVG preprocessing

`svg2pdc.py`'s supported primitives are `path`, `rect`, `polyline`, `polygon`,
`line`, `circle`. It does **not** support `<ellipse>`. Twemoji uses ellipses
for the eyes (3.5×4.5) and pupils (2×2.5) — those were rewritten as circles
(r=4 and r=2 respectively). The result is barely distinguishable from the
original.

Twemoji uses only flat fills (no gradients), so the rest converts cleanly.
