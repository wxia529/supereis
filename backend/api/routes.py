from __future__ import annotations

import asyncio
import json
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from api.models import (
    CircuitParseRequest,
    CircuitParseResponse,
    FitSingleRequest,
    FitSingleResponse,
    ParameterSchema,
)
from services.circuit_parser import parse_circuit_formula
from services.fitter import fit_impedance

router = APIRouter(prefix="/api/v1")


@router.post("/circuit/parse", response_model=CircuitParseResponse)
def parse_circuit(req: CircuitParseRequest):
    try:
        params = parse_circuit_formula(req.formula)
        return CircuitParseResponse(
            parameters=[
                ParameterSchema(
                    name=p.name,
                    unit=p.unit,
                    initial=p.initial,
                    bounds=p.bounds,
                    description=p.description,
                )
                for p in params
            ]
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/fit/single", response_model=FitSingleResponse)
def fit_single(req: FitSingleRequest):
    result = fit_impedance(
        frequencies=req.frequencies,
        z_real=req.z_real,
        z_imag=req.z_imag,
        circuit_formula=req.circuit_formula,
        initial_params=req.initial_params,
        algorithm=req.algorithm,
    )

    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result.get("error_message"))

    return FitSingleResponse(**result)


@router.websocket("/ws/fit/batch")
async def websocket_batch_fit(websocket: WebSocket):
    await websocket.accept()

    try:
        data = await websocket.receive_text()
        message = json.loads(data)

        datasets = message.get("datasets", [])
        default_circuit = message.get("default_circuit_formula")
        default_params = message.get("default_initial_params", {})

        total = len(datasets)
        succeeded = 0
        failed = 0

        for i, dataset in enumerate(datasets):
            try:
                circuit_formula = dataset.get("circuit_formula") or default_circuit
                initial_params = dataset.get("initial_params") or default_params

                if not circuit_formula or not initial_params:
                    await websocket.send_json(
                        {
                            "type": "progress",
                            "current": i + 1,
                            "total": total,
                            "dataset_id": dataset.get("id"),
                            "result": {
                                "status": "error",
                                "error_message": "Missing circuit formula or initial params",
                                "parameters": [],
                                "fitted_curve": {"z_real_fit": [], "z_imag_fit": []},
                                "metrics": {"chi_square": float("nan"), "r_squared": None},
                            },
                        }
                    )
                    failed += 1
                    continue

                result: Dict[str, Any] = fit_impedance(
                    frequencies=dataset["frequencies"],
                    z_real=dataset["z_real"],
                    z_imag=dataset["z_imag"],
                    circuit_formula=circuit_formula,
                    initial_params=initial_params,
                )

                if result["status"] == "success":
                    succeeded += 1
                else:
                    failed += 1

                await websocket.send_json(
                    {
                        "type": "progress",
                        "current": i + 1,
                        "total": total,
                        "dataset_id": dataset.get("id"),
                        "result": result,
                    }
                )

                await asyncio.sleep(0.05)

            except Exception as exc:
                await websocket.send_json(
                    {
                        "type": "progress",
                        "current": i + 1,
                        "total": total,
                        "dataset_id": dataset.get("id"),
                        "result": {
                            "status": "error",
                            "error_message": str(exc),
                            "parameters": [],
                            "fitted_curve": {"z_real_fit": [], "z_imag_fit": []},
                            "metrics": {"chi_square": float("nan"), "r_squared": None},
                        },
                    }
                )
                failed += 1

        await websocket.send_json(
            {
                "type": "complete",
                "summary": {
                    "total_fitted": total,
                    "succeeded": succeeded,
                    "failed": failed,
                },
            }
        )

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
