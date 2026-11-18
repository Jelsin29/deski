import asyncio
import json

import pytest

from app.api.v1 import contracts, dependencies
from app.main import app


@pytest.mark.parametrize("disconnect", [True, False])
def test_live_disconnect_and_cancellation_close_upstream(disconnect):
    async def run():
        started = asyncio.Event()
        waiting = asyncio.Event()
        closed = asyncio.Event()
        sent = []

        class Service:
            async def open(self, payload):
                async def produce():
                    try:
                        yield contracts.StreamStart(data={"chat_id": "c"})
                        waiting.set()
                        await asyncio.Event().wait()
                    finally:
                        await asyncio.sleep(0)
                        closed.set()

                return produce()

        getter = getattr(dependencies, "get_chat_stream_service", None)
        if getter:
            app.dependency_overrides[getter] = lambda: Service()
        body = json.dumps({"message": "Hi"}).encode()
        delivered = False

        async def receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": body}
            await started.wait()
            await waiting.wait()
            if disconnect:
                return {"type": "http.disconnect"}
            await asyncio.Event().wait()

        async def send(message):
            sent.append(message)
            if message["type"] == "http.response.body" and message.get("body"):
                started.set()

        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/api/v1/chat/stream",
            "raw_path": b"/api/v1/chat/stream",
            "query_string": b"",
            "headers": [(b"content-type", b"application/json")],
            "server": ("test", 80),
            "client": ("test", 123),
            "root_path": "",
        }
        task = asyncio.create_task(app(scope, receive, send))
        try:
            if not disconnect:
                await asyncio.wait_for(waiting.wait(), 1)
                task.cancel()
                with pytest.raises(asyncio.CancelledError):
                    await asyncio.wait_for(task, 1)
            else:
                await asyncio.wait_for(task, 1)
            assert closed.is_set()
            assert sent[0]["status"] == 200
            assert b"".join(m.get("body", b"") for m in sent) == (
                b'event: start\ndata: {"chat_id":"c"}\n\n'
            )
        finally:
            if not task.done():
                task.cancel()
            app.dependency_overrides.clear()

    asyncio.run(run())
