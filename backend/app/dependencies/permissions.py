from collections.abc import Callable

from fastapi import HTTPException, status

from app.dependencies.auth import CurrentUser
from app.models.user import User, UserRole


def require_roles(*roles: str) -> Callable:
    def checker(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para esta operação",
            )
        return current_user

    return checker


require_ceo = require_roles(UserRole.CEO)
require_ceo_or_manager = require_roles(UserRole.CEO, UserRole.MANAGER)