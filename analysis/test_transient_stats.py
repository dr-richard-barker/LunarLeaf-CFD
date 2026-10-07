"""Regression tests for transient_stats.  python3 -m pytest analysis/"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from transient_stats import integral_time, psd, sliding_rms, window_stats  # noqa: E402


def ar1(n, phi, rng):
    e = rng.standard_normal(n)
    y = np.empty(n)
    y[0] = e[0] / np.sqrt(1 - phi**2)
    for i in range(1, n):
        y[i] = phi * y[i - 1] + e[i]
    return y


def test_white_noise_neff_is_n():
    y = np.random.default_rng(0).standard_normal(20000)
    ws = window_stats(y, dt=1.0)
    assert 0.8 * len(y) < ws.n_eff <= 1.05 * len(y)
    assert ws.stationary


def test_ar1_neff_matches_theory():
    phi, n = 0.9, 40000
    ws = window_stats(ar1(n, phi, np.random.default_rng(1)), dt=1.0)
    expected = n * (1 - phi) / (1 + phi)  # textbook AR(1) effective sample size
    assert abs(ws.n_eff - expected) / expected < 0.25


def test_ar1_se_covers_spread_of_means():
    """The N_eff SE must predict the scatter of independent realisations' means."""
    phi, n, reps = 0.95, 8000, 200
    rng = np.random.default_rng(2)
    means, ses = [], []
    for _ in range(reps):
        ws = window_stats(ar1(n, phi, rng), dt=1.0)
        means.append(ws.mean)
        ses.append(ws.se)
    ratio = np.mean(ses) / np.std(means)
    assert 0.75 < ratio < 1.3, ratio


def test_naive_se_underestimates():
    phi, n = 0.95, 8000
    y = ar1(n, phi, np.random.default_rng(3))
    ws = window_stats(y, dt=1.0)
    assert ws.se > 3 * np.std(y, ddof=1) / np.sqrt(n)


def test_monotone_drift_is_flagged():
    t = np.linspace(0, 10, 400)
    y = 0.5 + 0.2 * (1 - np.exp(-t / 20))  # still relaxing, noiseless
    assert not window_stats(y, dt=t[1] - t[0]).stationary


def test_converged_plateau_is_stationary():
    t = np.linspace(0, 10, 400)
    y = np.full_like(t, 0.494) + 1e-6 * np.random.default_rng(4).standard_normal(len(t))
    assert window_stats(y, dt=t[1] - t[0]).stationary


def test_psd_peak_at_signal_frequency():
    t = np.arange(0, 100, 0.01)
    f, p = psd(t, np.sin(2 * np.pi * 0.37 * t))
    assert abs(f[np.argmax(p)] - 0.37) < 0.02


def test_integral_time_constant_signal():
    assert integral_time(np.ones(100), 0.1) == 0.05


def test_sliding_rms_decay():
    t = np.linspace(0, 100, 5000)
    y = np.exp(-t / 20) * np.sin(2 * np.pi * t)
    _, r = sliding_rms(t, y, window=5)
    assert r[0] > 10 * r[-1]


def test_gci_recovers_known_order():
    from gci import gci

    h = np.array([1 / 2, 1 / 1.5, 1.0])  # fine, medium, coarse
    phi = 0.8 + 0.05 * h**2
    res = gci(tuple(phi), 2 / 1.5, 1.5)
    assert abs(res["p"] - 2) < 1e-6
    assert abs(res["phi_ext"] - 0.8) < 1e-9
    assert res["monotone"]


def test_gci_flags_oscillation():
    from gci import gci

    res = gci((1.0, 1.1, 0.95), 2 / 1.5, 1.5)
    assert not res["monotone"] and np.isnan(res["gci_fine_pct"])
