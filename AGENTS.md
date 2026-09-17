# CLOP Management — Sistema de Gestão Empresarial e Produtividade

Este ficheiro é a especificação oficial do projeto. O OpenCode e qualquer agente devem usá-lo como fonte de verdade para arquitetura, regras de negócio, permissões, visual e convenções.

---

## 0. Identidade e marca

- **Empresa:** CLOP ACADEMIA DIGITAL, LDA
- **Área:** Consultoria & Investimentos
- **Produto:** CLOP Management
- **Slogan da marca:** CONFIANÇA. DISCIPLINA. LUCRO.
- **Subtítulo do produto:** Sistema de Gestão Empresarial e Produtividade

O produto **CLOP Management** é interno à empresa. A marca **CLOP Academia Digital, LDA** é a entidade proprietária. Não confundir as duas nos textos.

---

## 1. Objetivo do sistema

Plataforma interna de gestão empresarial para controlar:

- funcionários;
- departamentos;
- cargos;
- tarefas;
- delegação de tarefas;
- atividades diárias, semanais e mensais;
- acompanhamento de progresso;
- aprovação de tarefas;
- produtividade individual, departamental e geral;
- relatórios e geração de PDF;
- notificações;
- histórico de atividades;
- auditoria.

O sistema dá à administração da CLOP uma visão centralizada da execução das atividades da empresa.

---

## 2. Stack obrigatória

| Camada | Tecnologia |
| --- | --- |
| Frontend | React + TypeScript + Vite |
| Estilização | CSS puro/modular organizado por componentes |
| Backend | FastAPI + Python |
| Banco de dados | MySQL |
| ORM | SQLAlchemy |
| Migrações | Alembic |
| Autenticação | JWT (access + refresh) |
| Validação | Pydantic |
| API | REST |
| Documentação | Swagger/OpenAPI automática do FastAPI (`/docs`, `/redoc`) |
| PDF | geração no backend |

Arquitetura preparada para crescimento.

---

## 3. Perfis de utilizador

Existem três níveis principais.

### CEO / ADMIN

Acesso global.

- criar, editar e desativar funcionários;
- criar e editar departamentos;
- definir chefe de departamento;
- visualizar todos os departamentos e funcionários;
- criar, delegar, acompanhar, validar e rejeitar tarefas;
- visualizar produtividade;
- gerar relatórios e PDFs;
- consultar histórico e auditoria;
- visualizar dashboard geral.

### CHEFE DE DEPARTAMENTO

Acesso apenas ao próprio departamento.

- visualizar funcionários do departamento;
- criar, delegar, acompanhar, atualizar, validar e rejeitar tarefas;
- visualizar produtividade do departamento e dos seus funcionários;
- gerar relatório do departamento;
- consultar histórico do departamento.

**Não pode:**

- administrar outros departamentos;
- criar administradores;
- visualizar dados administrativos restritos de outros departamentos.

### FUNCIONÁRIO

Acesso apenas às próprias informações e tarefas.

- visualizar tarefas atribuídas;
- aceitar/iniciar tarefas;
- atualizar progresso;
- submeter tarefas;
- adicionar observações;
- anexar evidências;
- visualizar tarefas concluídas e pendentes;
- visualizar histórico pessoal;
- visualizar a própria produtividade;
- receber notificações.

**Não pode:**

- criar funcionários ou departamentos;
- delegar tarefas;
- visualizar produtividade privada de outros funcionários;
- acessar administração.

---

## 4. Estrutura principal do sistema

```text
CLOP
│
├── Dashboard
├── Funcionários
├── Departamentos
├── Tarefas
├── Atividades
├── Produtividade
├── Relatórios
├── Notificações
├── Auditoria
└── Configurações
```

O menu varia conforme o papel do utilizador.

---

## 5. Dashboard CEO

Apresenta os totais globais e gráficos.

```text
CLOP MANAGEMENT

Funcionários   32
Departamentos  6
Tarefas hoje   48
Concluídas     37
Pendentes      8
Atrasadas      3
```

Gráficos:

- **Produtividade geral**: evolução por mês (Janeiro, Fevereiro, Março, ...).
- **Produtividade por departamento**: Trading, Tecnologia, Marketing, Financeiro, RH, Operações.
- **Estado das tarefas**: Concluídas, Em andamento, Pendentes, Atrasadas, Rejeitadas.
- **Tabela de funcionários**: nome, departamento, tarefas concluídas, pendentes, atrasadas, taxa de conclusão.

## 6. Dashboard do chefe

Apenas o seu departamento.

