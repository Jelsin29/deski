import asyncio

from httpx import ASGITransport, AsyncClient

from app.main import app


def test_health_returns_deterministic_status() -> None:
    async def check_health() -> None:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            for _ in range(2):
                response = await client.get("/api/v1/health")

                assert response.status_code == 200
                assert response.headers["content-type"] == "application/json"
                assert response.json() == {"status": "ok"}

    asyncio.run(check_health())
