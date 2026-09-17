# API

Documentação automática disponível em `/docs` (Swagger) e `/redoc` (Redoc).

Base: `http://localhost:8000/api`

## Auth

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/login` | Login (email + password) → access + refresh |
| POST | `/api/auth/refresh` | Renova access token com refresh token |
| GET | `/api/auth/me` | Utilizador autenticado |

## Users

| Método | Rota | Permissão |
| --- | --- | --- |
| GET | `/api/users` | CEO / Chefe |
| POST | `/api/users` | CEO |
| GET | `/api/users/{id}` | CEO / Chefe (departamento) / próprio |
| PUT | `/api/users/{id}` | CEO / Chefe (departamento) |
| PATCH | `/api/users/{id}/status` | CEO |

## Departments

| Método | Rota | Permissão |
| --- | --- | --- |
| GET | `/api/departments` | Todos autenticados (CEO vê todos) |
| POST | `/api/departments` | CEO |
| GET | `/api/departments/{id}` | CEO / Chefe do departamento |
| PUT | `/api/departments/{id}` | CEO |
| GET | `/api/departments/{id}/employees` | CEO / Chefe do departamento |

## Tasks

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/tasks` | Lista filtrada por permissão |
| POST | `/api/tasks` | Criar (CEO / Chefe) |
| GET | `/api/tasks/{id}` | Ver detalhe |
| PUT | `/api/tasks/{id}` | Atualizar |
| PATCH | `/api/tasks/{id}/status` | Mudar status (com validação de fluxo) |
| PATCH | `/api/tasks/{id}/progress` | Atualizar progresso (funcionário) |
| POST | `/api/tasks/{id}/submit` | Submeter (`PENDING|IN_PROGRESS → UNDER_REVIEW`) |
| POST | `/api/tasks/{id}/approve` | Aprovar (`UNDER_REVIEW → COMPLETED`) |
| POST | `/api/tasks/{id}/reject` | Rejeitar (`UNDER_REVIEW → REJECTED`, motivo obrigatório) |
| GET | `/api/tasks/{id}/history` | Histórico da tarefa |

## Dashboards

| Rota | Permissão |
| --- | --- |
| `GET /api/dashboard/admin` | CEO |
| `GET /api/dashboard/department` | Chefe |
| `GET /api/dashboard/employee` | Funcionário |

## Produtividade

| Rota | Permissão |
| --- | --- |
| `GET /api/productivity/company` | CEO |
| `GET /api/productivity/departments` | CEO |
| `GET /api/productivity/employees/{id}` | CEO / Chefe (departamento) / próprio |

Indicadores: `total_tasks`, `completed_tasks`, `pending_tasks`, `overdue_tasks`, `rejected_tasks`, `completion_rate`, `on_time_rate`, `average_completion_time`.

## Relatórios

| Rota | Descrição |
| --- | --- |
| `GET /api/reports/daily` | Diário |
| `GET /api/reports/weekly` | Semanal |
| `GET /api/reports/monthly` | Mensal |
| `GET /api/reports/employee/{id}` | Individual |
| `GET /api/reports/department/{id}` | Departamental |
| `GET /api/reports/company` | Empresa |
| `GET /api/reports/monthly/pdf` | PDF mensal |
| `GET /api/reports/employee/{id}/pdf` | PDF individual |
| `GET /api/reports/department/{id}/pdf` | PDF departamental |

Filtros: `start_date`, `end_date`, `department_id`, `user_id`, `tipo`, `status`, `prioridade`.

## Notificações

- `GET /api/notifications` — lista do utilizador autenticado.
- `PATCH /api/notifications/{id}/read` — marcar como lida.

## Auditoria

- `GET /api/audit` — logs (CEO).