```text
Departamento: Tecnologia
Funcionários: 8

Concluídas: 35
Em andamento: 8
Pendentes: 5
Atrasadas: 2
```

Tabela de indicadores operacionais (sem linguagem competitiva):

```text
Funcionário | Tarefas atribuídas | Concluídas | Pendentes | Atrasadas | Taxa de conclusão
```

## 7. Dashboard do funcionário

```text
Olá, Nelson

Minhas tarefas hoje  5
Concluídas           3
Em andamento         1
Pendentes            1
```

Cards: tarefas de hoje, desta semana, deste mês, atrasadas.

---

## 8. Departamentos

Tabela: ID, Nome, Descrição, Chefe, Funcionários, Estado, Data de criação, Ações.

Operações: Criar, Editar, Visualizar, Desativar.

## 9. Funcionários

Campos:

```text
id
nome_completo
email
telefone
cargo
departamento_id
role
data_admissao
foto
estado
created_at
updated_at
```

Estados: `ACTIVE`, `INACTIVE`, `SUSPENDED`.

**Não apagar funcionários fisicamente.** Usar desativação lógica (soft delete).

---

## 10. Tarefas

A entidade mais importante do sistema.

```text
id
titulo
descricao
tipo
prioridade
status
created_by
assigned_to
department_id
start_date
deadline
completed_at
created_at
updated_at
```

### Tipo

```text
DAILY
WEEKLY
MONTHLY
NORMAL
```

### Prioridade

```text
LOW      = peso 1
MEDIUM   = peso 2
HIGH     = peso 3
CRITICAL = peso 4
```

A pontuação deve ser configurável no futuro.

### Status

```text
PENDING
IN_PROGRESS
SUBMITTED
UNDER_REVIEW
COMPLETED
REJECTED
OVERDUE
CANCELLED
```

---

## 11. Fluxo de uma tarefa

### Normal

```text
Criada → Atribuída → Pendente → Em andamento → Submetida → Em revisão → Concluída
```

### Rejeitada

```text
Submetida → Em revisão → Rejeitada → Em andamento
```

### Atrasada

```text
Pendente / Em andamento → Atrasada
```

O sistema deve identificar e atualizar automaticamente tarefas atrasadas (job/schedulação no backend).

---

## 12. Delegação

```text
CEO → Funcionário
CEO → Departamento → Funcionário
Chefe → Funcionário do próprio departamento
```

**Regra de negócio no backend:** um chefe somente pode atribuir tarefas a funcionários do seu departamento. Esta regra **não pode depender apenas do frontend** — deve ser validada obrigatoriamente no FastAPI.

---

## 13. Submissão de atividade

Formulário de submissão:

```text
Tarefa: Desenvolver módulo de autenticação
Progresso: 100%
Descrição: Implementei login, logout, JWT e recuperação de senha.
Evidência: arquivo/documento
Observações: ...
```

Após `SUBMETER`, a tarefa passa a `UNDER_REVIEW`.

## 14. Validação

- **Aprovar** → `COMPLETED`
- **Rejeitar** → `REJECTED` (obrigatório fornecer **motivo da rejeição**)

O funcionário recebe notificação em ambos os casos.

## 15. Histórico da tarefa

Cada alteração fica registrada (tabela `task_history`).

```text
10:00 — Tarefa criada
10:02 — Atribuída a João
11:30 — João iniciou tarefa
14:20 — Progresso atualizado para 70%
16:00 — Tarefa submetida
16:30 — Chefe aprovou
```

---

## 16. Produtividade

Não calcular produtividade apenas pelo número de tarefas.

Indicadores:

```text
total_tasks
completed_tasks
pending_tasks
overdue_tasks
rejected_tasks
completion_rate
on_time_rate
average_completion_time
```

Fórmulas:

```text
completion_rate = completed_tasks / total_tasks × 100
on_time_rate    = tasks_completed_on_time / completed_tasks × 100
```

Pontuação por pesos (configurável no futuro):

```text
LOW=1  MEDIUM=2  HIGH=3  CRITICAL=4
```

**Importante:** a produtividade é apresentada como indicadores operacionais. Não se deve inferir automaticamente conclusões sobre a qualidade global de uma pessoa.

---

## 17. Relatórios

Relatórios:

```text
Relatório diário
Relatório semanal
Relatório mensal
Relatório individual
Relatório departamental
Relatório geral da empresa
```

Filtros: data inicial, data final, departamento, funcionário, tipo de tarefa, status, prioridade.

## 18. PDF

O backend gera PDFs (ex.: `reportlab` ou equivalente). Incluir: período, totais, taxa de conclusão, desagregação por departamento, data de geração. Adicionar gráficos quando possível.

