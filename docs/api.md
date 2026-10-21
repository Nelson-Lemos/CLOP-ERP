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

## Trading

Módulo de diário de trading com evidências obrigatórias, preços obrigatórios e revisão do Líder de Produção (ADENDO 2).

### Checklists, conta e meses

| Rota | Descrição |
| --- | --- |
| `PUT /api/trading/checklists/{data}` | Gravar pré-trading diário |
| `POST /api/trading/checklists/{data}/close` | Fechar o dia |
| `POST /api/trading/checklists/{data}/reopen` | Reabrir o dia (CEO, com `operator_id`) |
| `GET /api/trading/account` · `PUT /api/trading/account` | Conta de trading |
| `GET /api/trading/months/{ano}/{mes}` · `PUT` | Resumo do mês (depósitos, saques, bónus) |
| `GET /api/trading/evolution` · `GET /api/trading/evolution/csv` | Evolução anual da conta |
| `GET /api/trading/summary` | Resumo do mês |

### Operações

| Rota | Descrição |
| --- | --- |
| `GET /api/trading/trades` | Lista (`operator_id` para CEO/Gestor/Líder) |
| `POST /api/trading/trades` | Criar operação (`PENDENTE`) |
| `PUT /api/trading/trades/{id}` | Atualizar estado, valor, preços, mindset, observações |
| `DELETE /api/trading/trades/{id}` | Apagar operação (administrador) |

**Regras de preços** (obrigatórios quando `TRADING_REQUIRE_PRECOS=true`): `preco_entrada`, `preco_stop`, `preco_alvo` no momento da criação. A coerência com a direção é validada:

- `COMPRA`: `preco_stop < preco_entrada < preco_alvo`;
- `VENDA`: `preco_alvo < preco_entrada < preco_stop`.

O `risco_retorno` (R:R) é calculado automaticamente.

**Transições bloqueadas sem evidência**: passar a `EM_ANDAMENTO` exige captura `ENTRADA`; fechar (`GANHOU`/`PERDEU`) exige capturas `ENTRADA` e `FECHO` e `preco_saida`.

### Evidências

| Rota | Descrição |
| --- | --- |
| `POST /api/trading/trades/{id}/evidences` | Carregar evidência (multipart: `tipo` + `file`) |
| `GET /api/trading/trades/{id}/evidences` | Listar evidências da operação |
| `GET /api/trading/evidences/{evidence_id}/file` | Descarregar a imagem (autenticado) |

- `tipo`: `ENTRADA` | `GESTAO` | `FECHO`.
- Formatos aceites: PNG, JPG, WEBP. Limite de tamanho em `TRADE_EVIDENCE_MAX_MB` (413 se excedido).
- Cada evidência guarda: carimbo temporal do servidor, `sha256`, tamanho e `uploader_id`.
- **Histórico só de adição**: não existem endpoints de eliminação/substituição.
- Alertas devolvidos na resposta: `alerta_hash_duplicado` (mesmo `sha256` noutra operação) e `alerta_upload_tardio` (carregada mais de 1 dia após `data_operacao`).

### Revisão do Líder de Produção (`TRADING_LEADER`)

| Rota | Permissão | Descrição |
| --- | --- | --- |
| `GET /api/trading/review-queue` | CEO / Gestor / Líder | Fila de operações a revisar |
| `POST /api/trading/trades/{id}/review` | CEO / Gestor / Líder | Decisão do líder |
| `POST /api/trading/trades/{id}/review/respond` | Operador | Resposta do operador |

- Filtros da fila: `operator_id`, `data_inicio`, `data_fim`, `revisao_estado`, `resultado`, `seguiu_plano`, `divergencia`, `sem_evidencia`, `ativo`, `limit`, `offset`.
- Decisões (`decision`): `APROVADA`, `INCONSISTENTE`, `CORRECAO_PEDIDA`. Campo `comentario` obrigatório (mín. 3 caracteres); `divergencia_plano` opcional.
- Estados de revisão: `NAO_REVISADA`, `APROVADA`, `INCONSISTENTE`, `CORRECAO_PEDIDA`.
- Só operações fechadas podem ser revistas. Cada decisão é registada no histórico (`revisoes`).
- Uma resposta do operador repõe o estado em `NAO_REVISADA`; alterar `estado`, `valor_finaneiro` ou `preco_*` também repõe a revisão.
- O operador é notificado (`TRADE_REVIEW`) em `CORRECAO_PEDIDA`/`INCONSISTENTE`; o líder é notificado quando o operador responde.

### Relatório mensal

| Rota | Descrição |
| --- | --- |
| `GET /api/trading/monthly-report` | JSON do relatório |
| `GET /api/trading/monthly-report/csv` | Exportação CSV |
| `GET /api/trading/monthly-report/pdf` | PDF (inclui miniaturas das capturas) |

Parâmetros: `ano`, `mes`, `operator_id` (CEO/Gestor/Líder), `apenas_validadas` (só operações aprovadas pelo líder), `incluir_evidencias` (JSON devolve o bloco `capturas`).

- Bloco `evidencia`: `total_fechadas`, `com_evidencia`, `sem_evidencia`, `pct_com_evidencia`, `aprovadas`, `pct_aprovadas`, `inconsistentes`, `correcoes_pedidas`, `nao_revisadas`, `divergencias_plano`.
- O JSON nunca expõe caminhos no servidor; o PDF embute as imagens das capturas.

## Auditoria

- `GET /api/audit` — logs (CEO).