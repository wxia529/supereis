from api.models import (
    BatchCompleteMessage,
    BatchDataset,
    BatchFitStartRequest,
    BatchProgressMessage,
    CircuitParseRequest,
    CircuitParseResponse,
    ExportRequest,
    FitMetrics,
    FittedCurve,
    FittedParameter,
    FitSingleRequest,
    FitSingleResponse,
    ParameterSchema,
)


def test_circuit_parse_models():
    req = CircuitParseRequest(formula="R0-p(R1,CPE1)-W1")
    param = ParameterSchema(name="R0", unit="Ω")
    resp = CircuitParseResponse(parameters=[param])
    assert req.formula.startswith("R0")
    assert resp.parameters[0].name == "R0"


def test_fit_single_models():
    req = FitSingleRequest(
        frequencies=[1.0, 10.0],
        z_real=[4.0, 5.0],
        z_imag=[-1.0, -2.0],
        circuit_formula="R0-R1",
        initial_params={"R0": 4.0, "R1": 20.0},
    )
    resp = FitSingleResponse(
        status="success",
        parameters=[FittedParameter(name="R0", value=4.1)],
        fitted_curve=FittedCurve(z_real_fit=[4.1, 5.0], z_imag_fit=[-1.0, -1.9]),
        metrics=FitMetrics(chi_square=0.001, r_squared=0.99),
    )
    assert req.algorithm == "LM"
    assert resp.metrics.chi_square > 0


def test_batch_and_export_models():
    ds = BatchDataset(id="file1", frequencies=[1.0], z_real=[4.0], z_imag=[-1.0])
    start = BatchFitStartRequest(datasets=[ds], default_circuit_formula="R0")
    progress = BatchProgressMessage(current=1, total=1, dataset_id="file1")
    complete = BatchCompleteMessage(summary={"total_fitted": 1, "failed": 0})
    export = ExportRequest(job_id="job-1")
    assert start.datasets[0].id == "file1"
    assert progress.type == "progress"
    assert complete.type == "complete"
    assert export.format == "excel"
