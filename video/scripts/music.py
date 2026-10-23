#!/usr/bin/env python3
"""Compose and render the music bed for Ad A v2: 16 s, 120 BPM, A minor, drop at 4.0 s.

Everything is synthesised here (no samples, no licence): drums, bass, supersaw
pad, pluck arpeggio, riser, impacts, whooshes and shutter clicks, all placed on
the same clock as the picture (src/v2/timeline.json). Mastered with ffmpeg to
-14 LUFS / -1 dBTP, the usual target for Instagram.

    python3 scripts/music.py            → public/music/ad-a-v2.wav
Needs numpy, scipy and ffmpeg.
"""
import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
T = json.load(open(os.path.join(ROOT, "src", "v2", "timeline.json")))
OUT = os.path.join(ROOT, "public", "music", "ad-a-v2.wav")

SR = 44100
BEAT = 60 / T["bpm"]
DUR = T["seconds"]
N = int(DUR * SR)
DROP = T["drop"]
FLASH = T["hook"]["flash"]
END = T["end"]["from"]
rng = np.random.default_rng(7)

# One stereo bus per instrument (dry + reverb send), balanced against each other at the end.
BUSES = {}


def bus(name):
    if name not in BUSES:
        BUSES[name] = {"dry": np.zeros((2, N)), "send": np.zeros((2, N))}
    return BUSES[name]


# ---------- helpers ----------
def s(t):
    return int(round(t * SR))


def tt(n):
    return np.arange(n) / SR


def filt(x, kind, f, order=2):
    if isinstance(f, (list, tuple)):
        f = [min(max(v, 20), SR / 2 - 100) for v in f]
    else:
        f = min(max(f, 20), SR / 2 - 100)
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def place(sig, at, gain=1.0, pan=0.0, send=0.0, to="fx"):
    """Mix a mono signal into bus `to` at time `at` (s). pan -1..1, send = reverb amount."""
    i = s(at)
    if i >= N:
        return
    sig = sig[: N - max(i, 0)] if i >= 0 else sig[-i:]
    i = max(i, 0)
    gl, gr = gain * np.sqrt((1 - pan) / 2) * 1.414, gain * np.sqrt((1 + pan) / 2) * 1.414
    b = bus(to)
    b["dry"][0, i : i + len(sig)] += sig * gl
    b["dry"][1, i : i + len(sig)] += sig * gr
    if send:
        b["send"][0, i : i + len(sig)] += sig * gl * send
        b["send"][1, i : i + len(sig)] += sig * gr * send


