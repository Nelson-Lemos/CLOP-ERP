from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    senha_atual: str = Field(min_length=1, max_length=128)
    nova_password: str = Field(min_length=8, max_length=128)
    confirmar_password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MeOut(UserOut):
    departamento_nome: str | None = None
    chefe_nome: str | None = None


class AuthResponse(TokenResponse):
    user: MeOut