---

## 19. Notificações

Tipos:

```text
Nova tarefa atribuída
Prazo próximo
Tarefa atrasada
Tarefa submetida
Tarefa aprovada
Tarefa rejeitada
Nova mensagem administrativa
```

Tabela `notifications`:

```text
id
user_id
title
message
type
is_read
created_at
```

## 20. Auditoria

Registrar as ações:

```text
LOGIN
CREATE_USER
UPDATE_USER
CREATE_TASK
UPDATE_TASK
DELETE_TASK
ASSIGN_TASK
SUBMIT_TASK
APPROVE_TASK
REJECT_TASK
CREATE_DEPARTMENT
UPDATE_DEPARTMENT
```

Tabela `audit_logs`:

```text
id
user_id
action
entity
entity_id
ip_address
user_agent
created_at
```

---

## 21. Bases de dados

Tabelas:

```text
users
departments
tasks
task_updates
task_reviews
task_history
activity_reports
attachments
notifications
audit_logs
```

Relacionamentos:

```text
users
   ├── department
   ├── tasks assigned
   ├── tasks created
   ├── notifications
   └── audit logs

departments
   ├── manager
   ├── employees
   └── tasks

tasks
   ├── creator
   ├── employee
   ├── department
   ├── updates
   ├── reviews
   ├── history
   └── attachments
```

---

## 22. Backend FastAPI

```text
backend/
│
├── app/
│   ├── main.py
│   │
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── database.py
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── department.py
│   │   ├── task.py
│   │   ├── notification.py
│   │   ├── audit.py
│   │   └── attachment.py
│   │
│   ├── schemas/
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── department.py
│   │   ├── task.py
│   │   ├── report.py
│   │   └── notification.py
│   │
│   ├── routers/
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── departments.py
│   │   ├── tasks.py
│   │   ├── reports.py
│   │   ├── dashboard.py
│   │   ├── notifications.py
│   │   └── audit.py
│   │
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── task_service.py
│   │   ├── productivity_service.py
│   │   ├── report_service.py
│   │   └── notification_service.py
│   │
│   └── dependencies/
│       ├── auth.py
│       └── permissions.py
│
├── migrations/
├── tests/
├── .env
├── requirements.txt
└── alembic.ini
```

---

## 23. API

### Auth

```http
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/me
```

### Users

```http
GET    /api/users
POST   /api/users
GET    /api/users/{id}
PUT    /api/users/{id}
PATCH  /api/users/{id}/status
```

### Departments

```http
GET    /api/departments
POST   /api/departments
GET    /api/departments/{id}
PUT    /api/departments/{id}
GET    /api/departments/{id}/employees
```

### Tasks

```http
GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/{id}
PUT    /api/tasks/{id}
PATCH  /api/tasks/{id}/status
PATCH  /api/tasks/{id}/progress
POST   /api/tasks/{id}/submit
POST   /api/tasks/{id}/approve
POST   /api/tasks/{id}/reject
GET    /api/tasks/{id}/history
```

### Dashboard / Productivity

```http
GET /api/dashboard/admin
GET /api/dashboard/department
GET /api/dashboard/employee

GET /api/productivity/company
GET /api/productivity/departments
GET /api/productivity/employees/{id}
```

### Reports

```http
GET /api/reports/daily
GET /api/reports/weekly
GET /api/reports/monthly
GET /api/reports/employee/{id}
GET /api/reports/department/{id}
GET /api/reports/company

GET /api/reports/monthly/pdf
GET /api/reports/employee/{id}/pdf
GET /api/reports/department/{id}/pdf
```

---

## 24. Frontend

```text
frontend/
│
├── src/
│   ├── assets/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── tasks/
│   │   ├── users/
│   │   └── reports/
│   │
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Employees.tsx
│   │   ├── EmployeeDetails.tsx
│   │   ├── Departments.tsx
│   │   ├── DepartmentDetails.tsx
│   │   ├── Tasks.tsx
│   │   ├── TaskDetails.tsx
│   │   ├── Reports.tsx
│   │   ├── Notifications.tsx
│   │   └── Settings.tsx
│   │
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── departments.ts
│   │   ├── tasks.ts
│   │   └── reports.ts
│   │
│   ├── hooks/
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── types/
│   │   ├── user.ts
│   │   ├── task.ts
│   │   ├── department.ts
│   │   └── report.ts
│   ├── routes/
│   │   └── AppRoutes.tsx
│   └── styles/
│       ├── global.css
│       ├── variables.css
│       └── utilities.css
│
├── .env
├── package.json
└── vite.config.ts
```

