from __future__ import annotations

from typing import Any, Dict, Iterable, Sequence

import numpy as np
from scipy.optimize import least_squares


_SUPPORTED_CIRCUITS = {
    "R0": ("R0",),
    "R0-R1": ("R0", "R1"),
    "R0-p(R1,CPE1)": ("R0", "R1", "CPE1_Y", "CPE1_n"),
}


def fit_impedance(
    frequencies: Sequence[float],
    z_real: Sequence[float],
    z_imag: Sequence[float],
    circuit_formula: str,
    initial_params: Dict[str, float],
    algorithm: str = "LM",
) -> Dict[str, Any]:
    try:
        omega, z_data = _validate_input(frequencies, z_real, z_imag)
        formula = circuit_formula.replace(" ", "")
        if formula not in _SUPPORTED_CIRCUITS:
            return _error_response(f"Unsupported circuit formula: {circuit_formula}")

        names = _SUPPORTED_CIRCUITS[formula]
        missing = [name for name in names if name not in initial_params]
        if missing:
            return _error_response(f"Missing initial parameters: {', '.join(missing)}")

        x0 = np.array([float(initial_params[name]) for name in names], dtype=float)
        method = _resolve_method(algorithm)

        def residuals(params: np.ndarray) -> np.ndarray:
            if not _is_valid_param_set(names, params):
                return np.full(2 * omega.size, 1e6)
            z_fit = _evaluate_circuit(formula, omega, params)
            diff = z_fit - z_data
            return np.concatenate((diff.real, diff.imag))

        kwargs: Dict[str, Any] = {"method": method, "max_nfev": 5000}
        if method in {"trf", "dogbox"}:
            kwargs["bounds"] = _bounds_for(names)

        optimization = least_squares(residuals, x0, **kwargs)
        if not optimization.success:
            return _error_response(f"Optimization failed: {optimization.message}")

        fitted = optimization.x
        z_fit = _evaluate_circuit(formula, omega, fitted)
        metrics = _compute_metrics(z_data, z_fit)
        parameters = _format_parameters(names, fitted, optimization.jac, optimization.fun)

        return {
            "status": "success",
            "parameters": parameters,
            "fitted_curve": {
                "z_real_fit": z_fit.real.tolist(),
                "z_imag_fit": z_fit.imag.tolist(),
            },
            "metrics": metrics,
            "error_message": None,
        }
    except Exception as exc:  # pragma: no cover - safety guard for route usage
        return _error_response(str(exc))


def _validate_input(
    frequencies: Sequence[float], z_real: Sequence[float], z_imag: Sequence[float]
) -> tuple[np.ndarray, np.ndarray]:
    if not (len(frequencies) == len(z_real) == len(z_imag)):
        raise ValueError("frequencies, z_real, and z_imag must have the same length")
    if len(frequencies) < 2:
        raise ValueError("At least two data points are required for fitting")

    freq = np.asarray(frequencies, dtype=float)
    zr = np.asarray(z_real, dtype=float)
    zi = np.asarray(z_imag, dtype=float)
    if not np.all(np.isfinite(freq)) or not np.all(np.isfinite(zr)) or not np.all(np.isfinite(zi)):
        raise ValueError("Input arrays must contain finite values")
    if np.any(freq <= 0):
        raise ValueError("frequencies must be strictly positive")

    return 2.0 * np.pi * freq, zr + 1j * zi


def _resolve_method(algorithm: str) -> str:
    key = algorithm.upper()
    return {"LM": "lm", "TRF": "trf", "DOGBOX": "dogbox"}.get(key, "lm")


def _evaluate_circuit(formula: str, omega: np.ndarray, params: np.ndarray) -> np.ndarray:
    if formula == "R0":
        return np.full_like(omega, params[0], dtype=np.complex128)
    if formula == "R0-R1":
        return np.full_like(omega, params[0] + params[1], dtype=np.complex128)

    r0, r1, cpe_y, cpe_n = params
    z_cpe = 1.0 / (cpe_y * (1j * omega) ** cpe_n)
    z_parallel = 1.0 / (1.0 / r1 + 1.0 / z_cpe)
    return r0 + z_parallel


def _is_valid_param_set(names: Iterable[str], params: np.ndarray) -> bool:
    for name, value in zip(names, params):
        if not np.isfinite(value):
            return False
        if name.endswith("_n"):
            if value <= 0.0 or value > 1.0:
                return False
        elif value <= 0.0:
            return False
    return True


def _bounds_for(names: Sequence[str]) -> tuple[np.ndarray, np.ndarray]:
    lower = np.full(len(names), 1e-12, dtype=float)
    upper = np.full(len(names), np.inf, dtype=float)
    for idx, name in enumerate(names):
        if name.endswith("_n"):
            lower[idx] = 1e-6
            upper[idx] = 1.0
    return lower, upper


def _compute_metrics(z_data: np.ndarray, z_fit: np.ndarray) -> Dict[str, float | None]:
    residual = z_data - z_fit
    y_true = np.concatenate((z_data.real, z_data.imag))
    y_pred = np.concatenate((z_fit.real, z_fit.imag))
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    r_squared = None if ss_tot == 0 else 1.0 - (ss_res / ss_tot)
    return {
        "chi_square": float(np.mean(np.abs(residual) ** 2)),
        "r_squared": r_squared,
    }


def _format_parameters(
    names: Sequence[str], fitted: np.ndarray, jacobian: np.ndarray, residual: np.ndarray
) -> list[Dict[str, float | None]]:
    error_pct: list[float | None] = [None] * len(names)
    dof = max(1, residual.size - fitted.size)
    try:
        jt_j_inv = np.linalg.pinv(jacobian.T @ jacobian)
        mse = float(np.dot(residual, residual) / dof)
        std_err = np.sqrt(np.maximum(np.diag(jt_j_inv) * mse, 0.0))
        for idx, value in enumerate(fitted):
            if value != 0:
                error_pct[idx] = float(abs(std_err[idx] / value) * 100.0)
    except Exception:
        pass

    return [
        {"name": name, "value": float(value), "error_pct": error_pct[idx]}
        for idx, (name, value) in enumerate(zip(names, fitted))
    ]


def _error_response(message: str) -> Dict[str, Any]:
    return {
        "status": "error",
        "parameters": [],
        "fitted_curve": {"z_real_fit": [], "z_imag_fit": []},
        "metrics": {"chi_square": float("nan"), "r_squared": None},
        "error_message": message,
    }
