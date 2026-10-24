#!/usr/bin/env python3
"""Synthesise the sound-effects library the ads are sound designed with.

Laid out like the Ultimate Editors library (whooshes / textures / risers / hits), three variations of every
sound, so each cue can pick the variation whose length, pace and weight fit the moment. Nothing is sampled:
no licence needed.

    python3 scripts/sfx.py   → public/sfx/<family>/<sound>_<n>.wav + src/sfx-manifest.json

The manifest records, per file, its length and its alignment point ("align", seconds into the file):
  whooshes  → the loudest point, to sit on the fastest frame of the movement
  textures, hits → the transient, to sit on the event frame
  risers    → the peak at the end, to land on the transition frame
Every file is normalised to -1 dBFS, so the cue sheet's dB values are relative to a full-scale sound.
"""
import json
import os
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "public", "sfx")
SR = 48000


def s(t):
    return int(round(t * SR))


def tt(n):
    return np.arange(n) / SR


def filt(x, kind, f, order=2):
    f = [min(max(v, 20), SR / 2 - 200) for v in f] if isinstance(f, (list, tuple)) else min(max(f, 20), SR / 2 - 200)
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def sweep_band(noise, lows, width=2.3):
    """Band-passed noise whose band moves through `lows` over the length (crossfaded bands, no zipper)."""
    n = len(noise)
    parts = [filt(noise, "bandpass", [lo, lo * width]) for lo in lows]
    pos = np.linspace(0, len(parts) - 1, n)
    out = np.zeros(n)
    for k, p in enumerate(parts):
        out += p * np.clip(1 - np.abs(pos - k), 0, 1)
    return out


def env_peak(n, peak_at, rise=2.0, fall=1.6):
    """0 → 1 → 0 with the top at `peak_at` (0–1 of the length)."""
    x = np.linspace(0, 1, n)
    up = np.clip(x / peak_at, 0, 1) ** rise
    down = np.clip((1 - x) / (1 - peak_at), 0, 1) ** fall
    return np.where(x < peak_at, up, down)


def comb(x, delay_s, fb):
    d = max(1, s(delay_s))
    y = x.copy()
    for i in range(d, len(y)):
        y[i] += fb * y[i - d]
    return y


def stereo(x, width=0.0, rng=None):
    """Mono → stereo with a little decorrelation."""
    if not width:
        return np.stack([x, x])
    d = s(0.004 * width)
    r = np.concatenate([np.zeros(d), x[:-d]]) if d else x
    return np.stack([x, r])


def write(family, name, i, x, kind):
    x = np.asarray(x, dtype=float)
    if x.ndim == 1:
        x = np.stack([x, x])
    fade = s(0.004)
    x[:, -fade:] *= np.linspace(1, 0, fade)
    x /= np.max(np.abs(x)) + 1e-12
    x *= 10 ** (-1 / 20)
    mono = np.abs(x).max(axis=0)
    win = s(0.01)
    env = np.convolve(mono, np.ones(win) / win, mode="same")
    if kind == "transient":
        align = int(np.argmax(env > 0.5 * env.max()))
    else:
        align = int(np.argmax(env))
    path = os.path.join(OUT, family, f"{name}_{i}.wav")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x.T * 32767).astype(np.int16).tobytes())
    return {"file": f"sfx/{family}/{name}_{i}.wav", "family": family, "sound": name, "variation": i,
            "duration": round(x.shape[1] / SR, 3), "align": round(align / SR, 3)}


# ---------------- WHOOSHES (movement) ----------------
def hollow(rng, length, peak):
    n = s(length)
    x = sweep_band(rng.standard_normal(n), [380, 900, 1700, 700], 2.0)
    x = comb(x, rng.uniform(0.0028, 0.0045), 0.55)  # the hollow, tube-like colour
    return stereo(x * env_peak(n, peak), 1.0)


def deep_voice(rng, length, peak):
    n = s(length)
    t = tt(n)
    noise = sweep_band(rng.standard_normal(n), [160, 420, 900, 380], 2.4)
    f = 70 + 90 * env_peak(n, peak, 1.5, 1.5)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR)
    flange = comb(noise, 0.002 + 0.0015 * np.sin(2 * np.pi * 0.7 * t).mean(), 0.45)
    return stereo((flange * 0.8 + filt(tone, "lowpass", 600) * 0.35) * env_peak(n, peak), 1.5)


def organic_wind(rng, length, peak):
    n = s(length)
    x = filt(rng.standard_normal(n), "lowpass", 1400)
    x = sweep_band(x, [200, 380, 520, 300], 3.0)
    wobble = 1 + 0.25 * np.sin(2 * np.pi * rng.uniform(1.5, 3.0) * tt(n))
    return stereo(x * wobble * env_peak(n, peak, 1.4, 1.4), 2.0)


