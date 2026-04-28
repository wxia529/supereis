import pytest
import numpy as np

from services.fitter import fit_impedance


def _params_to_map(parameters):
    return {item["name"]: item["value"] for item in parameters}


def test_fit_impedance_recovers_series_resistors():
    frequencies = np.logspace(0, 4, 30)
    z_real = np.full_like(frequencies, 13.0)
    z_imag = np.zeros_like(frequencies)

    result = fit_impedance(
        frequencies=frequencies,
        z_real=z_real,
        z_imag=z_imag,
        circuit_formula="R0-R1",
        initial_params={"R0": 2.0, "R1": 6.0},
        algorithm="LM",
    )

    assert result["status"] == "success"
    params = _params_to_map(result["parameters"])
    assert params["R0"] + params["R1"] == pytest.approx(13.0, rel=1e-3)
    assert max(abs(v) for v in result["fitted_curve"]["z_imag_fit"]) < 1e-8
    assert result["metrics"]["chi_square"] < 1e-10


def test_fit_impedance_handles_randles_with_cpe():
    frequencies = np.logspace(-1, 5, 70)
    omega = 2 * np.pi * frequencies
    rs, rp, y0, n = 2.5, 18.0, 1.5e-3, 0.85
    z_cpe = 1 / (y0 * (1j * omega) ** n)
    z_parallel = 1 / (1 / rp + 1 / z_cpe)
    z_total = rs + z_parallel

    result = fit_impedance(
        frequencies=frequencies,
        z_real=z_total.real,
        z_imag=z_total.imag,
        circuit_formula="R0-p(R1,CPE1)",
        initial_params={"R0": 1.0, "R1": 12.0, "CPE1_Y": 8e-4, "CPE1_n": 0.75},
        algorithm="LM",
    )

    assert result["status"] == "success"
    params = _params_to_map(result["parameters"])
    assert params["R0"] == pytest.approx(rs, rel=3e-2)
    assert params["R1"] == pytest.approx(rp, rel=5e-2)
    assert params["CPE1_Y"] == pytest.approx(y0, rel=1e-1)
    assert params["CPE1_n"] == pytest.approx(n, rel=3e-2)
    assert result["metrics"]["chi_square"] < 1e-6


def test_fit_impedance_rejects_unsupported_circuit():
    result = fit_impedance(
        frequencies=[1.0, 10.0],
        z_real=[1.0, 1.0],
        z_imag=[0.0, 0.0],
        circuit_formula="R0-W1",
        initial_params={"R0": 1.0, "W1": 1.0},
    )

    assert result["status"] == "error"
    assert "Unsupported circuit formula" in result["error_message"]
