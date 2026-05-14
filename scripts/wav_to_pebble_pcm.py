#!/usr/bin/env python3
"""
Convert a WAV file to Pebble Speaker-compatible raw PCM.

Pebble Speaker API accepts mono signed PCM at 8 kHz or 16 kHz, 8-bit or 16-bit.
This script targets 8 kHz / 8-bit / mono — the smallest format — which is fine
for short UI feedback clips and keeps resource size near 8 KB per second.

Usage:
    python3 scripts/wav_to_pebble_pcm.py <input.wav> <output.pcm>

Output is raw PCM bytes (no header). Each byte is a signed 8-bit sample.
"""

import sys
import wave
import audioop


def convert(src_path: str, dst_path: str, target_sr: int = 8000) -> None:
    with wave.open(src_path, "rb") as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        sw = w.getsampwidth()
        frames = w.readframes(w.getnframes())

    if ch == 2:
        frames = audioop.tomono(frames, sw, 1, 1)
    if sr != target_sr:
        frames, _ = audioop.ratecv(frames, sw, 1, sr, target_sr, None)
    if sw != 1:
        frames = audioop.lin2lin(frames, sw, 1)   # audioop emits signed bytes

    with open(dst_path, "wb") as f:
        f.write(frames)

    print(
        f"{src_path} -> {dst_path}: "
        f"{target_sr} Hz, mono, 8-bit signed, "
        f"{len(frames) / target_sr:.2f}s, {len(frames)} bytes"
    )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])
