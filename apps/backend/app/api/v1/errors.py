"""JSON error policy for ordinary routes; token routes retain their own guard."""

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException


async def validation_error(
    request: Request, error: RequestValidationError
) -> JSONResponse:
    # Never serialize validation inputs, context or exception text.
    return JSONResponse({"detail": "Invalid request"}, status_code=422)


async def http_error(request: Request, error: HTTPException) -> JSONResponse:
    detail = error.detail if isinstance(error.detail, str) else "Request failed"
    return JSONResponse(
        {"detail": detail}, status_code=error.status_code, headers=error.headers
    )


async def unexpected_error(request: Request, error: Exception) -> JSONResponse:
    # No exception logging here: exception/response-validation text may be secret.
    return JSONResponse({"detail": "Internal server error"}, status_code=500)
