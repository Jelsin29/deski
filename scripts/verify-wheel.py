"""Inspect and exercise the installed artifact, never a source-tree import."""

import asyncio
import sys
from pathlib import Path
from zipfile import ZipFile

import httpx

import app
from app.main import app as application

wheel = Path(sys.argv[1])
source = Path(sys.argv[2]).resolve()
installed = Path(app.__file__).resolve()
assert not installed.is_relative_to(source), installed
assert "site-packages" in installed.parts, installed
with ZipFile(wheel) as archive:
    names = archive.namelist()
    assert "app/main.py" in names
    assert "app/api/v1/contracts.py" in names
    assert "app/api/v1/dependencies.py" in names
    assert all(
        (name.startswith("app/") and name.endswith(".py"))
        or name.startswith("deski_backend-0.1.0.dist-info/")
        for name in names
    ), names
    assert all(
        "__pycache__" not in name and not name.endswith((".pyc", ".env"))
        for name in names
    ), names
    expected = {
        str(file.relative_to(source)).replace("\\", "/")
        for file in (source / "app").rglob("*.py")
    }
    assert expected == {name for name in names if name.endswith(".py")}


async def verify():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        # Team-owned missing services must remain unavailable in the artifact too.
        response = await client.get("/api/v1/settings")
        assert response.status_code == 503
        assert response.json() == {"detail": "Settings service unavailable"}
    print(f"Installed app: {installed}")
    print("Installed wheel health verified: 200; missing service: 503")


asyncio.run(verify())