Layout: sidebar escura + topbar + área de conteúdo. Responsivo (desktop, tablet, smartphone). No mobile: sidebar vira drawer, tabelas viram cards/scroll horizontal, dashboards empilham, formulários em uma coluna.

---

## 25. Segurança

Obrigatório:

- password hashing com Argon2 ou bcrypt;
- JWT + refresh token;
- autorização baseada em roles;
- validação Pydantic;
- proteção de endpoints;
- CORS configurado;
- variáveis sensíveis no `.env`;
- nunca colocar passwords no frontend;
- nunca guardar password em texto;
- validação de uploads (limite de tamanho e extensões);
- auditoria;
- soft delete;
- tratamento correto de erros;
- tarefas atrasadas atualizadas automaticamente;
- funcionário desativado não autentica.

**O frontend nunca é uma camada de segurança. Toda a autorização é validada no FastAPI.**

### `.env` backend

```env
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/clop
SECRET_KEY=change_this_secret
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

Credenciais nunca em código-fonte.

---

## 26. Seed inicial

Criar `seed.py`:

- criar utilizador **CEO Admin** com credenciais definidas via variáveis de ambiente (nunca passwords hardcoded);
- criar departamentos de teste: Tecnologia, Trading, Financeiro, Marketing, Recursos Humanos, Operações.

---

## 27. Regras importantes

1. Funcionário só vê as próprias tarefas.
2. Chefe só gere funcionários do seu departamento.
3. Chefe só delega tarefas dentro do próprio departamento.
4. CEO/Admin tem acesso global.
5. Funcionário **não** pode mudar status para `COMPLETED` diretamente — submete e o responsável valida.
6. Toda aprovação/rejeição fica registada.
7. Tarefas atrasadas identificadas automaticamente.
8. Funcionários desativados não autenticam.
9. Nunca apagar histórico de tarefas.
10. Toda operação administrativa importante gera `audit_log`.

---

## 28. UX

Interface empresarial, limpa e profissional. Evitar excesso de animações, cores ou informação. Usar cards, tabelas, filtros, pesquisa, paginação, modais, badges de status, indicadores, gráficos, breadcrumbs, feedback de sucesso/erro, loading states e empty states.

Responsividade: o funcionário deve conseguir consultar e submeter tarefas pelo telefone.

---

## 29. Identidade visual oficial

Visual: **Dark Corporate Financial UI** — Black + Gold + Corporate + Financial + Technology.

- Preto → fundo, profundidade.
- Dourado → identidade e destaque (não usar em tudo).
- Branco → legibilidade.
- Azul escuro → textos secundários.
- Verde/vermelho → estados e indicadores (mercado/trading).

### Paleta (variavel CSS centralizada)

```css
:root {
  --clop-black: #050505;
  --clop-black-soft: #0d0d0d;

  --clop-gold: #d4a72c;
  --clop-gold-light: #f2c94c;
  --clop-gold-dark: #9c7414;

  --clop-white: #ffffff;
  --clop-gray: #a1a1aa;
  --clop-gray-dark: #27272a;

  --clop-blue: #172b4d;

  --success: #16a34a;
  --danger: #dc2626;
  --warning: #eab308;
}
```

### Logos

Ficheiros de origem na raiz do repositório:

```text
logo3.jpeg
logo4.jpeg
```

- **logo-dark** (fonte: `logo3.jpeg`): para fundo preto (sidebar, login, tema escuro).
- **logo-light** (fonte: `logo4.jpeg`): para fundo claro (login em modo claro, apresentações).

Copiar para o frontend:

```text
frontend/public/branding/logo-dark.jpeg
frontend/public/branding/logo-light.jpeg
```

Mapeamento confirmado: `logo3.jpeg` → `logo-dark`, `logo4.jpeg` → `logo-light`. Não modificar proporções, símbolo, tipografia, cores ou composição original. Não criar substitutos do logotipo oficial.

### Sidebar

```css
background: var(--clop-black);   /* logo no topo */
```

Item ativo:

```css
background: rgba(212, 167, 44, 0.12);
border-left: 3px solid var(--clop-gold);
color: var(--clop-gold-light);
```

### Cards

```css
background: #0d0d0d;
border: 1px solid rgba(212, 167, 44, 0.15);
border-radius: 12px;
```

Destaques em dourado (ex.: título "TAREFAS CONCLUÍDAS", valor grande, variação).

### Status das tarefas

```text
CONCLUÍDA       → verde   (--success)
EM ANDAMENTO    → azul    (--clop-blue / azul claro)
PENDENTE        → amarelo (--warning)
ATRASADA        → vermelho(--danger)
REJEITADA       → vermelho(--danger)
EM REVISÃO      → dourado (--clop-gold)
CANCELADA       → cinza   (--clop-gray)
```

### Login

Fundo preto, logo no topo, subtítulo "CLOP MANAGEMENT SYSTEM", botão principal:

```css
background: var(--clop-gold);
color: #050505;
```

Hover:

```css
background: var(--clop-gold-light);
```

Rodapé da página: "CLOP Academia Digital, LDA".

### Dashboard / trading look

Podem existir elementos visuais inspirados em plataformas financeiras (linhas/sparklines, indicadores: DISCIPLINA, EXECUÇÃO, CUMPRIMENTO, EFICIÊNCIA), mas representam **gestão empresarial**, não rentabilidade financeira.

### Regra visual

Não transformar o sistema num "site cheio de dourado". Referência: Black + Gold + Corporate + Financial + Technology.

---

## 30. Testes (backend)

```text
tests/
├── test_auth.py
├── test_users.py
├── test_departments.py
├── test_tasks.py
├── test_permissions.py
├── test_productivity.py
└── test_reports.py
```

Cenários obrigatórios:

- CEO consegue tudo?
- Chefe acede apenas ao seu departamento?
- Funcionário acede somente às suas tarefas?
- Funcionário consegue aprovar a própria tarefa? (deve falhar)
- Usuário desativado consegue fazer login? (deve falhar)
- Usuário sem permissão acede a endpoint protegido? (deve falhar)

---

## 31. Documentação

- `README.md` — descrição, tecnologias, arquitetura, instalação, configuração MySQL, variáveis de ambiente, migrações, seed, execução backend/frontend, testes, API, deploy.
- `docs/architecture.md`, `docs/api.md`, `docs/database.md`.
- FastAPI disponibiliza `/docs` e `/redoc`.

---

## 32. Fases de desenvolvimento

1. **FASE 1 — Base**: Vite, React, TypeScript, FastAPI, MySQL, SQLAlchemy, Alembic. Configuração.
2. **FASE 2 — Autenticação**: login, JWT, refresh, me, logout, roles, protected routes.
3. **FASE 3 — Funcionários**: CRUD funcionários, departamentos, cargos, ativação/desativação.
4. **FASE 4 — Tarefas**: criar, delegar, visualizar, atualizar, submeter, aprovar, rejeitar, histórico.
5. **FASE 5 — Dashboards**: CEO, chefe, funcionário.
6. **FASE 6 — Produtividade**: métricas, taxas, atrasos, conclusões, indicadores por período.
7. **FASE 7 — Relatórios**: diário, semanal, mensal, individual, departamento, empresa + PDF.
8. **FASE 8 — Notificações**: nova tarefa, prazo, atraso, submissão, aprovação, rejeição.
9. **FASE 9 — Auditoria**: logs, histórico, ações administrativas.
10. **FASE 10 — Polimento**: responsividade, segurança, permissões, performance, erros, UX, PDF, banco, API.

---

## 33. Regras de implementação para o OpenCode

- Não gerar projeto fictício apenas com interfaces.
- Implementar de facto: Frontend → REST API → FastAPI → SQLAlchemy → MySQL.
- Não usar dados mockados como solução definitiva (apenas temporários durante desenvolvimento).
- Não colocar toda a lógica nos componentes React.
- Não colocar regras de autorização somente no frontend.
- Não duplicar código desnecessariamente.
- Criar componentes reutilizáveis.
- Criar services para comunicação com a API.
- Criar schemas Pydantic.
- Criar models SQLAlchemy.
- Criar migrations Alembic.
- Criar tratamento global de erros.
- Criar loading/error/empty states.
- Manter TypeScript sem `any` desnecessário.
- Manter código organizado e escalável.

---

## 34. Estrutura final do repositório

```text
CLOP/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   ├── migrations/
│   ├── tests/
│   ├── requirements.txt
│   └── alembic.ini
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── database.md
│
├── .gitignore
├── README.md
└── docker-compose.yml
```

### Arquitetura resumida

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

---

## 35. Convenções gerais de trabalho

- Idioma das interfaces e do código: **português** (texto visível em PT, identificadores em inglês).
- Não adicionar comentários sem necessidade.
- Rodar testes/lint do backend e typecheck/build do frontend sempre que fizer alterações.
- Nunca commitar secrets.
- Sempre validar permissões no backend, nunca apenas no frontend.