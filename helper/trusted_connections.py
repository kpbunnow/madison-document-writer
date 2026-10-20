"""Outbound trust comes from the signed release, never the writable share."""

import json
from pathlib import Path
from urllib.parse import urlsplit
import urllib.request

MAX_JSON_BYTES = 20 * 1024 * 1024


def policy():
    value = json.loads(Path(__file__).with_name("trusted-connections.json").read_text())
    if value.get("version") != 1:
        raise ValueError("The signed connection allowlist is invalid")
    return value


def approved_gis(url):
    message = "GIS URL settings require HTTPS on a host in the signed release allowlist."
    try:
        value = urlsplit(url)
        allowed = (
            value.scheme == "https"
            and value.hostname
            and value.hostname.lower() in policy()["gisHosts"]
            and not value.username
            and not value.password
            and value.port in (None, 443)
        )
    except (ValueError, TypeError):
        raise ValueError(message) from None
    if not allowed:
        raise ValueError(message)
    return value.hostname.lower()


class Redirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        if approved_gis(newurl) != approved_gis(request.full_url):
            raise ValueError("GIS redirects must remain on the original approved host.")
        return super().redirect_request(request, fp, code, message, headers, newurl)


def fetch_json(url, timeout=25):
    approved_gis(url)
    request = urllib.request.Request(url, headers={"User-Agent": "MadisonDocWriter-Reporting"})
    with urllib.request.build_opener(Redirects()).open(request, timeout=timeout) as response:
        approved_gis(response.geturl())
        length = response.headers.get("Content-Length")
        if length and int(length) > MAX_JSON_BYTES:
            raise ValueError("GIS response exceeds the 20 MB limit.")
        raw = response.read(MAX_JSON_BYTES + 1)
        if len(raw) > MAX_JSON_BYTES:
            raise ValueError("GIS response exceeds the 20 MB limit.")
        return json.loads(raw.decode("utf-8"))


def approved_sql(server):
    if not isinstance(server, str) or server.casefold() not in {s.casefold() for s in policy()["sqlServers"]}:
        raise ValueError(("Case Lookup server must be in the signed release SQL allowlist, including when certificate validation is bypassed."))
