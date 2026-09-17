from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import CurrentUser
from app.dependencies.permissions import require_ceo
from app.models.department import Department, DepartmentStatus
from app.models.user import User, UserRole
from app.schemas.department import DepartmentCreate, DepartmentDetail, DepartmentOut, DepartmentUpdate
from app.schemas.user import UserOut
from app.services.audit_service import record_audit

router = APIRouter(prefix="/departments", tags=["departments"])


def _assert_dept_access(current_user: User, department_id: int) -> None:
    if current_user.role == UserRole.CEO:
        return
    if current_user.role == UserRole.MANAGER and current_user.departamento_id == department_id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")


def _get_dept_or_404(db: Session, dept_id: int) -> Department:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if dept is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departamento não encontrado")
    return dept


def _enrich(dept: Department) -> DepartmentDetail:
    mgr = dept.manager
    emp_count = len(dept.funcionarios) if dept.funcionarios else 0
    return DepartmentDetail(
        id=dept.id,
        nome=dept.nome,
        descricao=dept.descricao,
        manager_id=dept.manager_id,
        manager_nome=mgr.nome_completo if mgr else None,
        manager_email=mgr.email if mgr else None,
        employee_count=emp_count,
        estado=dept.estado,
        created_at=dept.created_at,
        updated_at=dept.updated_at,
    )


@router.get("", response_model=list[DepartmentDetail])
def list_departments(
    current_user: CurrentUser,
    db: Session = Depends(get_db),
    q: str | None = Query(default=None),
) -> list[DepartmentDetail]:
    query = db.query(Department)

    if current_user.role == UserRole.MANAGER:
        query = query.filter(Department.id == current_user.departamento_id)
    elif current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")

    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(Department.nome.ilike(pattern))

    depts = query.order_by(Department.id).all()
    return [_enrich(d) for d in depts]


@router.post("", response_model=DepartmentDetail, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    request: Request,
    current_user: User = Depends(require_ceo),
    db: Session = Depends(get_db),
) -> DepartmentDetail:
    nome = payload.nome.strip()
    if db.query(Department).filter(Department.nome == nome).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Departamento com esse nome já existe")

    if payload.manager_id is not None:
        mgr = db.get(User, payload.manager_id)
        if mgr is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gestor não encontrado")

    dept = Department(
        nome=nome,
        descricao=payload.descricao,
        manager_id=payload.manager_id,
        estado=DepartmentStatus.ACTIVE,
    )
    db.add(dept)
    db.flush()
    record_audit(db, user_id=current_user.id, action="CREATE_DEPARTMENT", entity="department", entity_id=dept.id, request=request)
    db.commit()
    db.refresh(dept)
    return _enrich(dept)


@router.get("/{dept_id}", response_model=DepartmentDetail)
def get_department(
    dept_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> DepartmentDetail:
    dept = _get_dept_or_404(db, dept_id)
    _assert_dept_access(current_user, dept.id)
    return _enrich(dept)


@router.put("/{dept_id}", response_model=DepartmentDetail)
def update_department(
    dept_id: int,
    payload: DepartmentUpdate,
    request: Request,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> DepartmentDetail:
    dept = _get_dept_or_404(db, dept_id)
    is_manager = current_user.role == UserRole.MANAGER

    if current_user.role == UserRole.EMPLOYEE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")

    _assert_dept_access(current_user, dept.id)

    data = payload.model_dump(exclude_unset=True)

    if is_manager:
        data.pop("estado", None)

    if "nome" in data:
        nome = data["nome"].strip()
        conflict = db.query(Department).filter(Department.nome == nome, Department.id != dept.id).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nome de departamento já existe")
        data["nome"] = nome

    if "manager_id" in data and data["manager_id"] is not None:
        mgr = db.get(User, data["manager_id"])
        if mgr is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gestor não encontrado")

    for key, value in data.items():
        setattr(dept, key, value)

    record_audit(db, user_id=current_user.id, action="UPDATE_DEPARTMENT", entity="department", entity_id=dept.id, request=request)
    db.commit()
    db.refresh(dept)
    return _enrich(dept)


@router.get("/{dept_id}/employees", response_model=list[UserOut])
def get_department_employees(
    dept_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
) -> list[UserOut]:
    dept = _get_dept_or_404(db, dept_id)
    _assert_dept_access(current_user, dept.id)
    return [UserOut.model_validate(u) for u in dept.funcionarios]