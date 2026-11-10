from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.v1.contracts import (
    ChatRequest,
    ChatResponse,
    DocumentRequest,
    DocumentResponse,
    ErrorResponse,
    SettingsPatch,
    SettingsResponse,
)
from app.api.v1.dependencies import (
    ChatService,
    DocumentService,
    SettingsService,
    get_chat_service,
    get_document_service,
    get_settings_service,
)
from app.api.v1.health import router as health_router
from app.api.v1.history import router as history_router
from app.api.v1.streaming import router as streaming_router
from app.api.v1.tokens import router as token_router

router = APIRouter()
router.include_router(health_router)
router.include_router(history_router)
router.include_router(token_router)
router.include_router(streaming_router)

# Describe unavailable integrations without adding a shared runtime error handler.
services = APIRouter(responses={503: {"model": ErrorResponse}})


@services.post("/chat", tags=["chat"], response_model=ChatResponse)
async def chat(
    payload: ChatRequest, service: Annotated[ChatService, Depends(get_chat_service)]
) -> ChatResponse:
    return await service.send(payload)


@services.post("/documents", tags=["documents"], response_model=DocumentResponse)
async def documents(
    payload: DocumentRequest,
    service: Annotated[DocumentService, Depends(get_document_service)],
) -> DocumentResponse:
    return await service.create(payload)


@services.get("/settings", tags=["settings"], response_model=SettingsResponse)
async def settings(
    service: Annotated[SettingsService, Depends(get_settings_service)],
) -> SettingsResponse:
    return await service.get()


@services.patch("/settings", tags=["settings"], response_model=SettingsResponse)
async def update_settings(
    payload: SettingsPatch,
    service: Annotated[SettingsService, Depends(get_settings_service)],
) -> SettingsResponse:
    return await service.update(payload)


router.include_router(services)
