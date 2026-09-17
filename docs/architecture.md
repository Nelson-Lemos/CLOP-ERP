# Arquitetura

## Visão geral

```text
CEO
 ↓
CLOP FRONTEND (React + TS + Vite)
 ↓ REST
FastAPI (Auth + Business Logic + Validação de permissões)
 ↓
SQLAlchemy
 ↓
MySQL (utf8mb4)
```

## Princípios

- O frontend **nunca** é camada de segurança — toda a autorização é validada no FastAPI.
- Regras de negócio no backend, nunca apenas no frontend.
- Soft delete (desativação lógica) em vez de remoção física de dados.
- Auditoria de todas as operações administrativas importantes.
- Separação em camadas: `models`, `schemas`, `routers`, `services`, `dependencies`, `core`.

## Camadas do backend

| Camada | Responsabilidade |
| --- | --- |
| `core/config.py` | Settings via pydantic-settings + `.env` |
| `core/database.py` | Engine, session e `Base` SQLAlchemy |
| `core/security.py` | Password hashing (bcrypt) e JWT (access + refresh) |
| `models` | Models SQLAlchemy (usuários, departamentos, tarefas, ...) |
| `schemas` | Schemas Pydantic de entrada/saída da API |
| `routers` | Endpoints REST (thin, delegam para services) |
| `services` | Lógica de negócio (auth, tarefas, produtividade, relatórios, notificações) |
| `dependencies` | Autenticação e permissões (dependencies FastAPI) |

## Fluxo de autorização

Quando um chefe cria uma tarefa, o backend valida que o `assigned_to` pertence ao departamento do chefe antes de persistir. O frontend apenas adapta a interface; a regra é imposta pela API.

## Frontend

- React + TypeScript + Vite.
- `services/*` para comunicação com a API (axios).
- `context/AuthContext` para estado de sessão.
- `routes/AppRoutes` para rotas protegidas por role.
- CSS modular por componente, com variáveis globais em `styles/variables.css`.

## Logos

- `frontend/public/branding/logo-dark.jpeg` (fonte `logo3.jpeg`) — fundo preto (sidebar, login).
- `frontend/public/branding/logo-light.jpeg` (fonte `logo4.jpeg`) — fundo claro.