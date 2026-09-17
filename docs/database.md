# Base de dados

Banco: MySQL 8.0, charset `utf8mb4`, collation `utf8mb4_unicode_ci`.

Migrações geridas por Alembic. Não criar/alterar tabelas manualmente fora de migrações.

## Tabelas

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

## Relacionamentos

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

## users

| Campo | Tipo | Notas |
| --- | --- | --- |
| id | int PK | autoincrement |
| nome_completo | varchar(120) | obrigatório |
| email | varchar(255) | unique, index |
| telefone | varchar(30) | |
| password_hash | varchar(255) | bcrypt |
| cargo | varchar(100) | |
| departamento_id | int FK → departments | |
| role | varchar(20) | CEO / MANAGER / EMPLOYEE |
| data_admissao | date | |
| foto | varchar(255) | |
| estado | varchar(20) | ACTIVE / INACTIVE / SUSPENDED |
| created_at / updated_at | datetime | auto |

## departments

| Campo | Tipo | Notas |
| --- | --- | --- |
| id | int PK | |
| nome | varchar(120) | unique |
| descricao | text | |
| manager_id | int FK → users | use_alter (ciclo users↔departments) |
| estado | varchar(20) | ACTIVE / INACTIVE |
| created_at / updated_at | datetime | auto |

## tasks

| Campo | Tipo | Notas |
| --- | --- | --- |
| id | int PK | |
| titulo | varchar(200) | obrigatório |
| descricao | text | |
| tipo | varchar(20) | DAILY / WEEKLY / MONTHLY / NORMAL |
| prioridade | varchar(20) | LOW / MEDIUM / HIGH / CRITICAL |
| status | varchar(20) | PENDING / IN_PROGRESS / SUBMITTED / UNDER_REVIEW / COMPLETED / REJECTED / OVERDUE / CANCELLED |
| progress | int | 0–100 |
| created_by | int FK → users | |
| assigned_to | int FK → users | |
| department_id | int FK → departments | |
| start_date | datetime | |
| deadline | datetime | index |
| completed_at | datetime | |
| created_at / updated_at | datetime | auto |

## task_updates

Atualizações de progresso (`task_id`, `user_id`, `progress`, `descricao`, `created_at`).

## task_reviews

Aprovações/Rejeições (`task_id`, `reviewed_by`, `decision`, `motivo`, `created_at`).

## task_history

Histórico imutável (`task_id`, `user_id`, `action`, `description`, `created_at`). **Nunca apagar.**

## activity_reports

Submissões de atividade (`user_id`, `task_id`, `descricao`, `progresso`, `created_at`).

## attachments

Evidências (`task_id`, `user_id`, `filename`, `file_path`, `content_type`, `size`, `created_at`).

## notifications

(`user_id`, `title`, `message`, `type`, `is_read`, `created_at`).

## audit_logs

(`user_id`, `action`, `entity`, `entity_id`, `ip_address`, `user_agent`, `created_at`).

## Comandos Alembic

```bash
cd backend
venv\Scripts\activate

alembic revision --autogenerate -m "descrição"
alembic upgrade head
alembic downgrade -1
alembic history
```