def synthetic_transition(rng, length, peak):
    n = s(length)
    t = tt(n)
    noise = sweep_band(rng.standard_normal(n), [500, 1500, 3500, 1200], 2.2)
    f = 300 + 1500 * env_peak(n, peak, 1.2, 2.5)
    chirp = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(2 * np.pi * 38 * t)
    return stereo((noise * 0.85 + chirp * 0.25) * env_peak(n, peak, 2.2, 1.8), 1.2)


def generic_long(rng, length, peak):
    n = s(length)
    x = sweep_band(rng.standard_normal(n), [200, 450, 900, 1800, 3200], 2.0)
    return stereo(x * env_peak(n, peak, 2.6, 3.0), 1.0)


def short(rng, length, peak):
    n = s(length)
    x = sweep_band(rng.standard_normal(n), [900, 2400, 1200], 2.0)
    return stereo(x * env_peak(n, peak, 1.6, 1.4), 0.6)


# ---------------- TEXTURES (things that happen without sliding) ----------------
def pop(rng):
    n = s(0.12)
    t = tt(n)
    f0 = rng.uniform(700, 1000)
    f = 260 + f0 * np.exp(-t / 0.012)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)
    click = filt(rng.standard_normal(n), "highpass", 3000) * np.exp(-t / 0.0015) * 0.4
    return body + click


def ui_click(rng):
    n = s(0.09)
    t = tt(n)
    x = np.zeros(n)
    for off, g in ((0.0, 1.0), (rng.uniform(0.012, 0.02), 0.55)):
        i = s(off)
        m = s(0.004)
        x[i:i + m] += filt(rng.standard_normal(m), "highpass", 2500) * g
    tone = np.sin(2 * np.pi * rng.uniform(2200, 2800) * t) * np.exp(-t / 0.018) * 0.35
    return x + tone


def scifi_click(rng):
    n = s(0.14)
    t = tt(n)
    fc, fm = rng.uniform(1000, 1500), rng.uniform(220, 380)
    x = np.sin(2 * np.pi * fc * t + 3 * np.exp(-t / 0.03) * np.sin(2 * np.pi * fm * t)) * np.exp(-t / 0.035)
    return x + filt(rng.standard_normal(n), "highpass", 4000) * np.exp(-t / 0.002) * 0.3


def gears(rng):
    """A tiny gearwheel: a quick run of metallic ticks."""
    n = s(0.32)
    x = np.zeros(n)
    ticks = rng.integers(8, 13)
    times = np.sort(rng.uniform(0, 0.26, ticks))
    for k, at in enumerate(times):
        i = s(at)
        m = s(0.012)
        tick = filt(rng.standard_normal(m), "bandpass", [2800, 5200]) * np.exp(-tt(m) / 0.0025)
        x[i:i + m] += tick[: len(x[i:i + m])] * (0.6 + 0.4 * (k == 0))
    ring = np.sin(2 * np.pi * 4100 * tt(n)) * np.exp(-tt(n) / 0.05) * 0.08
    return x + ring


def digital_camera_click(rng):
    n = s(0.16)
    x = np.zeros(n)
    gap = rng.uniform(0.032, 0.045)
    for off, f, g in ((0.0, 3200, 1.0), (gap, 1800, 0.65)):
        i = s(off)
        m = s(0.01)
        x[i:i + m] += filt(rng.standard_normal(m), "highpass", f) * np.exp(-tt(m) / 0.0025) * g
    whirr = filt(rng.standard_normal(n), "bandpass", [1200, 2200]) * np.exp(-tt(n) / 0.03) * 0.15
    return x + whirr


