from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_health_endpoint_still_works():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_parse_circuit_endpoint_success():
    response = client.post(
        "/api/v1/circuit/parse",
        json={"formula": "R0-p(R1,CPE1)"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert [item["name"] for item in payload["parameters"]] == ["R0", "R1", "CPE1_Y", "CPE1_n"]


def test_parse_circuit_endpoint_invalid_formula():
    response = client.post(
        "/api/v1/circuit/parse",
        json={"formula": "R0-"},
    )

    assert response.status_code == 400
    assert "Invalid circuit formula" in response.json()["detail"]


def test_single_fit_endpoint_success():
    response = client.post(
        "/api/v1/fit/single",
        json={
            "frequencies": [1.0, 10.0, 100.0],
            "z_real": [5.0, 5.0, 5.0],
            "z_imag": [0.0, 0.0, 0.0],
            "circuit_formula": "R0",
            "initial_params": {"R0": 3.0},
            "algorithm": "LM",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["parameters"][0]["name"] == "R0"


def test_single_fit_endpoint_invalid_input():
    response = client.post(
        "/api/v1/fit/single",
        json={
            "frequencies": [1.0],
            "z_real": [5.0],
            "z_imag": [0.0],
            "circuit_formula": "R0",
            "initial_params": {"R0": 3.0},
            "algorithm": "LM",
        },
    )

    assert response.status_code == 400
    assert "At least two data points" in response.json()["detail"]
