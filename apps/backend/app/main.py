from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException

from app.api.v1.contracts import ErrorResponse
from app.api.v1.errors import http_error, unexpected_error, validation_error
from app.api.v1.router import router as api_router

app = FastAPI(
    title="Deski backend",
    version="0.1.0",
    responses={422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    exception_handlers={
        RequestValidationError: validation_error,
        HTTPException: http_error,
        Exception: unexpected_error,
    },
)
app.include_router(api_router, prefix="/api/v1")
