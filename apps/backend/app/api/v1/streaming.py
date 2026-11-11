"""POST SSE transport; no provider or persistence implementation."""

import asyncio
from collections.abc import AsyncGenerator
from contextlib import suppress
from typing import Annotated

from anyio import CancelScope
from fastapi import APIRouter, Depends, HTTPException
from pydantic import TypeAdapter
from starlette.responses import StreamingResponse

from app.api.v1.contracts import (
    ChatRequest,
    ChatStreamEvent,
    ErrorResponse,
    StreamDone,
    StreamError,
    StreamStart,
)
from app.api.v1.dependencies import ChatStreamService, get_chat_stream_service

router = APIRouter()
validator = TypeAdapter(ChatStreamEvent)


async def close(upstream):
    with CancelScope(shield=True):
        with suppress(Exception):
            await upstream.aclose()


async def pull(upstream):
    # Isolate producer cleanup from Starlette's level-cancelled disconnect scope.
    task = asyncio.create_task(anext(upstream))
    try:
        return await asyncio.shield(task)
    finally:
        if not task.done():
            task.cancel()
            with CancelScope(shield=True):
                with suppress(asyncio.CancelledError, Exception):
                    await task


def frame(event: ChatStreamEvent) -> str:
    return f"event: {event.event}\ndata: {event.data.model_dump_json()}\n\n"


class EventStreamResponse(StreamingResponse):
    def __init__(self, upstream, first):
        self.upstream = upstream
        super().__init__(
            self.frames(first),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache"},
        )

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            await close(self.upstream)

    async def frames(self, first) -> AsyncGenerator[str, None]:
        yield frame(first)
        try:
            while True:
                event = validator.validate_python(await pull(self.upstream))
                if isinstance(event, (StreamStart, StreamError)):
                    break
                yield frame(event)
                if isinstance(event, StreamDone):
                    return
        except Exception:
            pass
        yield frame(StreamError(data={"detail": "Chat stream failed"}))


@router.post(
    "/chat/stream",
    tags=["chat"],
    response_class=EventStreamResponse,
    status_code=200,
    response_model=ChatStreamEvent,
    responses={
        200: {
            "content": {
                "text/event-stream": {
                    "schema": {
                        "oneOf": [
                            {"$ref": f"#/components/schemas/Stream{kind}"}
                            for kind in ("Start", "Delta", "Done", "Error")
                        ],
                    }
                }
            }
        },
        503: {"model": ErrorResponse},
    },
    description=(
        "POST SSE: start, delta*, done or error. Schema describes decoded events."
    ),
)
async def stream_chat(
    payload: ChatRequest,
    service: Annotated[ChatStreamService, Depends(get_chat_stream_service)],
) -> EventStreamResponse:
    upstream = None
    try:
        upstream = await service.open(payload)
        first = validator.validate_python(await pull(upstream))
        if not isinstance(first, StreamStart):
            raise ValueError("Expected start")
    except BaseException as error:
        if upstream is not None:
            await close(upstream)
        if isinstance(error, HTTPException):
            raise
        if not isinstance(error, Exception):
            raise
        raise HTTPException(503, "Chat service unavailable") from None
    return EventStreamResponse(upstream, first)
