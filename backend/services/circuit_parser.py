from __future__ import annotations

from dataclasses import dataclass
from typing import List

from api.models import ParameterSchema

_SUPPORTED_ELEMENTS = {"R", "CPE", "W"}


@dataclass
class _Parser:
    formula: str
    index: int = 0
    elements: List[str] | None = None

    def __post_init__(self) -> None:
        if self.elements is None:
            self.elements = []

    def parse(self) -> None:
        self._parse_expression()
        if self.index != len(self.formula):
            raise ValueError(f"Invalid circuit formula: {self.formula}")

    def _parse_expression(self) -> None:
        self._parse_term()
        while self._peek() == "-":
            self.index += 1
            self._parse_term()

    def _parse_term(self) -> None:
        if self._peek() == "p":
            self._parse_parallel()
            return
        self._parse_element()

    def _parse_parallel(self) -> None:
        if not self.formula.startswith("p(", self.index):
            raise ValueError(f"Invalid circuit formula: {self.formula}")
        self.index += 2
        self._parse_expression()
        branch_count = 1
        while self._peek() == ",":
            self.index += 1
            self._parse_expression()
            branch_count += 1
        if branch_count < 2 or self._peek() != ")":
            raise ValueError(f"Invalid circuit formula: {self.formula}")
        self.index += 1

    def _parse_element(self) -> None:
        start = self.index
        while self._peek() and self._peek().isalpha():
            self.index += 1
        kind = self.formula[start:self.index]
        if kind not in _SUPPORTED_ELEMENTS:
            raise ValueError(f"Invalid circuit formula: {self.formula}")

        digit_start = self.index
        while self._peek() and self._peek().isdigit():
            self.index += 1
        if digit_start == self.index:
            raise ValueError(f"Invalid circuit formula: {self.formula}")

        self.elements.append(self.formula[start:self.index])

    def _peek(self) -> str:
        if self.index >= len(self.formula):
            return ""
        return self.formula[self.index]


def parse_circuit_formula(formula: str) -> List[ParameterSchema]:
    parser = _Parser(formula=formula)
    parser.parse()

    seen: set[str] = set()
    parameters: List[ParameterSchema] = []

    for element in parser.elements:
        if element in seen:
            continue
        seen.add(element)

        if element.startswith("R"):
            parameters.append(
                ParameterSchema(
                    name=element,
                    unit="Ω",
                    description=f"Resistance of {element}",
                )
            )
        elif element.startswith("W"):
            parameters.append(
                ParameterSchema(
                    name=element,
                    unit="Ω·s^-1/2",
                    description=f"Warburg coefficient of {element}",
                )
            )
        else:
            parameters.append(
                ParameterSchema(
                    name=f"{element}_Y",
                    unit="S·s^n",
                    description=f"CPE admittance prefactor of {element}",
                )
            )
            parameters.append(
                ParameterSchema(
                    name=f"{element}_n",
                    unit="dimensionless",
                    description=f"CPE exponent of {element}",
                )
            )

    return parameters
