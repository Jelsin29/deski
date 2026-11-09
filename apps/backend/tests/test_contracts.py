import asyncio

from httpx import ASGITransport, AsyncClient

from app.main import app


def request(method, path, **kwargs):
    async def send():
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.request(method, f"/api/v1{path}", **kwargs)

    return asyncio.run(send())


def error(field, kind, message, value, **context):
    detail = {
        "type": kind,
        "loc": ["body", field] if field else ["body"],
        "msg": message,
        "input": value,
    }
    if context:
        detail["ctx"] = context
    return detail


def string_error(field, value, maximum):
    if not value:
        return error(
            field,
            "string_too_short",
            "String should have at least 1 character",
            value,
            min_length=1,
        )
    if len(value) > maximum:
        return error(
            field,
            "string_too_long",
            f"String should have at most {maximum} characters",
            value,
            max_length=maximum,
        )
    return error(
        field,
        "string_pattern_mismatch",
        "String should match pattern '\\S'",
        value,
        pattern=r"\S",
    )


def test_openapi_contracts():
    schema = app.openapi()
    for path, methods in {
        "/chat": ["post"],
        "/documents": ["post"],
        "/settings": ["get", "patch"],
        "/tokens/{provider}": ["put"],
    }.items():
        for method in methods:
            assert "503" in schema["paths"][f"/api/v1{path}"][method]["responses"]
    token = schema["components"]["schemas"]["TokenRequest"]
    assert token["properties"]["api_key"]["writeOnly"] is True
    assert token["properties"]["api_key"]["format"] == "password"
    assert "example" not in str(token).lower()
    assert schema["components"]["schemas"]["Provider"]["enum"] == [
        "openai",
        "anthropic",
    ]
    response = schema["components"]["schemas"]["TokenResponse"]
    assert set(response["properties"]) == {"provider", "configured"}


def test_public_settings_patch_schema_matches_runtime():
    async def fetch_schema():
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.get("/openapi.json")

    response = asyncio.run(fetch_schema())
    assert response.status_code == 200
    patch = response.json()["components"]["schemas"]["SettingsPatch"]
    assert patch == {
        "title": "SettingsPatch",
        "type": "object",
        "additionalProperties": False,
        "minProperties": 1,
        "properties": {
            "provider": {"$ref": "#/components/schemas/Provider"},
            "model": {
                "title": "Model",
                "type": "string",
                "minLength": 1,
                "maxLength": 128,
                "pattern": r"\S",
            },
        },
    }


def test_ordinary_validation_is_not_redacted():
    from app.api.v1.dependencies import get_chat_service

    app.dependency_overrides[get_chat_service] = lambda: object()
    try:
        response = request("POST", "/chat", json={"message": 123})
        assert response.status_code == 422
        assert response.json() == {
            "detail": [
                {
                    "type": "string_type",
                    "loc": ["body", "message"],
                    "msg": "Input should be a valid string",
                    "input": 123,
                }
            ]
        }
    finally:
        app.dependency_overrides.clear()


def test_token_trailing_slash_never_redirects_or_calls_service():
    from app.api.v1.contracts import TokenResponse
    from app.api.v1.dependencies import get_token_service

    secret = "sentinel-independent-credential"
    calls = []
    state = {"configured": False}

    class FakeTokens:
        async def configure(self, provider, payload):
            calls.append(provider)
            state["configured"] = True
            return TokenResponse(provider=provider, configured=True)

    app.dependency_overrides[get_token_service] = lambda: FakeTokens()
    try:
        for method in [
            "PUT",
            "GET",
            "POST",
            "PATCH",
            "DELETE",
            "HEAD",
            "OPTIONS",
            "TRACE",
            "CONNECT",
            "PROPFIND",
        ]:
            for provider in [secret, "openai", f"{secret}/"]:
                response = request(
                    method,
                    f"/tokens/{provider}/",
                    json={"api_key": secret},
                    follow_redirects=False,
                )
                code = 400 if method == "PUT" else 405
                assert response.status_code == code, (
                    f"status={response.status_code}, "
                    f"Location={response.headers.get('location')}"
                )
                assert "location" not in response.headers
                if method == "HEAD":
                    assert response.content == b""
                else:
                    detail = (
                        "Invalid token path"
                        if method == "PUT"
                        else "Method Not Allowed"
                    )
                    assert response.json() == {"detail": detail}
                assert secret not in response.text
                assert secret not in str(response.headers)
                assert calls == []
                assert state == {"configured": False}
        response = request(
            "PUT",
            f"/tokens/{secret}/invalid",
            json={"api_key": secret},
            follow_redirects=False,
        )
        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}
        assert "location" not in response.headers
        assert calls == []
        assert state == {"configured": False}
    finally:
        app.dependency_overrides.clear()

    response = request("PUT", "/tokens/openai", json={"api_key": secret})
    assert response.status_code == 503
    assert response.json() == {"detail": "Token service unavailable"}
    response = request("GET", "/health")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}


