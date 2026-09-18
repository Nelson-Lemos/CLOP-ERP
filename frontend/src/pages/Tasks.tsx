import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TaskDetail, TaskPriority, TaskStatus, TaskType } from '../types/task'
import type { User } from '../types/user'
import type { Department } from '../types/department'
import { createTask, listTasks, submitTask, updateTask, updateTaskStatus } from '../services/tasks'
import { listUsers } from '../services/users'
import { listDepartments } from '../services/departments'
import Modal from '../components/ui/Modal'
import StatusBadge from '../components/ui/StatusBadge'
import { useAuth } from '../hooks/useAuth'
import {
  EmptyState,
  ErrorState,
  FormField,
  GhostButton,
  LoadingState,
  PageHeader,
  PrimaryButton,
  ProgressBar,
  inputStyle,
  selectStyle,
  tableStyle,
  tdStyle,
  thStyle,
} from '../components/ui/common'

const TIPO_LABELS: Record<string, string> = { DAILY: 'Diária', WEEKLY: 'Semanal', MONTHLY: 'Mensal', NORMAL: 'Normal' }
const PRIO_COLORS: Record<string, string> = { LOW: 'var(--clop-gray)', MEDIUM: '#4f86f7', HIGH: 'var(--warning)', CRITICAL: 'var(--danger)' }

const EMPTY_FORM = {
  titulo: '',
  descricao: '',
  tipo: 'NORMAL',
  prioridade: 'MEDIUM',
  department_id: '',
  assigned_to: '',
  start_date: '',
  deadline: '',
}

