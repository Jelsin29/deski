"""Export only the public schema; no server, credentials, or provider calls."""

import json

from app.main import app

# Team-owned services deliberately remain HTTP 503 until their owners wire them.
# Schema generation must not replace those boundaries with fake live success.
print(json.dumps(app.openapi(), sort_keys=True, separators=(",", ":")))
