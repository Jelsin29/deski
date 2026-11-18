"""Public error contracts; no providers, storage or external I/O."""

import asyncio

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.api.v1.dependencies import get_chat_service
from app.main import app


def request(method, path, **kwargs):
    async def send():
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            return await client.request(method, path, **kwargs)

    return asyncio.run(send())


@pytest.fixture
def chat_calls():
    calls = []

    class Chat:
        async def send(self, payload):
            calls.append(payload.model_dump())
            return {"chat_id": "chat", "message": "Reply"}

    app.dependency_overrides[get_chat_service] = lambda: Chat()
    yield calls
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "kwargs",
    [
        {"json": {"message": {"private": "sentinel"}}},
        {
            "content": '{"message":"sentinel',
            "headers": {"content-type": "application/json"},
        },
        {"json": {"message": "Hi", "sentinel": "sentinel"}},
    ],
)
def test_validation_is_fixed_and_never_calls_service(chat_calls, kwargs, caplog):
    response = request("POST", "/api/v1/chat", **kwargs)
    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request"}
    assert "sentinel" not in str(response.headers)
    assert "sentinel" not in caplog.text
    assert chat_calls == []


@pytest.mark.parametrize(
    "failure, status, detail",
    [
        (HTTPException(409, "Conflict", headers={"Retry-After": "2"}), 409, "Conflict"),
        (HTTPException(422, [{"input": "sentinel"}]), 422, "Request failed"),
        (HTTPException(400, {"private": "sentinel"}), 400, "Request failed"),
        (RuntimeError("sentinel"), 500, "Internal server error"),
        ({"chat_id": "sentinel"}, 500, "Internal server error"),
    ],
)
def test_service_errors_are_json_strings(failure, status, detail, caplog):
    calls = []

    class FailingChat:
        async def send(self, payload):
            calls.append(payload.message)
            if isinstance(failure, Exception):
                raise failure
            return failure

    app.dependency_overrides[get_chat_service] = lambda: FailingChat()
    try:
        response = request("POST", "/api/v1/chat", json={"message": "Hello"})
        assert response.status_code == status
        assert response.json() == {"detail": detail}
        assert response.headers["content-type"] == "application/json"
        assert "sentinel" not in str(response.headers)
        if status == 409:
            assert response.headers["retry-after"] == "2"
        assert "sentinel" not in caplog.text
        assert calls == ["Hello"]
    finally:
        app.dependency_overrides.clear()


def test_routing_errors_and_health_keep_status_and_body():
    for method, path, status, body in [
        ("GET", "/missing", 404, {"detail": "Not Found"}),
        ("POST", "/api/v1/health", 405, {"detail": "Method Not Allowed"}),
        ("GET", "/api/v1/health", 200, {"status": "ok"}),
    ]:
        response = request(method, path)
        assert response.status_code == status
        assert response.json() == body
    response = request("POST", "/api/v1/chat", json={"message": "Hello"})
    assert response.status_code == 503
    assert response.json() == {"detail": "Chat service unavailable"}


def test_openapi_error_contract_is_string_detail():
    response = request("GET", "/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    for path, methods in schema["paths"].items():
        for operation in methods.values():
            for status in ("422", "500"):
                assert operation["responses"][status]["content"]["application/json"][
                    "schema"
                ] == {"$ref": "#/components/schemas/ErrorResponse"}, path
    assert (
        schema["components"]["schemas"]["ErrorResponse"]["properties"]["detail"]["type"]
        == "string"
    )
    assert "HTTPValidationError" not in schema["components"]["schemas"]
