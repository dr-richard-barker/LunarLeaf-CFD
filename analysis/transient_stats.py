"""Stationarity and error-bar analysis for LunarLeaf time series.

export_cfd.ts reports every scenario as a single end-state value at 30 000 steps
(about 5.2 s). This module checks whether that is safe. For a quantity y(t) it:

  * discards a start-up window and averages the rest,
  * attaches a standard error that accounts for serial correlation,
        N_eff = N * dt / (2 * T_int),  SE = sd / sqrt(N_eff),
    where T_int is the autocorrelation integrated to its first zero crossing,
  * tests for drift: the two halves of the averaging window must agree within
    their combined error, and the linear trend across it must be small.

The method follows the microgreen-chamber-cfd project, validation/compare_transients.py
and plot_fluctuation_decay.py (microgreen-chamber-cfd @ 6ac89c1).
That repo has no licence, so this is a re-implementation, not a copy.

    python3 analysis/transient_stats.py            # all results/timeseries/*.csv
"""
from __future__ import annotations

import argparse
import csv
import glob
import os
from dataclasses import dataclass

import numpy as np

SNAPSHOT_STEP = 30000  # what export_cfd.ts reports today


def integral_time(y: np.ndarray, dt: float) -> float:
    """Integral time scale: the normalised autocorrelation integrated to its first zero."""
    y = np.asarray(y, float) - np.mean(y)
    n = len(y)
    if n < 4 or np.allclose(y, 0):
        return dt / 2  # white or constant: N_eff = N
    nfft = 1 << (2 * n - 1).bit_length()
    f = np.fft.rfft(y, nfft)
    ac = np.fft.irfft(f * np.conj(f), nfft)[:n].real
    ac /= ac[0]
    zero = int(np.argmax(ac < 0)) if (ac < 0).any() else n
    return max(float(np.trapezoid(ac[:zero], dx=dt)), dt / 2)


@dataclass
class WindowStats:
    mean: float
    sd: float
    se: float
    n: int
    n_eff: float
    t_int: float
    half_diff: float  # mean(second half) - mean(first half)
    half_z: float  # half_diff / combined SE of the two halves
    trend_frac: float  # linear-fit change across the window / |mean|
    stationary: bool