def test_tokens_contract(caplog):
    secret = "sentinel-not-a-real-credential"
    response = request("PUT", "/tokens/openai", json={"api_key": secret})
    assert response.status_code == 503
    assert response.json() == {"detail": "Token service unavailable"}

    from app.api.v1.contracts import TokenResponse
    from app.api.v1.dependencies import get_token_service

    calls = []

    class FakeTokens:
        async def configure(self, provider, payload):
            calls.append((provider.value, payload.api_key.get_secret_value()))
            assert secret not in repr(payload)
            return TokenResponse(provider=provider, configured=True)

    app.dependency_overrides[get_token_service] = lambda: FakeTokens()
    try:
        for provider, key in [
            ("openai", secret),
            ("anthropic", "x"),
            ("openai", "k" * 4096),
        ]:
            response = request("PUT", f"/tokens/{provider}", json={"api_key": key})
            assert response.status_code == 200
            assert response.json() == {"provider": provider, "configured": True}
            assert calls[-1] == (provider, key)
        for provider, payload in [
            ("openai", {}),
            ("openai", {"api_key": ""}),
            ("openai", {"api_key": " "}),
            ("openai", {"api_key": "k" * 4097}),
            ("openai", {"api_key": None}),
            ("openai", {"api_key": 123}),
            ("openai", {"api_key": {"nested": secret}}),
            ("openai", {"api_key": secret, secret: secret}),
            (secret, {"api_key": secret}),
        ]:
            response = request("PUT", f"/tokens/{provider}", json=payload)
            assert response.status_code == 422
            assert response.json() == {"detail": "Invalid token request"}
            assert len(calls) == 3
        response = request("PUT", "/tokens/openai", content='{"api_key":"' + secret)
        assert response.status_code == 422
        assert response.json() == {"detail": "Invalid token request"}
        assert len(calls) == 3
        assert secret not in caplog.text
    finally:
        app.dependency_overrides.clear()


def test_token_service_errors_are_safe(caplog):
    from fastapi import HTTPException

    from app.api.v1.dependencies import get_token_service

    secret = "sentinel-service-error"

    class FailingTokens:
        async def configure(self, provider, payload):
            if isinstance(_failure, Exception):
                raise _failure
            return _failure

    app.dependency_overrides[get_token_service] = lambda: FailingTokens()
    try:
        for _failure, code, detail in [
            (HTTPException(503, secret), 503, "Token service unavailable"),
            (
                HTTPException(400, secret, headers={"leak": secret}),
                400,
                "Token request failed",
            ),
            (RuntimeError(secret), 500, "Token service failed"),
            ({"provider": secret, "configured": True}, 500, "Token service failed"),
        ]:
            response = request("PUT", "/tokens/openai", json={"api_key": secret})
            assert response.status_code == code
            assert response.json() == {"detail": detail}
            assert secret not in str(response.headers)
        assert secret not in caplog.text
    finally:
        app.dependency_overrides.clear()


def test_settings_contract():
    from app.api.v1.contracts import SettingsResponse
    from app.api.v1.dependencies import get_settings_service

    for method, kwargs in [("GET", {}), ("PATCH", {"json": {"model": "new"}})]:
        response = request(method, "/settings", **kwargs)
        assert response.status_code == 503
        assert response.json() == {"detail": "Settings service unavailable"}
    calls = []
    state = {"provider": "openai", "model": "initial"}

    class FakeSettings:
        async def get(self):
            calls.append("get")
            return SettingsResponse(**state)

        async def update(self, payload):
            update = payload.model_dump(exclude_unset=True)
            calls.append(update)
            state.update(update)
            return SettingsResponse(**state)

    app.dependency_overrides[get_settings_service] = lambda: FakeSettings()
    try:
        response = request("GET", "/settings")
        assert response.status_code == 200
        assert response.json() == state
        for patch in [
            {"provider": "anthropic"},
            {"model": "m" * 128},
            {"provider": "openai", "model": "x"},
        ]:
            before = state.copy()
            response = request("PATCH", "/settings", json=patch)
            assert response.status_code == 200
            assert response.json() == before | patch
            assert calls[-1] == patch
        snapshot = state.copy()
        for patch in [
            {},
            {"provider": None},
            {"provider": "claude"},
            {"model": None},
            {"model": ""},
            {"model": " "},
            {"model": "m" * 129},
            {"other": "x"},
        ]:
            response = request("PATCH", "/settings", json=patch)
            assert response.status_code == 422
            if not patch or any(value is None for value in patch.values()):
                message = (
                    "Settings patch must contain provider or model"
                    if not patch
                    else "Settings patch fields must not be null"
                )
                expected = [
                    error(
                        None, "value_error", f"Value error, {message}", patch, error={}
                    )
                ]
            elif "provider" in patch:
                expected = [
                    error(
                        "provider",
                        "enum",
                        "Input should be 'openai' or 'anthropic'",
                        patch["provider"],
                        expected="'openai' or 'anthropic'",
                    )
                ]
            elif "model" in patch:
                expected = [string_error("model", patch["model"], 128)]
            else:
                expected = [
                    error(
                        "other",
                        "extra_forbidden",
                        "Extra inputs are not permitted",
                        "x",
                    )
                ]
            assert response.json() == {"detail": expected}
            assert calls == [
                "get",
                {"provider": "anthropic"},
                {"model": "m" * 128},
                {"provider": "openai", "model": "x"},
            ]
            assert state == snapshot
    finally:
        app.dependency_overrides.clear()


