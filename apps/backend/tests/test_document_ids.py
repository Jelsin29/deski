from fastapi import HTTPException
from test_contracts import request

from app.api.v1.dependencies import get_chat_service
from app.main import app


def test_document_ids_delegation_and_rejection():
    calls, stored = [], []

    class Chat:
        async def send(self, payload):
            calls.append(payload.document_ids)
            if "unknown" in payload.document_ids:
                raise HTTPException(422, "Unknown document ID")
            stored.append(payload.message)
            return {"chat_id": "c", "message": "Reply"}

    app.dependency_overrides[get_chat_service] = lambda: Chat()
    try:
        for extra, expected in [
            ({}, []),
            ({"document_ids": []}, []),
            ({"document_ids": ["d7", "x" * 128]}, ["d7", "x" * 128]),
        ]:
            response = request("POST", "/chat", json={"message": "Hi", **extra})
            assert response.status_code == 200
            assert response.json() == {"chat_id": "c", "message": "Reply"}
            assert calls[-1] == expected
        for ids in [None, "d7", [""], [" "], ["x" * 129], [123]]:
            response = request(
                "POST", "/chat", json={"message": "Hi", "document_ids": ids}
            )
            assert response.status_code == 422
            assert response.json() == {"detail": "Invalid request"}
            assert len(calls) == 3
            assert stored == ["Hi"] * 3
        response = request(
            "POST", "/chat", json={"message": "Hi", "document_ids": ["unknown"]}
        )
        assert response.status_code == 422
        assert response.json() == {"detail": "Unknown document ID"}
        assert calls == [[], [], ["d7", "x" * 128], ["unknown"]]
        assert stored == ["Hi"] * 3
    finally:
        app.dependency_overrides.clear()
