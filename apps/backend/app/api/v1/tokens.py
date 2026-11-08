from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from starlette.exceptions import HTTPException

from app.api.v1.contracts import ErrorResponse, Provider, TokenRequest, TokenResponse
from app.api.v1.dependencies import TokenService, get_token_service


class SecretSafeRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def handle(request: Request):
            # Token-only boundary: validation inputs, service errors and headers
            # may contain credentials. Never log them or change other routes.
            try:
                return await handler(request)
            except RequestValidationError:
                return JSONResponse(
                    {"detail": "Invalid token request"}, status_code=422
                )
            except HTTPException as error:
                detail = (
                    "Token service unavailable"
                    if error.status_code == 503
                    else "Token request failed"
                )
                return JSONResponse({"detail": detail}, status_code=error.status_code)
            except Exception:
                return JSONResponse({"detail": "Token service failed"}, status_code=500)

        return handle


router = APIRouter(route_class=SecretSafeRoute)


@router.put("/tokens/{provider}/{suffix:path}", include_in_schema=False)
async def reject_token_trailing_slash(suffix: str) -> JSONResponse:
    # Match single/repeated trailing slashes before Starlette can echo the path
    # in Location. Other methods match partially and return a fixed 405, not 307.
    # No dependencies or body parsing: rejected requests never reach services.
    if suffix.strip("/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    return JSONResponse({"detail": "Invalid token path"}, status_code=400)


@router.put(
    "/tokens/{provider}",
    tags=["tokens"],
    response_model=TokenResponse,
    responses={
        422: {"model": ErrorResponse, "description": "Invalid token request"},
        503: {"model": ErrorResponse, "description": "Token service unavailable"},
        500: {"model": ErrorResponse, "description": "Token service failed"},
    },
)
async def configure_token(
    provider: Provider,
    payload: TokenRequest,
    service: Annotated[TokenService, Depends(get_token_service)],
) -> TokenResponse:
    return await service.configure(provider, payload)