def test_documents_contract():
    from app.api.v1.contracts import DocumentResponse
    from app.api.v1.dependencies import get_document_service

    response = request(
        "POST", "/documents", json={"document_name": "Notes", "content": "Text"}
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "Document service unavailable"}
    calls = []

    class FakeDocuments:
        async def create(self, payload):
            calls.append(payload.model_dump())
            return DocumentResponse(
                document_id="doc", document_name=payload.document_name
            )

    app.dependency_overrides[get_document_service] = lambda: FakeDocuments()
    try:
        for name, content in [("N", "T"), ("n" * 255, "t" * 1000000)]:
            response = request(
                "POST", "/documents", json={"document_name": name, "content": content}
            )
            assert response.status_code == 200
            assert response.json() == {"document_id": "doc", "document_name": name}
            assert calls[-1] == {"document_name": name, "content": content}
        for payload in [
            {},
            {"document_name": "", "content": "text"},
            {"document_name": " ", "content": "text"},
            {"document_name": "n" * 256, "content": "text"},
            {"document_name": "Notes", "content": ""},
            {"document_name": "Notes", "content": "\n "},
            {"document_name": "Notes", "content": "t" * 1000001},
            {"document_name": "Notes", "path": "/not-read"},
        ]:
            response = request("POST", "/documents", json=payload)
            assert response.status_code == 422
            expected = []
            for field, maximum in [("document_name", 255), ("content", 1000000)]:
                if field not in payload:
                    expected.append(error(field, "missing", "Field required", payload))
                elif not payload[field].strip() or len(payload[field]) > maximum:
                    expected.append(string_error(field, payload[field], maximum))
            if "path" in payload:
                expected.append(
                    error(
                        "path",
                        "extra_forbidden",
                        "Extra inputs are not permitted",
                        "/not-read",
                    )
                )
            assert response.json() == {"detail": expected}
            assert len(calls) == 2
    finally:
        app.dependency_overrides.clear()


def test_chat_unavailable_without_service():
    response = request("POST", "/chat", json={"message": "Hello"})
    assert response.status_code == 503
    assert response.json() == {"detail": "Chat service unavailable"}


def test_chat_delegates_and_rejects_invalid_input():
    from app.api.v1.contracts import ChatResponse
    from app.api.v1.dependencies import get_chat_service

    calls = []

    class FakeChat:
        async def send(self, payload):
            calls.append(payload.model_dump())
            return ChatResponse(chat_id="conversation", message="Reply")

    app.dependency_overrides[get_chat_service] = lambda: FakeChat()
    try:
        for payload in [{"message": "H"}, {"message": "Hi", "chat_id": "old"}]:
            response = request("POST", "/chat", json=payload)
            assert response.status_code == 200
            assert response.json() == {"chat_id": "conversation", "message": "Reply"}
        assert calls == [
            {"message": "H", "chat_id": None},
            {"message": "Hi", "chat_id": "old"},
        ]
        for payload in [
            {},
            {"message": ""},
            {"message": "  "},
            {"message": "x" * 10001},
            {"message": "Hi", "chat_id": ""},
            {"message": "Hi", "chat_id": " "},
            {"message": "Hi", "chat_id": "x" * 129},
            {"message": "Hi", "extra": True},
        ]:
            response = request("POST", "/chat", json=payload)
            assert response.status_code == 422
            if not payload:
                expected = [error("message", "missing", "Field required", payload)]
            elif "extra" in payload:
                expected = [
                    error(
                        "extra",
                        "extra_forbidden",
                        "Extra inputs are not permitted",
                        True,
                    )
                ]
            else:
                field = "chat_id" if "chat_id" in payload else "message"
                expected = [
                    string_error(
                        field, payload[field], 128 if field == "chat_id" else 10000
                    )
                ]
            assert response.json() == {"detail": expected}
            assert len(calls) == 2
        response = request(
            "POST", "/chat", json={"message": "x" * 10000, "chat_id": "i" * 128}
        )
        assert response.status_code == 200
        assert response.json() == {"chat_id": "conversation", "message": "Reply"}
        assert calls[-1] == {"message": "x" * 10000, "chat_id": "i" * 128}
        response = request("POST", "/chat", json={"message": "H", "chat_id": None})
        assert response.status_code == 200
        assert response.json() == {"chat_id": "conversation", "message": "Reply"}
        assert calls[-1] == {"message": "H", "chat_id": None}
    finally:
        app.dependency_overrides.clear()
