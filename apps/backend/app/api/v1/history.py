from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response
from pydantic import TypeAdapter

from app.api.v1.contracts import ChatSummary, ErrorResponse, HistoryMessage, OpaqueId
from app.api.v1.dependencies import HistoryService, get_history_service

router = APIRouter(
    tags=["history"],
    responses={503: {"model": ErrorResponse}},
)
History = Annotated[HistoryService, Depends(get_history_service)]
ChatId = Annotated[OpaqueId, Path()]


@router.get("/chats", response_model=list[ChatSummary])
async def list_chats(service: History) -> list[ChatSummary]:
    items = TypeAdapter(list[ChatSummary]).validate_python(await service.list_chats())
    return sorted(items, key=lambda item: item.updated_at, reverse=True)


@router.get(
    "/chats/{chat_id}/messages",
    response_model=list[HistoryMessage],
    responses={404: {"model": ErrorResponse}},
)
async def messages(chat_id: ChatId, service: History) -> list[HistoryMessage]:
    items = TypeAdapter(list[HistoryMessage]).validate_python(
        await service.messages(chat_id)
    )
    return sorted(items, key=lambda item: item.created_at)


@router.delete(
    "/chats/{chat_id}", status_code=204, responses={404: {"model": ErrorResponse}}
)
async def delete_chat(chat_id: ChatId, service: History) -> Response:
    await service.delete(chat_id)
    return Response(status_code=204)
