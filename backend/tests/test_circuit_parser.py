from api.models import ParameterSchema
from services.circuit_parser import parse_circuit_formula


def test_parse_single_resistor():
    params = parse_circuit_formula("R0")
    assert params == [
        ParameterSchema(
            name="R0",
            unit="Ω",
            description="Resistance of R0",
        )
    ]


def test_parse_series_resistors():
    params = parse_circuit_formula("R0-R1")
    assert [p.name for p in params] == ["R0", "R1"]
    assert all(p.unit == "Ω" for p in params)


def test_parse_parallel_with_cpe_split_fields():
    params = parse_circuit_formula("R0-p(R1,CPE1)")
    assert [p.name for p in params] == ["R0", "R1", "CPE1_Y", "CPE1_n"]

    cpe_y = params[2]
    assert cpe_y.unit == "S·s^n"
    assert cpe_y.description == "CPE admittance prefactor of CPE1"

    cpe_n = params[3]
    assert cpe_n.unit == "dimensionless"
    assert cpe_n.description == "CPE exponent of CPE1"


def test_parse_single_warburg():
    params = parse_circuit_formula("W1")
    assert params == [
        ParameterSchema(
            name="W1",
            unit="Ω·s^-1/2",
            description="Warburg coefficient of W1",
        )
    ]


def test_parse_mixed_series_parallel_warburg():
    params = parse_circuit_formula("R0-p(R1,CPE1)-W1")
    assert [p.name for p in params] == ["R0", "R1", "CPE1_Y", "CPE1_n", "W1"]


def test_parse_rejects_invalid_formula():
    try:
        parse_circuit_formula("R0-")
    except ValueError as exc:
        assert "Invalid circuit formula" in str(exc)
    else:
        raise AssertionError("Expected ValueError for invalid formula")
