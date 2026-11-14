"""Pure JavaScript value semantics used by the independent reporting projection.
No storage, clock or pricing-policy authority. UNDEF is a single shared identity."""

import json
import math
import re

JS_SPACE = "\t\n\v\f\r                  　﻿"


S = "[" + re.escape(JS_SPACE) + "]"


class _Undefined:
    def __bool__(self):
        return False

    def __repr__(self):
        return "undefined"


UNDEF = _Undefined()


def get(value, *path):
    """Optional chaining: a missing key or non-object yields undefined."""
    for key in path:
        if isinstance(value, dict):
            value = value.get(key, UNDEF)
        elif isinstance(value, list) and isinstance(key, int) and 0 <= key < len(value):
            value = value[key]
        else:
            return UNDEF
    return value


def truthy(v):
    if v is UNDEF or v is None or v is False:
        return False
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v != 0 and not (isinstance(v, float) and math.isnan(v))
    if isinstance(v, str):
        return v != ""
    return True


def jor(*values):
    for v in values[:-1]:
        if truthy(v):
            return v
    return values[-1]


def jand(a, b):
    return b if truthy(a) else a


def jstr(v):
    if v is UNDEF:
        return "undefined"
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, str):
        return v
    if isinstance(v, (int, float)):
        return _number_text(v)
    if isinstance(v, list):
        return ",".join(join_part(x) for x in v)
    return "[object Object]"


def join_part(v):
    return "" if v is UNDEF or v is None else jstr(v)


def jtype(v):
    if v is UNDEF:
        return "undefined"
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    if isinstance(v, str):
        return "string"
    return "object"


def jeq(a, b):
    """Strict equality (===); objects compare by identity."""
    if jtype(a) != jtype(b):
        return False
    if jtype(a) == "object":
        return a is b
    return a == b


def utf16(text):
    return text.encode("utf-16-be")


def jlt(a, b):
    """The relational < for the values that occur in records: strings by UTF-16 units, numbers numerically."""
    if isinstance(a, str) and isinstance(b, str):
        return utf16(a) < utf16(b)
    if jtype(a) == "number" and jtype(b) == "number":
        return a < b
    return False


def trim(text):
    return text.strip(JS_SPACE)


def jlen(v):
    if isinstance(v, (list, str)):
        return len(v)
    raise TypeError("length of a non-list")


def keys(obj):
    """Object.keys order: integer-like keys ascending, then insertion order."""
    if not isinstance(obj, dict):
        return []
    index = [k for k in obj if re.fullmatch(r"0|[1-9][0-9]{0,9}", k) and int(k) < 2**32 - 1]
    return sorted(index, key=int) + [k for k in obj if k not in index]


def clone(v):
    if v is UNDEF:
        raise TypeError("clone of undefined")
    return json.loads(json.dumps(v))


def items(d):
    v = get(d, "items")
    if not isinstance(v, list):
        raise TypeError("document without items")
    return v


def stringify(v):
    """JSON.stringify for equality: undefined stays undefined."""
    return UNDEF if v is UNDEF else json.dumps(plain(v), ensure_ascii=False, separators=(",", ":"))


def plain(value):
    """The value as JSON.stringify would write it: undefined object members omitted, undefined list entries null."""
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items() if v is not UNDEF}
    if isinstance(value, list):
        return [None if v is UNDEF else plain(v) for v in value]
    return value


def _number_text(v):
    if isinstance(v, float) and math.isnan(v):
        return "NaN"
    if isinstance(v, float) and v.is_integer() and abs(v) < 1e21:
        return str(int(v))
    return repr(v)


def norm_parcel(p):
    digits = re.sub("[" + re.escape(JS_SPACE) + "-]", "", "" if p is UNDEF or p is None else jstr(p))
    return digits if re.fullmatch(r"[0-9]{12}", digits) else ""
