from __future__ import annotations

import math
from typing import Dict, Sequence


_DEF_CPE_N = 0.9
_MIN_POSITIVE = 1e-12


def estimate_initial_guess(
    frequencies: Sequence[float], z_real: Sequence[float], z_imag: Sequence[float]
) -> Dict[str, float]:
    """Estimate robust initial values from impedance features."""
    if not (len(frequencies) == len(z_real) == len(z_imag)):
        raise ValueError("frequencies, z_real, and z_imag must have the same length")
    if len(frequencies) == 0:
        raise ValueError("Input arrays cannot be empty")

    _ensure_finite("frequencies", frequencies)
    _ensure_finite("z_real", z_real)
    _ensure_finite("z_imag", z_imag)

    hf_index = max(range(len(frequencies)), key=lambda i: frequencies[i])
    rs = float(z_real[hf_index])

    real_min = min(z_real)
    real_max = max(z_real)
    rp = max(float(real_max - real_min), _MIN_POSITIVE)

    peak_index = max(range(len(z_imag)), key=lambda i: -z_imag[i])
    peak_frequency = frequencies[peak_index]
    if peak_frequency <= 0:
        positive = [f for f in frequencies if f > 0]
        peak_frequency = max(positive) if positive else 1.0
    tau = 1.0 / (2.0 * math.pi * peak_frequency)

    cpe_n = _DEF_CPE_N
    cpe_y = max((tau ** cpe_n) / rp, _MIN_POSITIVE)

    return {
        "Rs": rs,
        "Rp": rp,
        "tau": tau,
        "R0": rs,
        "R1": rp,
        "CPE1_n": cpe_n,
        "CPE1_Y": cpe_y,
    }


def _ensure_finite(name: str, values: Sequence[float]) -> None:
    if not all(math.isfinite(value) for value in values):
        raise ValueError(f"{name} must contain only finite numeric values")
