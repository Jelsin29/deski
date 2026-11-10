from typing import Protocol

from fastapi import HTTPException

from app.api.v1.contracts import (
    ChatRequest,
    ChatResponse,
    ChatSummary,
    DocumentRequest,
    DocumentResponse,
    HistoryMessage,
    Provider,
    SettingsPatch,
    SettingsResponse,
    TokenRequest,
    TokenResponse,
)


class ChatService(Protocol):
    async def send(self, payload: ChatRequest) -> ChatResponse: ...


class HistoryService(Protocol):
    async def list_chats(self) -> list[ChatSummary]: ...

    async def messages(self, chat_id: str) -> list[HistoryMessage]: ...

    async def delete(self, chat_id: str) -> None: ...


class DocumentService(Protocol):
    async def create(self, payload: DocumentRequest) -> DocumentResponse: ...


class SettingsService(Protocol):
    async def get(self) -> SettingsResponse: ...

    async def update(self, payload: SettingsPatch) -> SettingsResponse: ...


class TokenService(Protocol):
    async def status(self) -> list[TokenResponse]: ...

    async def configure(
        self, provider: Provider, payload: TokenRequest
    ) -> TokenResponse: ...


# Approved team boundary: teammates own use cases, persistence and provider calls.
# Until those services are wired here, fail with 503, never fabricated success.
def get_chat_service() -> ChatService:
    raise HTTPException(status_code=503, detail="Chat service unavailable")


def get_history_service() -> HistoryService:
    raise HTTPException(status_code=503, detail="History service unavailable")


def get_document_service() -> DocumentService:
    raise HTTPException(status_code=503, detail="Document service unavailable")


def get_settings_service() -> SettingsService:
    raise HTTPException(status_code=503, detail="Settings service unavailable")


def get_token_service() -> TokenService:
    raise HTTPException(status_code=503, detail="Token service unavailable")
