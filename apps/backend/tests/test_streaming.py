import asyncio

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.api.v1 import contracts, dependencies
from app.main import app


@pytest.fixture
def service():
    class FakeStream:
        calls = []
        stored = []
        closed = False
        failure = None
        events = []

        async def open(self, payload):
            self.calls.append(payload.model_dump())
            if self.failure:
                raise self.failure
            if "unknown" in payload.document_ids:
                raise HTTPException(422, "Unknown document ID")

            async def produce():
                try:
                    for event in self.events:
                        if isinstance(event, Exception):
                            raise event
                        yield event
                        if isinstance(event, contracts.StreamStart):
                            self.stored.append(payload.model_dump())
                finally:
                    self.closed = True

            return produce()

    fake = FakeStream()
    getter = getattr(dependencies, "get_chat_stream_service", None)
    if getter:
        app.dependency_overrides[getter] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def post(payload):
    async def send():
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.post("/api/v1/chat/stream", json=payload)

    return asyncio.run(send())


def event(kind, **data):
    return getattr(contracts, f"Stream{kind.title()}")(data=data)


def test_missing_stream_service():
    response = post({"message": "Hello"})
    assert response.status_code == 503
    assert response.json() == {"detail": "Chat service unavailable"}


def test_frames_and_document_ids(service):
    text = 'Merha\n\nevent: done\r\n"\\'
    service.events = [
        event("start", chat_id="c_42"),
        event("delta", text=text),
        event("done", message_id="m_9"),
        RuntimeError("must not read after terminal"),
    ]
    response = post({"message": "Hi", "document_ids": ["d_7"]})
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
    assert response.text == (
        'event: start\ndata: {"chat_id":"c_42"}\n\n'
        'event: delta\ndata: {"text":"Merha\\n\\nevent: done\\r\\n\\"\\\\"}\n\n'
        'event: done\ndata: {"message_id":"m_9"}\n\n'
    )
    assert service.calls == [
        {"message": "Hi", "chat_id": None, "document_ids": ["d_7"]}
    ]
    assert service.closed
    assert service.stored == service.calls


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"message": " "},
        {"message": "x" * 10001},
        {"message": "Hi", "chat_id": "x" * 129},
        {"message": "Hi", "document_ids": None},
        {"message": "Hi", "document_ids": [" "]},
        {"message": "Hi", "document_ids": ["x" * 129]},
        {"message": "Hi", "extra": True},
    ],
)
def test_rejected_input_never_calls_or_mutates(service, payload):
    response = post(payload)
    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request"}
    assert service.calls == service.stored == []


@pytest.mark.parametrize(
    "code,detail",
    [
        (422, "Unknown document ID"),
        (503, "Chat service unavailable"),
    ],
)
def test_acquisition_error_before_200(service, code, detail):
    service.failure = HTTPException(code, detail)
    response = post({"message": "Hi"})
    assert response.status_code == code
    assert response.json() == {"detail": detail}
    assert service.stored == []


def test_unknown_document_and_defaults(service):
    response = post({"message": "Hi", "document_ids": ["unknown"]})
    assert response.status_code == 422
    assert response.json() == {"detail": "Unknown document ID"}
    assert service.stored == []
    service.events = [event("start", chat_id="c"), event("done", message_id="m")]
    response = post({"message": "x" * 10000, "chat_id": "i" * 128})
    assert response.status_code == 200
    assert service.calls[-1]["document_ids"] == []


@pytest.mark.parametrize("first", ["http", "invalid", "empty"])
def test_preflight_errors_never_commit_200(service, first):
    service.events = {
        "http": [HTTPException(422, "Unknown document ID")],
        "invalid": [{"event": "delta", "data": {"text": "secret"}}],
        "empty": [],
    }[first]
    response = post({"message": "Hi"})
    assert response.status_code == (422 if first == "http" else 503)
    assert response.json() == {
        "detail": (
            "Unknown document ID" if first == "http" else "Chat service unavailable"
        )
    }
    assert service.closed
    assert service.stored == []


@pytest.mark.parametrize("failure", ["raise", "repeat", "empty", "error", "invalid"])
def test_after_start_safe_terminal_error(service, failure, caplog):
    service.events = [event("start", chat_id="c")]
    service.events += {
        "raise": [RuntimeError("secret")],
        "repeat": [event("start", chat_id="secret")],
        "empty": [],
        "error": [event("error", detail="secret"), event("done", message_id="m")],
        "invalid": [{"event": "delta", "data": {"text": 123}}],
    }[failure]
    response = post({"message": "Hi"})
    assert response.status_code == 200
    assert response.text == (
        'event: start\ndata: {"chat_id":"c"}\n\n'
        'event: error\ndata: {"detail":"Chat stream failed"}\n\n'
    )
    assert service.closed
    assert "secret" not in caplog.text


def test_stream_openapi():
    schema = app.openapi()
    operation = schema["paths"]["/api/v1/chat/stream"]["post"]
    assert operation["requestBody"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ChatRequest"
    }
    assert set(operation["responses"]["200"]["content"]) == {"text/event-stream"}
    for kind in ["Start", "Delta", "Done", "Error"]:
        assert f"Stream{kind}" in schema["components"]["schemas"]
    assert {"422", "503"} <= operation["responses"].keys()
