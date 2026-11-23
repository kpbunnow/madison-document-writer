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