def saw(freq, n, phase=0.0):
    """Band-limited sawtooth (additive), so high notes don't alias."""
    t = tt(n)
    k = np.arange(1, max(2, int((SR / 2 - 500) // freq)) + 1)
    k = k[: 48]
    return (2 / np.pi) * np.sum(np.sin(2 * np.pi * np.outer(k, t) * freq + phase * k[:, None]) / k[:, None], axis=0)


def adsr(n, a=0.005, d=0.1, sus=0.7, r=0.1):
    e = np.ones(n) * sus
    na, nd, nr = s(a), s(d), s(r)
    e[:na] = np.linspace(0, 1, na) if na else e[:na]
    e[na : na + nd] = np.linspace(1, sus, len(e[na : na + nd]))
    if nr and n > nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def hz(note):
    """'A3' → Hz."""
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    name, octave = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[name] + 12 * (octave - 4)) / 12)


# Bars are 2 s (4 beats). A minor: Am F | Am F | C G | Am → (end) Fmaj9.
CHORDS = {
    "Am": ["A3", "C4", "E4", "A4"],
    "F": ["F3", "A3", "C4", "F4"],
    "C": ["C4", "E4", "G4", "C5"],
    "G": ["G3", "B3", "D4", "G4"],
    "Fmaj9": ["F3", "A3", "C4", "E4", "G4"],
}
ROOTS = {"Am": "A1", "F": "F1", "C": "C2", "G": "G1", "Fmaj9": "F1"}
BARS = ["Am", "F", "Am", "F", "C", "G", "Am", "Fmaj9"]


def chord_at(t):
    return BARS[min(int(t // (4 * BEAT)), len(BARS) - 1)]


# ---------- sidechain: everything melodic ducks under the kick after the drop ----------
duck = np.ones(N)
kick_times = [DROP + i * BEAT for i in range(int((END - DROP) / BEAT))]
for kt in kick_times:
    i = s(kt)
    n = s(0.32)
    seg = 1 - 0.65 * np.exp(-tt(n) / 0.09)
    duck[i : i + n] = np.minimum(duck[i : i + n], seg[: len(duck[i : i + n])])

# ---------- drums ----------
def kick():
    n = s(0.45)
    t = tt(n)
    f = 46 + 110 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17)
    click = filt(rng.standard_normal(n), "highpass", 2500) * np.exp(-t / 0.004) * 0.35
    return np.tanh((body + click) * 1.6)


def clap():
    n = s(0.35)
    t = tt(n)
    noise = filt(rng.standard_normal(n), "bandpass", [900, 3500])
    env = np.zeros(n)
    for off in (0, 0.011, 0.022):
        i = s(off)
        env[i:] += np.exp(-tt(n - i) / (0.012 if off < 0.02 else 0.11))
    return noise * env * 0.7


def hat(open_=False):
    n = s(0.25 if open_ else 0.06)
    t = tt(n)
    return filt(rng.standard_normal(n), "highpass", 7000) * np.exp(-t / (0.07 if open_ else 0.014))


for kt in kick_times:
    place(kick(), kt, 1.0, to="kick")
for i, kt in enumerate(kick_times):
    if i % 2 == 1:
        place(clap(), kt, 1.0, pan=0.05, send=0.25, to="clap")

# Hats: offbeat 8ths through the whole track (quiet and dark in the intro), 16th ghosts after the drop.
for i in range(int(END / (BEAT / 2))):
    t0 = i * BEAT / 2
    if FLASH <= t0 < DROP:
        continue
    if i % 2 == 1:
        g = 1.0 if t0 >= DROP else 0.7
        place(hat(open_=(t0 >= 8 and t0 < 12 and i % 4 == 3)), t0, g, pan=0.25, to="hats")
    elif t0 >= DROP:
        place(hat(), t0 + BEAT / 4, 0.35, pan=-0.2, to="hats")

# ---------- bass: offbeat 8ths after the drop ----------
for kt in kick_times:
    t0 = kt + BEAT / 2
    root = hz(ROOTS[chord_at(t0)])
    n = s(BEAT / 2 * 0.9)
    tone = filt(saw(root * 2, n), "lowpass", 700) * 0.8 + np.sin(2 * np.pi * root * 2 * tt(n)) * 0.45
    place(tone * adsr(n, 0.004, 0.08, 0.6, 0.05), t0, 1.0, to="bass")

# ---------- pad / supersaw: one chord per bar, pumping after the drop ----------
pad_l = np.zeros(N)
pad_r = np.zeros(N)
for b, name in enumerate(BARS):
    t0 = b * 4 * BEAT
    if t0 >= DUR:
        break
    length = (DUR - t0) if name == "Fmaj9" else 4 * BEAT + 0.15
    if name == "Fmaj9":
        t0 = END
        length = DUR - END
    n = min(s(length), N - s(t0))
    acc_l = np.zeros(n)
    acc_r = np.zeros(n)
    for note in CHORDS[name]:
        f0 = hz(note)
        for v, det in enumerate((-0.11, -0.06, -0.02, 0.0, 0.02, 0.06, 0.11)):
            x = saw(f0 * 2 ** (det / 12), n, phase=rng.uniform(0, 2 * np.pi))
            if v % 2:
                acc_l += x
            else:
                acc_r += x
    env = adsr(n, 0.04 if t0 >= DROP else 0.6, 0.3, 0.85, 0.25)
    i = s(t0)
    pad_l[i : i + n] += acc_l * env
    pad_r[i : i + n] += acc_r * env

# Intro: dark and opening up towards the flash; after the drop: bright and pumping; end: closing down.
dark_l, dark_r = filt(pad_l, "lowpass", 700), filt(pad_r, "lowpass", 700)
bright_l, bright_r = filt(pad_l, "lowpass", 3800), filt(pad_r, "lowpass", 3800)
t_all = tt(N)
open_ = np.clip((t_all - 0.0) / FLASH, 0, 1) ** 2
open_[t_all >= DROP] = 1.0
close = np.clip((t_all - END) / (DUR - END), 0, 1)
open_[t_all >= END] = 1 - 0.85 * close[t_all >= END]
# Intro level relative to the drop (1.0 = same as after the drop).
lift = np.where(t_all < DROP, 1.0, 1.0)
padmix = np.stack([dark_l * (1 - open_) + bright_l * open_, dark_r * (1 - open_) + bright_r * open_]) * duck * lift
bus("pad")["dry"] += padmix
bus("pad")["send"] += padmix * 0.35

# ---------- pluck arpeggio: 16ths, with a dotted-8th echo ----------
ARP = [0, 2, 1, 3, 2, 1, 3, 2]
arp_l = np.zeros(N)
arp_r = np.zeros(N)
for i in range(int(END / (BEAT / 4))):
    t0 = i * BEAT / 4
    if FLASH <= t0 < DROP:
        continue
    notes = CHORDS[chord_at(t0)]
    f0 = hz(notes[ARP[i % len(ARP)] % len(notes)]) * 2
    n = s(0.28)
    x = saw(f0, n) * 0.6 + np.sign(np.sin(2 * np.pi * f0 * tt(n))) * 0.15
    x = filt(x, "lowpass", 2400 if t0 >= DROP else 1200) * np.exp(-tt(n) / 0.07)
    g = 1.0 if t0 >= DROP else 0.7
    j = s(t0)
    m = min(n, N - j)
    arp_l[j : j + m] += x[:m] * g
    arp_r[j : j + m] += x[:m] * g
# ping-pong delay
d = s(BEAT * 0.75)
for k in range(1, 4):
    fb = 0.32 ** k
    src_ = arp_l if k % 2 else arp_r
    tgt = arp_r if k % 2 else arp_l
    tgt[d * k :] += src_[: N - d * k] * fb * 0.6
arp = np.stack([arp_l, arp_r]) * duck
bus("arp")["dry"] += arp
bus("arp")["send"] += arp * 0.3

# ---------- the "blank": riser, suck, silence with a faint ring, then the drop ----------
gate = np.ones(N)
gi, gd = s(FLASH), s(DROP)
gate[gi:gd] = 0.0
fade = s(0.02)
gate[gi - fade : gi] = np.linspace(1, 0, fade)
for b in BUSES.values():
    b["dry"] *= gate
    b["send"] *= gate

# riser 2.0 → 3.5: noise opening up + a rising tone
rs, re_ = 2.0, FLASH
n = s(re_ - rs)
noise = rng.standard_normal(n)
parts = [filt(noise, "bandpass", [lo, lo * 2.2]) for lo in (300, 900, 2500, 6000)]
pos = np.linspace(0, len(parts) - 1, n)
riser = np.zeros(n)
for k, p in enumerate(parts):
    w = np.clip(1 - np.abs(pos - k), 0, 1)
    riser += p * w
riser *= np.linspace(0, 1, n) ** 2
tone = np.sin(2 * np.pi * np.cumsum(np.linspace(220, 880, n)) / SR) * np.linspace(0, 1, n) ** 3 * 0.25
place(riser * 0.3 + tone * 0.35, rs, 1.0, send=0.4)

# faint ring in the silence (the mind going blank)
n = s(DROP - FLASH - 0.03)
ring = np.sin(2 * np.pi * 2350 * tt(n)) * np.exp(-tt(n) / 0.35) * 0.05
place(ring, FLASH + 0.01, 1.0, send=0.6)

# impact on the drop and at the end card
def impact(size=1.0):
    n = s(1.8)
    t = tt(n)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / (0.5 * size))
    crash = filt(rng.standard_normal(n), "highpass", 3000) * np.exp(-t / (0.6 * size)) * 0.25
    return boom * 0.9 + crash


place(impact(1.0), DROP, 0.8, send=0.4)
place(impact(0.8), END, 0.6, send=0.5)

# ---------- SFX ----------
def whoosh(length=0.55):
    n = s(length)
    noise = rng.standard_normal(n)
    parts = [filt(noise, "bandpass", [lo, lo * 2.5]) for lo in (250, 800, 2200, 800)]
    pos = np.linspace(0, len(parts) - 1, n)
    out = np.zeros(n)
    for k, p in enumerate(parts):
        out += p * np.clip(1 - np.abs(pos - k), 0, 1)
    return out * np.sin(np.linspace(0, np.pi, n)) ** 2


def shutter():
    n = s(0.09)
    x = np.zeros(n)
    for off, f, g in ((0.0, 3500, 1.0), (0.038, 1800, 0.6)):
        i = s(off)
        m = s(0.012)
        x[i : i + m] += filt(rng.standard_normal(m), "highpass", f) * np.exp(-tt(m) / 0.003) * g
    return x


for w in T["whooshes"]:
    place(whoosh(), w - 0.2, 0.32, pan=0.0, send=0.3)
for c in T["stopMotion"]["cuts"]:
    place(shutter(), c, 0.55, pan=0.1, send=0.15)
# soft tick on the button press
n = s(0.05)
place(np.sin(2 * np.pi * 1800 * tt(n)) * np.exp(-tt(n) / 0.008), T["end"]["press"], 0.18)

# ---------- balance: each instrument to a target loudness in the drop (dB RMS, relative) ----------
TARGET = {"kick": -15, "bass": -18, "pad": -18, "arp": -21, "clap": -22, "hats": -27}
a, b_ = s(DROP), s(END)
ref = None
for name, target in TARGET.items():
    x = BUSES[name]["dry"][:, a:b_]
    rms = 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12)
    g = 10 ** ((target - rms) / 20)
    BUSES[name]["dry"] *= g
    BUSES[name]["send"] *= g
    if name == "kick":
        ref = g
# fx were placed with gains relative to a unit kick
BUSES["fx"]["dry"] *= ref * 0.8
BUSES["fx"]["send"] *= ref * 0.8

dry = sum(b["dry"] for b in BUSES.values())
send = sum(b["send"] for b in BUSES.values())
L, R = dry[0], dry[1]
SEND_L, SEND_R = send[0], send[1]

# ---------- reverb (convolution with a synthetic hall) ----------
irn = s(1.9)
ir_t = tt(irn)
ir_l = filt(rng.standard_normal(irn), "lowpass", 6500) * np.exp(-ir_t / 0.45)
ir_r = filt(rng.standard_normal(irn), "lowpass", 6500) * np.exp(-ir_t / 0.45)
ir_l /= np.sqrt(np.sum(ir_l**2))
ir_r /= np.sqrt(np.sum(ir_r**2))
L += fftconvolve(SEND_L, ir_l)[:N] * 0.5
R += fftconvolve(SEND_R, ir_r)[:N] * 0.5

# ---------- master ----------
mix = np.stack([L, R])
mix = filt(mix, "highpass", 28)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
fo = s(0.6)
mix[:, -fo:] *= np.linspace(1, 0, fo) ** 1.5
mix *= 0.89

os.makedirs(os.path.dirname(OUT), exist_ok=True)
raw = os.path.join(tempfile.mkdtemp(), "raw.wav")
with wave.open(raw, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())

# Two-pass loudnorm to -14 LUFS, -1 dBTP.
probe = subprocess.run(["ffmpeg", "-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
m = json.loads(probe[probe.rindex("{") : probe.rindex("}") + 1])
af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
      f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", af, "-ar", "48000", "-t", str(DUR), OUT], check=True)
print(f"✓ {os.path.relpath(OUT, ROOT)}  ({DUR} s, {T['bpm']} BPM, drop at {DROP} s)")
sys.exit(0)
