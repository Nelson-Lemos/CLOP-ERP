# CLOP Management

Sistema de Gestão Empresarial e Produtividade — **CLOP Academia Digital, LDA** (Consultoria & Investimentos).

> CONFIANÇA. DISCIPLINA. LUCRO.

Plataforma interna de gestão para controlar funcionários, departamentos, tarefas, delegação, produtividade, relatórios (incluindo PDF), notificações, histórico e auditoria, com visão centralizada para a administração.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Frontend | React + TypeScript + Vite |
| Backend | FastAPI + Python |
| Banco de dados | MySQL |
| ORM | SQLAlchemy 2.0 |
| Migrações | Alembic |
| Autenticação | JWT (access + refresh) |
| Validação | Pydantic |
| PDF | ReportLab |
| Documentação API | Swagger (`/docs`) e Redoc (`/redoc`) |

## Arquitetura

```text
CEO
 ↓
CLOP FRONTEND (React + TS + Vite)
 ↓ REST
FastAPI (Auth + Business Logic)
 ↓
SQLAlchemy
 ↓
MySQL
```

## Estrutura do repositório

```text
CLOP/
│
├── frontend/          # React + TS + Vite
├── backend/           # FastAPI + SQLAlchemy + Alembic
├── docs/              # architecture.md, api.md, database.md
├── logo3.jpeg         # origem do logo-dark
├── logo4.jpeg         # origem do logo-light
├── docker-compose.yml
└── AGENTS.md          # especificação oficial do projeto
```

## Instalação

### Requisitos

- Node.js >= 20
- Python >= 3.12
- MySQL 8.0

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Configuração do MySQL

Criar a base de dados:

```sql
CREATE DATABASE IF NOT EXISTS clop
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Alternativa via Docker:

```bash
docker compose up -d mysql
```

## Variáveis de ambiente

Backend — `backend/.env` (ver `backend/.env.example`):

```env
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/clop
SECRET_KEY=change_this_secret
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:5173
SEED_ADMIN_EMAIL=admin@clop.academy
SEED_ADMIN_PASSWORD=ChangeMe_2026!
```

Frontend — `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api
```

Nunca colocar credenciais reais no código-fonte.

## Migrações (Alembic)

```bash
cd backend
venv\Scripts\activate

# Gerar nova migração a partir dos models
alembic revision --autogenerate -m "descrição"

# Aplicar migrações
alembic upgrade head
```

## Seed

Cria os departamentos base e o utilizador **CEO Admin** (credenciais via `.env`):

```bash
cd backend
venv\Scripts\activate
python seed.py
```

## Execução

### Backend

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Swagger em http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm run dev
```

Aplicação em http://localhost:5173 (o Vite faz proxy de `/api` para o backend).

## Testes

```bash
cd backend
venv\Scripts\activate
pytest
```

## API

Documentação completa em `docs/api.md`. Endpoints principais:

- `POST /api/auth/login` · `POST /api/auth/refresh` · `GET /api/auth/me`
- `GET|POST /api/users` · `PUT /api/users/{id}` · `PATCH /api/users/{id}/status`
- `GET|POST /api/departments` · `GET /api/departments/{id}/employees`
- `GET|POST /api/tasks` · submissão/aprovação/rejeição · histórico
- `GET /api/dashboard/{admin|department|employee}`
- `GET /api/productivity/...`
- `GET /api/reports/...` incluindo PDF

## Fases de desenvolvimento

1. Base — ✅ configurada
2. Autenticação (JWT, roles, protected routes)
3. Funcionários e Departamentos (CRUD)
4. Tarefas (ciclo completo + histórico)
5. Dashboards
6. Produtividade
7. Relatórios + PDF
8. Notificações
9. Auditoria
10. Polimento

## Deploy

- Backend: uvicorn/gunicorn atrás de um reverse proxy.
- Frontend: build estático (`npm run build`) servido por nginx/CDN.
- Banco: MySQL 8.0."# CLOP-ERP" 
