from test_contracts import request

from app.api.v1.dependencies import get_token_service
from app.main import app


def test_collection_guard_preserves_canonical_get_and_provider_put():
    calls = []
    state = {"configured": False}

    class Tokens:
        async def status(self):
            calls.append("status")
            return [
                {"provider": "openai", "configured": state["configured"]},
                {"provider": "anthropic", "configured": False},
            ]

        async def configure(self, provider, payload):
            calls.append("configure")
            state["configured"] = True
            return {"provider": provider, "configured": True}

    def service():
        calls.append("dependency")
        return Tokens()

    app.dependency_overrides[get_token_service] = service
    try:
        response = request("GET", "/tokens", follow_redirects=False)
        assert response.status_code == 200
        assert response.json() == [
            {"provider": "openai", "configured": False},
            {"provider": "anthropic", "configured": False},
        ]
        assert "location" not in response.headers
        assert calls == ["dependency", "status"]
        assert state == {"configured": False}

        secret = "private-canary"
        response = request(
            "PUT",
            "/tokens/openai",
            json={"api_key": secret},
            follow_redirects=False,
        )
        assert response.status_code == 200
        assert response.json() == {"provider": "openai", "configured": True}
        assert "location" not in response.headers
        assert secret not in response.text + str(response.headers)
        assert calls == ["dependency", "status", "dependency", "configure"]
        assert state == {"configured": True}
    finally:
        app.dependency_overrides.clear()