def scifi_impact(rng):
    n = s(1.3)
    t = tt(n)
    boom = np.sin(2 * np.pi * np.cumsum(45 + 70 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.35)
    partials = [rng.uniform(480, 560), rng.uniform(1250, 1380), rng.uniform(2350, 2600), rng.uniform(3700, 4100)]
    ring = sum(np.sin(2 * np.pi * p * t) * np.exp(-t / (0.25 + 0.1 * k)) / (k + 1) for k, p in enumerate(partials))
    burst = filt(rng.standard_normal(n), "highpass", 2000) * np.exp(-t / 0.02) * 0.4
    return stereo(boom * 0.9 + ring * 0.35 + burst, 1.0)


def activate_energy(rng):
    """Rising shimmer into a bright chime: the entry into a new animation (aligns on the chime)."""
    rise, n = 0.45, s(1.1)
    t = tt(n)
    x = np.zeros(n)
    m = s(rise)
    f = np.linspace(400, rng.uniform(1600, 2000), m)
    sh = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(2 * np.pi * 23 * tt(m)) * np.linspace(0, 1, m) ** 2 * 0.4
    x[:m] += sh
    tc = tt(n - m)
    base = rng.uniform(880, 990)
    chime = sum(np.sin(2 * np.pi * base * r * tc) * np.exp(-tc / (0.5 / r)) for r in (1, 2.01, 3.03)) * 0.6
    x[m:] += chime
    return stereo(x, 1.5)


def success_reward(rng):
    n = s(1.0)
    x = np.zeros(n)
    for at, f in ((0.0, 1318.5), (rng.uniform(0.09, 0.12), 1975.5)):
        i = s(at)
        tc = tt(n - i)
        x[i:] += sum(np.sin(2 * np.pi * f * r * tc) * np.exp(-tc / (0.45 / r)) for r in (1, 2.0, 2.98)) * 0.5
    return stereo(x, 1.0)


# ---------------- RISERS & HITS (anticipation) ----------------
def sharp_bass(rng, length):
    n = s(length)
    t = tt(n)
    p = (t / length) ** 2
    f = 38 + 90 * p
    bass = sum(np.sin(2 * np.pi * k * np.cumsum(f) / SR) / k for k in range(1, 8))
    bass = filt(bass, "lowpass", 900)
    air = sweep_band(rng.standard_normal(n), [800, 2000, 5000, 9000], 1.8) * p ** 1.5
    x = (bass * 0.8 + air * 0.5) * (0.05 + 0.95 * p ** 1.8)
    return stereo(x, 1.0)


def metallic(rng, length):
    n = s(length)
    t = tt(n)
    p = t / length
    ratios = [1.0, 1.47, 2.09, 2.56, 3.41]
    base = rng.uniform(180, 240)
    f = base * (1 + 1.8 * p ** 2)
    x = sum(np.sin(2 * np.pi * r * np.cumsum(f) / SR) / (k + 1) for k, r in enumerate(ratios))
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * (4 + 18 * p ** 2) * t)
    hiss = sweep_band(rng.standard_normal(n), [1500, 4000, 8000], 1.6) * 0.3
    return stereo((x * trem + hiss) * p ** 2.4, 1.0)


def suck_back(rng, length):
    """A reversed, reverberant hit: a slow build that sucks into the cut."""
    n = s(length)
    t = tt(n)
    tail = filt(rng.standard_normal(n), "lowpass", 5000) * np.exp(-t / (length * 0.35))
    tone = np.sin(2 * np.pi * rng.uniform(90, 120) * t) * np.exp(-t / (length * 0.3)) * 0.5
    return stereo((tail + tone)[::-1], 2.0)


def impact(rng):
    n = s(1.6)
    t = tt(n)
    boom = np.sin(2 * np.pi * np.cumsum(36 + 80 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.45)
    crack = filt(rng.standard_normal(n), "highpass", 1500) * np.exp(-t / 0.012) * 0.6
    tail = filt(rng.standard_normal(n), "bandpass", [200, 2500]) * np.exp(-t / 0.5) * 0.12
    return stereo(np.tanh((boom + crack + tail) * 1.3), 1.0)


def main():
    rng = np.random.default_rng(2026)
    man = []
    # Whooshes: (length, peak position) per variation, so each folder has short/medium/longer takes.
    W = {
        "hollow": (hollow, [(0.55, 0.55), (0.75, 0.6), (0.95, 0.62)]),
        "deep_voice": (deep_voice, [(0.6, 0.55), (0.85, 0.6), (1.1, 0.62)]),
        "organic_wind": (organic_wind, [(1.2, 0.55), (1.6, 0.58), (2.0, 0.6)]),
        "synthetic_transition": (synthetic_transition, [(0.7, 0.6), (0.9, 0.62), (1.2, 0.65)]),
        "generic_long": (generic_long, [(1.8, 0.82), (2.4, 0.85), (3.0, 0.88)]),
        "short": (short, [(0.22, 0.5), (0.3, 0.5), (0.4, 0.55)]),
    }
    for name, (fn, specs) in W.items():
        for i, (length, peak) in enumerate(specs, 1):
            man.append(write("whooshes", name, i, fn(rng, length, peak), "peak"))
    for name, fn in {"pop": pop, "ui_click": ui_click, "scifi_click": scifi_click, "gears": gears,
                     "digital_camera_click": digital_camera_click, "scifi_impact": scifi_impact,
                     "activate_energy": activate_energy, "success_reward": success_reward}.items():
        for i in range(1, 4):
            kind = "peak" if name == "activate_energy" else "transient"
            man.append(write("textures", name, i, fn(rng), kind))
    for name, fn, lengths in (("sharp_bass", sharp_bass, [1.5, 2.0, 2.6]), ("metallic", metallic, [1.5, 2.0, 2.6]),
                              ("suck_back", suck_back, [1.0, 1.4, 1.8])):
        for i, length in enumerate(lengths, 1):
            man.append(write("risers", name, i, fn(rng, length), "peak"))
    for i in range(1, 4):
        man.append(write("hits", "impact", i, impact(rng), "transient"))
    # The manifest lives with the code (the cue sheet imports it); the seed makes the sounds the same every run.
    with open(os.path.join(ROOT, "src", "sfx-manifest.json"), "w") as fh:
        json.dump({m["file"]: m for m in man}, fh, indent=1)
        fh.write("\n")
    print(f"✓ public/sfx/: {len(man)} sounds in {len({m['family'] for m in man})} families; src/sfx-manifest.json")


if __name__ == "__main__":
    main()
