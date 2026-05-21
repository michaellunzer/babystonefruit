"""
Minimal stub of pebble_image_routines for svg2pdc.py.

Pebble color palette uses 2 bits per channel — each RGB component must be
one of {0, 85, 170, 255} and alpha is one of {0, 85, 170, 255}.
Result is packed into a single ARGB8 byte: AARRGGBB with 2 bits each.
"""

_CHANNELS = (0, 85, 170, 255)


def _nearest(c):
    return min(_CHANNELS, key=lambda v: abs(v - c))


def _truncate(c):
    # Round down to the lowest channel level that's still <= c.
    last = 0
    for v in _CHANNELS:
        if v <= c:
            last = v
        else:
            break
    return last


def pebble_nearest_color_to_pebble_palette(r, g, b, a):
    return (_nearest(r), _nearest(g), _nearest(b), _nearest(a))


def pebble_truncate_color_to_pebble_palette(r, g, b, a):
    return (_truncate(r), _truncate(g), _truncate(b), _truncate(a))


def rgba32_triplet_to_argb8(r, g, b, a):
    """Pack 8-bit channels into Pebble's ARGB8 byte (2 bits each)."""
    return ((a // 85) << 6) | ((r // 85) << 4) | ((g // 85) << 2) | (b // 85)
