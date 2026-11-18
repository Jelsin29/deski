import pytest
from fastapi import HTTPException
from test_contracts import request

from app.api.v1.dependencies import get_history_service
from app.main import app


@pytest.fixture(autouse=True)
def overrides():
    yield
    app.dependency_overrides.clear()


def test_history_contract():
    calls = []
    chats = [
        {"chat_id": "old", "title": "", "updated_at": "2026-11-10T09:29:00Z"},
        {
            "chat_id": "new",
            "title": "t" * 80,
            "updated_at": "2026-11-10T11:30:00+02:00",
        },
    ]
    messages = [
        {
            "message_id": "m2",
            "role": "assistant",
            "content": "Reply",
            "created_at": "2026-11-10T09:30:00Z",
            "documents": [],
        },
        {
            "message_id": "m1",
            "role": "user",
            "content": "Question",
            "created_at": "2026-11-10T09:29:00Z",
            "documents": [{"document_id": "d7", "document_name": "notlar.md"}],
        },
    ]

    class History:
        async def list_chats(self):
            return chats

        async def messages(self, chat_id):
            calls.append(("messages", chat_id))
            if chat_id == "missing":
                raise HTTPException(404, "Chat not found")
            return messages

        async def delete(self, chat_id):
            calls.append(("delete", chat_id))
            if chat_id == "missing":
                raise HTTPException(404, "Chat not found")

    app.dependency_overrides[get_history_service] = lambda: History()
    response = request("GET", "/chats")
    assert response.status_code == 200
    assert response.json() == [
        dict(chats[1], updated_at="2026-11-10T09:30:00Z"),
        chats[0],
    ]
    response = request("GET", "/chats/c42/messages")
    assert response.status_code == 200
    assert response.json() == messages[::-1]
    response = request("DELETE", "/chats/c42")
    assert response.status_code == 204
    assert response.content == b""
    assert "content-type" not in response.headers
    assert calls == [("messages", "c42"), ("delete", "c42")]
    for method, suffix in [("GET", "/messages"), ("DELETE", "")]:
        response = request(method, f"/chats/missing{suffix}")
        assert response.status_code == 404
        assert response.json() == {"detail": "Chat not found"}
        before = calls.copy()
        response = request(method, f"/chats/{'x' * 129}{suffix}")
        assert response.status_code == 422
        assert response.json() == {"detail": "Invalid request"}
        assert calls == before
    chats.clear()
    messages.clear()
    assert request("GET", "/chats").json() == []
    assert request("GET", "/chats/c42/messages").json() == []


@pytest.mark.parametrize(
    "patch",
    [{"title": "t" * 81}, {"updated_at": "2026-11-10T09:30:00"}, {"chat_id": " "}],
)
def test_invalid_history_response_is_safe(patch):
    from test_errors import request as safe_request

    class History:
        async def list_chats(self):
            return [
                dict(chat_id="c", title="", updated_at="2026-11-10T09:30:00Z") | patch
            ]

    app.dependency_overrides[get_history_service] = lambda: History()
    response = safe_request("GET", "/api/v1/chats")
    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}


def test_history_unwired():
    for method, path in [
        ("GET", "/chats"),
        ("GET", "/chats/c/messages"),
        ("DELETE", "/chats/c"),
    ]:
        response = request(method, path)
        assert response.status_code == 503
        assert response.json() == {"detail": "History service unavailable"}
