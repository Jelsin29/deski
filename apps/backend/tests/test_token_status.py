from fastapi import HTTPException
from test_contracts import request

from app.api.v1.dependencies import get_token_service
from app.main import app


def test_token_status_secret_boundary(caplog):
    response = request("GET", "/tokens")
    assert response.status_code == 503
    assert response.json() == {"detail": "Token service unavailable"}
    secret = "sentinel-status-secret"
    calls = []
    metadata = [
        {"provider": "anthropic", "configured": True, "api_key": secret},
        {"provider": "openai", "configured": False},
    ]

    class Tokens:
        async def status(self):
            calls.append("status")
            if isinstance(_result, Exception):
                raise _result
            return _result

    app.dependency_overrides[get_token_service] = lambda: Tokens()
    try:
        for _result, code, body in [
            (
                metadata,
                200,
                [
                    {"provider": "openai", "configured": False},
                    {"provider": "anthropic", "configured": True},
                ],
            ),
            (
                HTTPException(400, secret, headers={"leak": secret}),
                400,
                {"detail": "Token request failed"},
            ),
            (HTTPException(503, secret), 503, {"detail": "Token service unavailable"}),
            (RuntimeError(secret), 500, {"detail": "Token service failed"}),
            (
                [{"provider": secret, "configured": True}],
                500,
                {"detail": "Token service failed"},
            ),
            (metadata[:1], 500, {"detail": "Token service failed"}),
            ([metadata[0], metadata[0]], 500, {"detail": "Token service failed"}),
        ]:
            response = request("GET", "/tokens")
            assert response.status_code == code
            assert response.json() == body
            assert secret not in response.text + str(response.headers) + caplog.text
        assert calls == ["status"] * 7
    finally:
        app.dependency_overrides.clear()
