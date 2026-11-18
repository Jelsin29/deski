import pytest
from test_contracts import request

from app.api.v1.dependencies import get_token_service
from app.main import app


@pytest.mark.parametrize(
    "method",
    ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS", "PATCH", "TRACE", "CONNECT"],
)
@pytest.mark.parametrize("suffix", ["/", "//", "///"])
def test_token_collection_slashes_never_redirect_or_call_service(
    method, suffix, caplog
):
    secret = "sentinel-credential"
    calls = []
    state = {"configured": False}

    class Tokens:
        async def status(self):
            calls.append("status")
            return []

        async def configure(self, provider, payload):
            calls.append("configure")
            state["configured"] = True
            return {"provider": provider, "configured": True}

    def service():
        calls.append("dependency")
        return Tokens()

    app.dependency_overrides[get_token_service] = service
    try:
        response = request(
            method,
            f"/tokens{suffix}?api_key={secret}",
            json={"api_key": secret},
            follow_redirects=False,
        )
        assert response.status_code == 404
        if method == "HEAD":
            assert response.content == b""
        else:
            assert response.json() == {"detail": "Not Found"}
        assert "location" not in response.headers
        assert secret not in response.text + str(response.headers) + caplog.text
        assert calls == []
        assert state == {"configured": False}
    finally:
        app.dependency_overrides.clear()
