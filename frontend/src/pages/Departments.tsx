import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Department } from '../types/department'
import type { User } from '../types/user'
import { listDepartments, createDepartment, updateDepartment } from '../services/departments'
import { listUsers } from '../services/users'
import { useAuth } from '../hooks/useAuth'
import Modal from '../components/ui/Modal'
import StatusBadge from '../components/ui/StatusBadge'
import {
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

const EMPTY_FORM = { nome: '', descricao: '', manager_id: '' }

export default function Departments() {
  const { user: authUser } = useAuth()
  const isCeo = authUser?.role === 'CEO'
  const [items, setItems] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [depts, usrs] = await Promise.all([listDepartments(), listUsers()])
      setItems(depts)
      setUsers(usrs)
    } catch {
      setError('Não foi possível carregar os departamentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (d: Department) => {
    setEditing(d)
    setForm({ nome: d.nome, descricao: d.descricao ?? '', manager_id: d.manager_id ? String(d.manager_id) : '' })
    setModalOpen(true)
  }

  const submit = async () => {
    setSaving(true)
    setFeedback('')
    try {
      const payload = {
        nome: form.nome,
        descricao: form.descricao || null,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
      }
      if (editing) {
        await updateDepartment(editing.id, payload)
      } else {
        await createDepartment(payload)
      }
      setModalOpen(false)
      void load()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFeedback(typeof detail === 'string' ? detail : 'Erro ao guardar departamento.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div>
      <PageHeader
        title="Departamentos"
        subtitle={`Total: ${items.length}`}
        actions={
          isCeo ? (
            <>
              <PrimaryButton onClick={openCreate}>Novo departamento</PrimaryButton>
            </>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState message="Sem departamentos para apresentar." />
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Descrição</th>
                <th style={thStyle}>Chefe</th>
                <th style={thStyle}>Funcionários</th>
                <th style={thStyle}>Estado</th>
                {isCeo && <th style={thStyle}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{d.id}</td>
                  <td style={tdStyle}>
                    <Link to={`/departments/${d.id}`} style={{ color: 'var(--clop-gold-light)', textDecoration: 'none' }}>
                      {d.nome}
                    </Link>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.descricao ?? '—'}
                  </td>
                  <td style={tdStyle}>{d.manager_nome ?? '—'}</td>
                  <td style={tdStyle}>{d.employee_count}</td>
                  <td style={tdStyle}>
                    <StatusBadge value={d.estado} />
                  </td>
                  {isCeo && (
                    <td style={tdStyle}>
                      <GhostButton onClick={() => openEdit(d)}>Editar</GhostButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar departamento' : 'Novo departamento'}>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <FormField label="Nome">
            <input style={inputStyle} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </FormField>
          <FormField label="Descrição">
            <textarea style={inputStyle} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
          </FormField>
          <FormField label="Chefe de departamento">
            <select style={selectStyle} value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
              <option value="">Sem chefe</option>
              {users
                .filter((u) => u.role === 'MANAGER' || u.role === 'CEO')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome_completo}
                  </option>
                ))}
            </select>
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