import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '../types/user'
import type { Department } from '../types/department'
import { listUsers, createUser, updateUser, updateUserStatus } from '../services/users'
import { listDepartments } from '../services/departments'
import Modal from '../components/ui/Modal'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/ui/StatusBadge'
import {
  DangerButton,
  EmptyState,
  ErrorState,
  FormField,
  GhostButton,
  LoadingState,
  PageHeader,
  PrimaryButton,
  inputStyle,
  selectStyle,
  tableStyle,
  tdStyle,
  thStyle,
} from '../components/ui/common'

const ROLE_LABELS: Record<string, string> = {
  CEO: 'Administrador',
  MANAGER: 'Chefe',
  EMPLOYEE: 'Funcionário',
}

const EMPTY_FORM = {
  nome_completo: '',
  email: '',
  password: '',
  telefone: '',
  cargo: '',
  departamento_id: '',
  role: 'EMPLOYEE',
  data_admissao: '',
}

export default function Employees() {
  const { user: authUser } = useAuth()
  const isCeo = authUser?.role === 'CEO'
  const isManager = authUser?.role === 'MANAGER'
  const canManage = isCeo || isManager

  const [items, setItems] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [users, depts] = await Promise.all([listUsers(query || undefined), listDepartments()])
      setItems(users)
      setDepartments(depts)
    } catch {
      setError('Não foi possível carregar os funcionários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (u) =>
        u.nome_completo.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.cargo ?? '').toLowerCase().includes(q),
    )
  }, [items, query])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      nome_completo: u.nome_completo,
      email: u.email,
      password: '',
      telefone: u.telefone ?? '',
      cargo: u.cargo ?? '',
      departamento_id: u.departamento_id ? String(u.departamento_id) : '',
      role: u.role,
      data_admissao: u.data_admissao ?? '',
    })
    setModalOpen(true)
  }

  const submit = async () => {
    setSaving(true)
    setFeedback('')
    try {
      const payload = {
        nome_completo: form.nome_completo,
        email: form.email,
        password: form.password,
        telefone: form.telefone || null,
        cargo: form.cargo || null,
        departamento_id: form.departamento_id ? Number(form.departamento_id) : null,
        role: form.role as User['role'],
        data_admissao: form.data_admissao || null,
      }
      if (editing) {
        const { password, ...rest } = payload as { password?: string } & typeof payload
        await updateUser(editing.id, password ? payload : rest)
      } else {
        await createUser(payload as never)
      }
      setModalOpen(false)
      void load()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFeedback(typeof detail === 'string' ? detail : 'Erro ao guardar funcionário.')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (u: User) => {
    const next = u.estado === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      await updateUserStatus(u.id, next)
      void load()
    } catch {
      setError('Não foi possível alterar o estado.')
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  const visible = canManage ? filtered : items.filter((u) => u.id === authUser?.id)

  return (
    <div>
      <PageHeader
        title="Funcionários"
        subtitle={canManage ? `Total: ${visible.length}` : 'A sua ficha'}
        actions={
          canManage ? (
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <input
                placeholder="Pesquisar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ ...inputStyle, minWidth: 200 }}
              />
              <PrimaryButton onClick={openCreate}>Novo funcionário</PrimaryButton>
            </div>
          ) : undefined
        }
      />

      {visible.length === 0 ? (
        <EmptyState message="Sem funcionários para apresentar." />
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Cargo</th>
                <th style={thStyle}>Departamento</th>
                <th style={thStyle}>Função</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const dept = departments.find((d) => d.id === u.departamento_id)
                return (
                  <tr key={u.id}>
                    <td style={tdStyle}>
                      <Link to={`/employees/${u.id}`} style={{ color: 'var(--clop-gold-light)', textDecoration: 'none' }}>
                        {u.nome_completo}
                      </Link>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{u.email}</td>
                    <td style={tdStyle}>{u.cargo || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{dept?.nome ?? '—'}</td>
                    <td style={tdStyle}>{ROLE_LABELS[u.role]}</td>
                    <td style={tdStyle}>
                      <StatusBadge value={u.estado} />
                    </td>
                    <td style={tdStyle}>
                      {canManage && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <GhostButton onClick={() => openEdit(u)}>Editar</GhostButton>
                          <DangerButton onClick={() => void toggleStatus(u)}>{u.estado === 'ACTIVE' ? 'Desativar' : 'Ativar'}</DangerButton>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar funcionário' : 'Novo funcionário'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
          <FormField label="Nome completo">
            <input style={inputStyle} value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
          </FormField>
          <FormField label="Email">
            <input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormField>
          {!editing && (
            <FormField label="Palavra-passe">
              <input style={inputStyle} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </FormField>
          )}
          <FormField label="Telefone">
            <input style={inputStyle} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </FormField>
          <FormField label="Cargo">
            <input style={inputStyle} value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
          </FormField>
          <FormField label="Função">
            <select
              style={selectStyle}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              disabled={!isCeo}
            >
              <option value="EMPLOYEE">Funcionário</option>
              <option value="MANAGER">Chefe</option>
              {isCeo && <option value="CEO">Administrador</option>}
            </select>
          </FormField>
          <FormField label="Departamento">
            <select style={selectStyle} value={form.departamento_id} onChange={(e) => setForm({ ...form, departamento_id: e.target.value })}>
              <option value="">Sem departamento</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Data de admissão">
            <input style={inputStyle} type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} />
          </FormField>
        </div>
        {feedback && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: '0.8rem 0 0' }}>{feedback}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
          <GhostButton onClick={() => setModalOpen(false)} disabled={saving}>
            Cancelar
          </GhostButton>
          <PrimaryButton onClick={() => void submit()} disabled={saving}>
            {saving ? 'A guardar…' : 'Guardar'}
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  )
}