def window_stats(y: np.ndarray, dt: float, z_max: float = 2.0, trend_max: float = 0.01) -> WindowStats:
    """Mean, N_eff-corrected SE and drift diagnostics for an already-trimmed series."""
    y = np.asarray(y, float)
    n = len(y)
    t_int = integral_time(y, dt)
    n_eff = max(n * dt / (2 * t_int), 1.0)
    sd = float(np.std(y, ddof=1))
    se = sd / np.sqrt(n_eff)

    a, b = y[: n // 2], y[n // 2 :]

    def _se(h: np.ndarray) -> float:
        ne = max(len(h) * dt / (2 * integral_time(h, dt)), 1.0)
        return float(np.std(h, ddof=1)) / np.sqrt(ne)

    half_diff = float(b.mean() - a.mean())
    se_h = np.hypot(_se(a), _se(b))
    # A noiseless monotone drift has se_h ~ 0: treat any visible change as drift.
    half_z = half_diff / se_h if se_h > 1e-12 * max(abs(y.mean()), 1e-30) else (np.inf if half_diff else 0.0)

    t = np.arange(n) * dt
    slope = np.polyfit(t, y, 1)[0]
    trend_frac = float(slope * (t[-1] - t[0]) / abs(y.mean())) if y.mean() else 0.0

    # Drift must be both statistically and practically significant (> trend_max of the mean).
    tol = trend_max * abs(y.mean())
    trend_abs = abs(slope * (t[-1] - t[0]))
    halves_drift = abs(half_z) > z_max and abs(half_diff) > tol
    trend_drift = trend_abs > tol and trend_abs > z_max * se
    stationary = not (halves_drift or trend_drift)
    return WindowStats(float(y.mean()), sd, se, n, n_eff, t_int, half_diff, float(half_z), trend_frac, stationary)


def psd(t: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """One-sided PSD of y(t): resample onto a uniform grid, Hann window, rFFT."""
    t = np.asarray(t, float)
    dt = float(np.median(np.diff(t)))
    tu = np.arange(t[0], t[-1], dt)
    yu = np.interp(tu, t, y) - np.mean(y)
    w = np.hanning(len(yu))
    spec = np.fft.rfft(yu * w)
    p = 2 * np.abs(spec) ** 2 / (np.sum(w**2) / dt)
    return np.fft.rfftfreq(len(yu), dt), p


def sliding_rms(t: np.ndarray, y: np.ndarray, window: float) -> tuple[np.ndarray, np.ndarray]:
    """RMS fluctuation about the local mean in a sliding window: does it persist or decay?"""
    t, y = np.asarray(t, float), np.asarray(y, float)
    dt = float(np.median(np.diff(t)))
    m = max(int(round(window / dt)), 2)
    if m > len(y):
        return np.array([]), np.array([])
    centres, rms = [], []
    for i in range(0, len(y) - m + 1, max(m // 4, 1)):
        seg = y[i : i + m]
        centres.append(t[i + m // 2])
        rms.append(np.std(seg))
    return np.array(centres), np.array(rms)


def load(path: str) -> dict[str, np.ndarray]:
    with open(path) as fh:
        rows = list(csv.DictReader(fh))
    return {k: np.array([float(r[k]) if r[k] not in ("", "NaN") else np.nan for r in rows]) for k in rows[0]}


def analyse(path: str, keep_frac: float = 0.5) -> list[dict]:
    d = load(path)
    sid = os.path.basename(path)[:-4]
    step, t = d["step"], d["t_s"]
    dt = float(np.median(np.diff(t)))
    out = []
    for q in ("g_bl_mol_m2_s", "delta_mm", "dC_CO2_mean", "u_max"):
        y = d[q]
        if np.all(np.isnan(y)):
            continue
        snap_i = int(np.argmin(np.abs(step - SNAPSHOT_STEP)))
        start = int(len(y) * (1 - keep_frac))
        win = y[start:]
        win = win[~np.isnan(win)]
        if len(win) < 8:
            continue
        ws = window_stats(win, dt)
        out.append(
            dict(
                scenario=sid,
                quantity=q,
                snapshot_30k=y[snap_i],
                window_t_s=f"{t[start]:.1f}-{t[-1]:.1f}",
                window_mean=ws.mean,
                window_se=ws.se,
                n_eff=round(ws.n_eff, 1),
                t_int_s=round(ws.t_int, 3),
                snapshot_bias_pct=100 * (y[snap_i] - ws.mean) / ws.mean if ws.mean else np.nan,
                half_z=ws.half_z,
                trend_pct=100 * ws.trend_frac,
                stationary=ws.stationary,
            )
        )
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dir", default="results/timeseries")
    ap.add_argument("--keep", type=float, default=0.5, help="fraction of the record kept for averaging")
    ap.add_argument("--out", default="results/tables/T15_stationarity.csv")
    a = ap.parse_args()

    rows = []
    for p in sorted(glob.glob(os.path.join(a.dir, "*.csv"))):
        rows += analyse(p, a.keep)
    if not rows:
        raise SystemExit(f"no time series in {a.dir}")
    with open(a.out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        for r in rows:
            w.writerow({k: (f"{v:.4g}" if isinstance(v, float) else v) for k, v in r.items()})
    for r in rows:
        if r["quantity"] == "g_bl_mol_m2_s":
            flag = "stationary" if r["stationary"] else "DRIFTING"
            print(
                f"{r['scenario']:16s} g_bl snapshot {r['snapshot_30k']:.3f}  window {r['window_mean']:.3f} "
                f"± {r['window_se']:.3f}  bias {r['snapshot_bias_pct']:+.1f}%  trend {r['trend_pct']:+.2f}%  {flag}"
            )
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
