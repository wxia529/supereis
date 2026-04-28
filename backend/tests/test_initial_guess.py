import math

import pytest

from services.initial_guess import estimate_initial_guess


def test_estimate_initial_guess_from_nyquist_features():
    frequencies = [10000.0, 5000.0, 2000.0, 1000.0, 500.0, 200.0, 100.0]
    z_real = [2.0, 2.7, 4.0, 7.0, 10.0, 11.3, 12.0]
    z_imag = [-0.1, -1.0, -3.0, -5.0, -3.0, -1.2, -0.2]

    guess = estimate_initial_guess(frequencies, z_real, z_imag)

    assert guess["Rs"] == pytest.approx(2.0)
    assert guess["Rp"] == pytest.approx(10.0)
    assert guess["tau"] == pytest.approx(1 / (2 * math.pi * 1000.0))


def test_estimate_initial_guess_provides_sensible_cpe_defaults():
    frequencies = [1000.0, 100.0, 10.0]
    z_real = [5.0, 8.0, 12.0]
    z_imag = [-0.1, -0.2, -0.1]

    guess = estimate_initial_guess(frequencies, z_real, z_imag)

    assert guess["CPE1_n"] == pytest.approx(0.9)
    assert guess["CPE1_Y"] > 0


def test_estimate_initial_guess_rejects_mismatched_lengths():
    with pytest.raises(ValueError, match="same length"):
        estimate_initial_guess([1.0, 2.0], [1.0], [-1.0, -2.0])