export default function Tasks({ autoNew = false }: { autoNew?: boolean }) {
  const { user: authUser } = useAuth()
  const canCreate = authUser?.role !== 'EMPLOYEE'

  const [items, setItems] = useState<TaskDetail[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [filters, setFilters] = useState({ status: '', tipo: '', prioridade: '', q: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TaskDetail | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [submitItem, setSubmitItem] = useState<TaskDetail | null>(null)
  const [submitForm, setSubmitForm] = useState<{ progress: number; descricao: string }>({ progress: 0, descricao: '' })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const isEmployee = authUser?.role === 'EMPLOYEE'
      const [tasks, depts, usrs] = await Promise.all([
        listTasks(buildFilter()),
        isEmployee ? Promise.resolve([]) : listDepartments(),
        isEmployee ? Promise.resolve([]) : listUsers(),
      ])
      setItems(tasks)
      setDepartments(depts)
      setUsers(usrs)
    } catch {
      setError('Não foi possível carregar as tarefas.')
    } finally {
      setLoading(false)
    }
  }

  const buildFilter = () => {
    const f: Record<string, string> = {}
    if (filters.status) f.status = filters.status
    if (filters.tipo) f.tipo = filters.tipo
    if (filters.prioridade) f.prioridade = filters.prioridade
    if (filters.q) f.q = filters.q
    return f
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (autoNew && canCreate) openCreate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNew, canCreate])

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    if (!q) return items
    return items.filter((t) => t.titulo.toLowerCase().includes(q) || (t.descricao ?? '').toLowerCase().includes(q))
  }, [items, filters.q])

  const assignables = useMemo(() => {
    if (!authUser) return []
    const base = users.filter((u) => u.estado === 'ACTIVE' && u.role !== 'CEO')
    if (authUser.role === 'MANAGER' && authUser.departamento_id) {
      return base.filter((u) => u.departamento_id === authUser.departamento_id)
    }
    return base
  }, [users, authUser])

  const assigneeGroups = useMemo(() => {
    const deptNames = new Map(departments.map((d) => [d.id, d.nome]))
    const groups: Record<string, User[]> = {}
    for (const u of assignables) {
      const key = u.departamento_id ? (deptNames.get(u.departamento_id) ?? 'Sem departamento') : 'Sem departamento'
      ;(groups[key] ??= []).push(u)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [assignables, departments])

  const openCreate = () => {
    setEditingItem(null)
    setForm({ ...EMPTY_FORM, department_id: authUser?.role === 'MANAGER' && authUser.departamento_id ? String(authUser.departamento_id) : '' })
    setFeedback('')
    setModalOpen(true)
  }

  const toLocalInput = (iso: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const openEdit = (t: TaskDetail) => {
    setEditingItem(t)
    setForm({
      titulo: t.titulo,
      descricao: t.descricao ?? '',
      tipo: t.tipo,
      prioridade: t.prioridade,
      department_id: t.department_id != null ? String(t.department_id) : '',
      assigned_to: t.assigned_to != null ? String(t.assigned_to) : '',
      start_date: toLocalInput(t.start_date),
      deadline: toLocalInput(t.deadline),
    })
    setFeedback('')
    setModalOpen(true)
  }

  const payloadFromForm = () => ({
    titulo: form.titulo,
    descricao: form.descricao || null,
    tipo: form.tipo as TaskType,
    prioridade: form.prioridade as TaskPriority,
    department_id: form.department_id ? Number(form.department_id) : null,
    assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
    start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
    deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
  })

  const submit = async () => {
    setSaving(true)
    setFeedback('')
    try {
      if (editingItem) {
        await updateTask(editingItem.id, payloadFromForm())
      } else {
        await createTask(payloadFromForm())
      }
      setModalOpen(false)
      setEditingItem(null)
      void load()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFeedback(typeof detail === 'string' ? detail : editingItem ? 'Erro ao atualizar tarefa.' : 'Erro ao criar tarefa.')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = (t: TaskDetail) =>
    t.assigned_to === authUser?.id && ['IN_PROGRESS', 'REJECTED'].includes(t.status)

  const canAccept = (t: TaskDetail) =>
    t.assigned_to === authUser?.id && ['PENDING', 'OVERDUE'].includes(t.status)

  const changeStatus = async (taskId: number, status: TaskStatus) => {
    setActionError('')
    try {
      await updateTaskStatus(taskId, status)
      void load()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionError(typeof detail === 'string' ? detail : 'Não foi possível atualizar a tarefa.')
    }
  }

  const doSubmit = async () => {
    if (!submitItem) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitTask(submitItem.id, { progress: submitForm.progress, descricao: submitForm.descricao })
      setSubmitItem(null)
      void load()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSubmitError(typeof detail === 'string' ? detail : 'Não foi possível submeter a tarefa.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader
        title={autoNew ? 'Delegar Tarefa' : 'Tarefas'}
        subtitle={`Total: ${visible.length}`}
        actions={
          canCreate ? (
            <>
              <PrimaryButton onClick={openCreate}>Nova tarefa</PrimaryButton>
            </>
          ) : undefined
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
        <input
          placeholder="Pesquisar…"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          style={{ ...inputStyle, minWidth: 180 }}
        />
        <select style={selectStyle} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Todos os estados</option>
          <option value="PENDING">Pendente</option>
          <option value="IN_PROGRESS">Em andamento</option>
          <option value="SUBMITTED">Submetida</option>
          <option value="UNDER_REVIEW">Em revisão</option>
          <option value="COMPLETED">Concluída</option>
          <option value="REJECTED">Rejeitada</option>
          <option value="OVERDUE">Atrasada</option>
          <option value="DECLINED">Recusada</option>
        </select>
        <select style={selectStyle} value={filters.tipo} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select style={selectStyle} value={filters.prioridade} onChange={(e) => setFilters({ ...filters, prioridade: e.target.value })}>
          <option value="">Todas as prioridades</option>
          <option value="LOW">Baixa</option>
          <option value="MEDIUM">Média</option>
          <option value="HIGH">Alta</option>
          <option value="CRITICAL">Crítica</option>
        </select>
        <GhostButton onClick={() => setFilters({ status: '', tipo: '', prioridade: '', q: '' })}>Limpar</GhostButton>
      </div>

      {actionError && (
        <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '0.9rem', color: 'var(--danger)', fontSize: '0.82rem' }}>
          {actionError}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState message="Sem tarefas para apresentar." />
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Tarefa</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Prioridade</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Progresso</th>
                <th style={thStyle}>Atribuída a</th>
                <th style={thStyle}>Prazo</th>
                <th style={thStyle}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id}>
                  <td style={{ ...tdStyle, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Link to={`/tasks/${t.id}`} style={{ color: 'var(--clop-gold-light)', textDecoration: 'none' }}>
                      {t.titulo}
                    </Link>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{TIPO_LABELS[t.tipo] ?? t.tipo}</td>
                  <td style={{ ...tdStyle, color: PRIO_COLORS[t.prioridade], fontWeight: 600 }}>{t.prioridade}</td>
                  <td style={tdStyle}>
                    <StatusBadge value={t.status} />
                  </td>
                  <td style={{ ...tdStyle, minWidth: 110 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ProgressBar value={t.progress} />
                      <span style={{ fontSize: '0.72rem', color: 'var(--clop-gray)' }}>{t.progress}%</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{t.assigned_to_nome ?? '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>
                    {t.deadline ? new Date(t.deadline).toLocaleDateString('pt-PT') : '—'}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {authUser?.role !== 'EMPLOYEE' ? (
                      <GhostButton onClick={() => openEdit(t)}>Editar</GhostButton>
                    ) : canAccept(t) ? (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <GhostButton onClick={() => void changeStatus(t.id, 'IN_PROGRESS')}>Aceitar</GhostButton>
                        <GhostButton onClick={() => void changeStatus(t.id, 'DECLINED')}>Recusar</GhostButton>
                      </div>
                    ) : canSubmit(t) ? (
                      <GhostButton
                        onClick={() => {
                          setSubmitItem(t)
                          setSubmitForm({ progress: t.progress ?? 0, descricao: '' })
                          setSubmitError('')
                        }}
                      >
                        Submeter
                      </GhostButton>
                    ) : (
                      <span style={{ color: 'var(--clop-gray)', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingItem(null)
        }}
        title={editingItem ? 'Editar tarefa' : autoNew ? 'Delegar tarefa' : 'Nova tarefa'}
        width={620}
      >
        {autoNew && !editingItem && (
          <p style={{ color: 'var(--clop-gray)', fontSize: '0.82rem', margin: '0 0 0.9rem' }}>
            Atribuir tarefa a um funcionário do seu departamento. O funcionário recebe uma notificação.
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Título">
              <input style={inputStyle} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </FormField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Descrição">
              <textarea style={inputStyle} rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Tipo">
            <select style={selectStyle} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Prioridade">
            <select style={selectStyle} value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </select>
          </FormField>
          {authUser?.role !== 'EMPLOYEE' && (
            <FormField label="Departamento">
              <select
                style={selectStyle}
                value={form.department_id}
                onChange={(e) => {
                  setForm({ ...form, department_id: e.target.value, assigned_to: '' })
                }}
              >
                <option value="">Sem departamento</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Atribuída a">
            <select style={selectStyle} value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Selecionar funcionário…</option>
              {assigneeGroups.map(([deptName, us]) => (
                <optgroup key={deptName} label={deptName}>
                  {us.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome_completo}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </FormField>
          <FormField label="Data de início">
            <input style={inputStyle} type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </FormField>
          <FormField label="Prazo">
            <input style={inputStyle} type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </FormField>
        </div>
        {feedback && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '0.8rem 0 0' }}>{feedback}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
          <GhostButton
            onClick={() => {
              setModalOpen(false)
              setEditingItem(null)
            }}
            disabled={saving}
          >
            Cancelar
          </GhostButton>
          <PrimaryButton onClick={() => void submit()} disabled={saving}>
            {saving ? 'A guardar…' : editingItem ? 'Guardar alterações' : 'Criar tarefa'}
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={submitItem !== null}
        onClose={() => setSubmitItem(null)}
        title="Submeter atividade"
        width={480}
      >
        {submitItem && (
          <>
            <p style={{ color: 'var(--clop-white)', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 1rem' }}>
              {submitItem.titulo}
            </p>
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <FormField label="Progresso">
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  max={100}
                  value={submitForm.progress}
                  onChange={(e) => setSubmitForm({ ...submitForm, progress: Number(e.target.value) })}
                />
              </FormField>
              <FormField label="Descrição">
                <textarea
                  style={inputStyle}
                  rows={4}
                  value={submitForm.descricao}
                  onChange={(e) => setSubmitForm({ ...submitForm, descricao: e.target.value })}
                  placeholder="O que foi feito…"
                />
              </FormField>
            </div>
            {submitError && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '0.8rem 0 0' }}>{submitError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
              <GhostButton onClick={() => setSubmitItem(null)} disabled={submitting}>
                Cancelar
              </GhostButton>
              <PrimaryButton onClick={() => void doSubmit()} disabled={submitting}>
                {submitting ? 'A submeter…' : 'Submeter'}
              </PrimaryButton>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}