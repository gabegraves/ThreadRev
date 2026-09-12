"""Shared framing for ThreadRev checkers.

Standard library only. A checker reads one JSON object from stdin, writes one
JSON object to stdout, and exits 0 when the run completed (even if checks
fail) or 1 when the request was malformed. See contracts/checker-io.md.
"""

import json
import secrets
import sys
from datetime import datetime, timezone


class MalformedRequest(Exception):
    """Raised when the request cannot be evaluated. Message goes in `error`."""


def new_run_id(checker):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return "%s-%s-%s" % (checker, stamp, secrets.token_hex(2))


def require_number(obj, key, where):
    if not isinstance(obj, dict) or key not in obj:
        raise MalformedRequest("%s: missing '%s'" % (where, key))
    value = obj[key]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise MalformedRequest("%s: '%s' must be a number" % (where, key))
    return float(value)


def require_list(obj, key, where):
    if not isinstance(obj, dict) or key not in obj:
        raise MalformedRequest("%s: missing '%s'" % (where, key))
    value = obj[key]
    if not isinstance(value, list):
        raise MalformedRequest("%s: '%s' must be a list" % (where, key))
    return value


def require_str(obj, key, where):
    if not isinstance(obj, dict) or key not in obj:
        raise MalformedRequest("%s: missing '%s'" % (where, key))
    value = obj[key]
    if not isinstance(value, str) or not value:
        raise MalformedRequest("%s: '%s' must be a non-empty string" % (where, key))
    return value


def optional_number(obj, key, default, where):
    if key not in obj or obj[key] is None:
        return float(default)
    return require_number(obj, key, where)


def parse_request(raw, checker, version):
    """Validate the envelope. Returns (inputs) or raises MalformedRequest."""
    try:
        req = json.loads(raw)
    except ValueError as exc:
        raise MalformedRequest("request is not valid JSON: %s" % exc)
    if not isinstance(req, dict):
        raise MalformedRequest("request must be a JSON object")
    if req.get("checker") != checker:
        raise MalformedRequest(
            "checker mismatch: expected %r, got %r" % (checker, req.get("checker"))
        )
    if str(req.get("version")) != version:
        raise MalformedRequest(
            "version mismatch: expected %r, got %r" % (version, req.get("version"))
        )
    inputs = req.get("inputs")
    if not isinstance(inputs, dict):
        raise MalformedRequest("'inputs' must be a JSON object")
    return inputs


def run(checker, version, compute, stdin=None, stdout=None):
    """Frame one checker execution. `compute(inputs) -> (outputs, checks)`.

    Returns the process exit code. Always writes exactly one JSON object.
    """
    stdin = stdin or sys.stdin
    stdout = stdout or sys.stdout
    response = {
        "checker": checker,
        "version": version,
        "run_id": new_run_id(checker),
        "inputs": {},
        "outputs": {},
        "checks": [],
        "error": None,
    }
    code = 0
    try:
        inputs = parse_request(stdin.read(), checker, version)
        response["inputs"] = inputs
        outputs, checks = compute(inputs)
        response["outputs"] = outputs
        response["checks"] = checks
    except MalformedRequest as exc:
        response["error"] = str(exc)
        response["outputs"] = {}
        response["checks"] = []
        code = 1
    except Exception as exc:  # noqa: BLE001 - the envelope is the contract
        # Deliberately broad. The docstring above promises exactly one JSON
        # object on stdout, and the caller treats an unparseable stdout as "the
        # checker did not complete" with no detail. An IndexError escaping to a
        # traceback on stderr is a checker that answered nothing, which is the
        # one thing this harness exists to prevent. BaseException still escapes,
        # so KeyboardInterrupt and SystemExit behave normally.
        response["error"] = "%s: %s" % (type(exc).__name__, exc)
        response["outputs"] = {}
        response["checks"] = []
        code = 1
    json.dump(response, stdout, indent=2, sort_keys=False)
    stdout.write("\n")
    return code
