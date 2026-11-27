"""JSON numbers readable by both helper and browser; no file or request authority."""

import json
import math


def finite_json(raw, number_error):
    """Keep ordinary JSON types and BOM handling, refusing nonfinite tokens and numeric overflow."""

    def refuse(token):
        raise ValueError(number_error)

    def number(text, kind=float):
        value = kind(text)
        try:
            finite = math.isfinite(value)
        except OverflowError:
            finite = False
        if not finite:
            refuse(text)
        return value

    return json.loads(raw, parse_constant=refuse, parse_float=number, parse_int=lambda text: number(text, int))


def finite_values(value):
    """Whether every number in an already-parsed value is finite. Python's json writes NaN and Infinity as tokens that
    no browser can parse, so a response must never carry them."""
    if isinstance(value, float):
        return math.isfinite(value)
    if isinstance(value, dict):
        return all(finite_values(v) for v in value.values())
    if isinstance(value, list):
        return all(finite_values(v) for v in value)
    return True
