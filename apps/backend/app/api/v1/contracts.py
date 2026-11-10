"""Provisional HTTP contracts; move domain models only with their future owners."""

from datetime import UTC
from enum import StrEnum
from typing import Annotated, Any, Literal, Self

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    SecretStr,
    StringConstraints,
    field_validator,
    model_validator,
)

NonblankMessage = Annotated[
    str, StringConstraints(min_length=1, max_length=10000, pattern=r"\S")
]
OpaqueId = Annotated[
    str, StringConstraints(min_length=1, max_length=128, pattern=r"\S")
]
DocumentName = Annotated[
    str, StringConstraints(min_length=1, max_length=255, pattern=r"\S")
]
DocumentContent = Annotated[
    str, StringConstraints(min_length=1, max_length=1000000, pattern=r"\S")
]
ModelName = Annotated[
    str, StringConstraints(min_length=1, max_length=128, pattern=r"\S")
]


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChatRequest(RequestModel):
    message: NonblankMessage
    chat_id: OpaqueId | None = None
    document_ids: list[OpaqueId] = Field(default_factory=list)


class ChatResponse(BaseModel):
    chat_id: OpaqueId
    message: NonblankMessage


class DocumentRequest(RequestModel):
    document_name: DocumentName
    content: DocumentContent


class DocumentResponse(BaseModel):
    document_id: OpaqueId
    document_name: DocumentName


class HistoryTimestamp(BaseModel):
    @field_validator("updated_at", "created_at", check_fields=False)
    @classmethod
    def normalize_utc(cls, value: AwareDatetime) -> AwareDatetime:
        return value.astimezone(UTC)


class ChatSummary(HistoryTimestamp):
    chat_id: OpaqueId
    title: str = Field(max_length=80)
    updated_at: AwareDatetime


class HistoryMessage(HistoryTimestamp):
    message_id: OpaqueId
    role: Literal["user", "assistant"]
    content: NonblankMessage
    created_at: AwareDatetime
    documents: list[DocumentResponse]


class Provider(StrEnum):
    """Provider identifiers: openai, or anthropic for Claude."""

    openai = "openai"
    anthropic = "anthropic"


class SettingsResponse(BaseModel):
    provider: Provider
    model: ModelName


def settings_patch_schema(schema: dict[str, Any]) -> None:
    # None represents omission internally; explicit null fails runtime validation.
    # Adjust only JSON Schema to preserve existing validation-error contracts.
    schema["minProperties"] = 1
    for field in schema["properties"].values():
        variants = field.pop("anyOf")
        field.update(next(item for item in variants if item != {"type": "null"}))
        field.pop("default", None)


class SettingsPatch(RequestModel):
    model_config = ConfigDict(json_schema_extra=settings_patch_schema)

    provider: Provider | None = None
    model: ModelName | None = None

    @model_validator(mode="after")
    def require_nonempty_patch(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Settings patch must contain provider or model")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Settings patch fields must not be null")
        return self


class TokenRequest(RequestModel):
    api_key: SecretStr = Field(min_length=1, max_length=4096)

    @field_validator("api_key")
    @classmethod
    def require_nonblank_key(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().strip():
            raise ValueError("Credential must not be blank")
        return value


class TokenResponse(BaseModel):
    provider: Provider
    configured: bool


class ErrorResponse(BaseModel):
    detail: str
