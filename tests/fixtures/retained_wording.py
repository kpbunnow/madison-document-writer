"""Comparisons with a retained handler stay exact except for the deliberate change to what people read (bug-scan F7):
a body that is not JSON used to be answered with the parser's own sentence, and a TypeError (which the comparisons
inject as a stand-in for an internal failure) with its own text. Both are now answered with the plain sentences in
public_errors. Every status code, call and file effect still has to match."""

import re

import public_errors

PARSER_SENTENCE = re.compile(r"^(Expecting |Extra data|Unterminated string|Invalid control character|Invalid \\escape|Invalid \\u)")
INJECTED_TYPE_ERROR = re.compile(r"^(bad operation|typed \w+)$")


def _plain(text):
    if PARSER_SENTENCE.match(text):
        return public_errors.UNREADABLE
    if INJECTED_TYPE_ERROR.match(text):
        return public_errors.UNEXPECTED
    return text


def with_current_wording(value):
    if isinstance(value, dict):
        return {k: (_plain(v) if k == "error" and isinstance(v, str) else with_current_wording(v)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return type(value)(with_current_wording(v) for v in value)
    return value
