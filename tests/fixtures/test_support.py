"""Legacy test adapter; not deployed on City PCs."""

from decimal import Decimal
import citation_pricing


def scheduled_citation_base(ordinance, tier, library_key="", entry_id=""):
    result = citation_pricing.base_cents(citation_pricing.resolve(ordinance, library_key, entry_id), tier)
    return Decimal(result) / 100 if result is not None else None
