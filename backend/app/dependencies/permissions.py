from collections.abc import Callable

from fastapi import HTTPException, status

from app.dependencies.auth import CurrentUser
from app.models.user import User, UserRole

ADMIN_ROLES: tuple[str, ...] = UserRole.admin_roles()


def is_admin(user: User | str) -> bool:
    role = user.role if isinstance(user, User) else user
    return UserRole.is_admin(role)


def require_roles(*roles: str) -> Callable:
    def checker(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para esta operação",
            )
        return current_user

    return checker


require_admin = require_roles(*ADMIN_ROLES)
require_admin_or_manager = require_roles(*ADMIN_ROLES, UserRole.MANAGER)
