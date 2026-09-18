import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User, UserRole } from '../types/user'
import type { TaskDetail } from '../types/task'
import type { Department } from '../types/department'
import type { ProductivityMetrics } from '../types/report'
import { getUser, updateUser, uploadUserPhoto } from '../services/users'
import { listDepartments } from '../services/departments'
import { listTasks } from '../services/tasks'
import { getEmployeeProductivity } from '../services/dashboard'
import { useAuth } from '../hooks/useAuth'
import Avatar from '../components/ui/Avatar'
import StatusBadge from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import {
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

const ROLE_LABELS: Record<UserRole, string> = {
  CEO: 'Administrador',
  MANAGER: 'Chefe de Departamento',
  EMPLOYEE: 'Funcionário',
}

type EditableForm = {
  nome_completo: string
  email: string
  telefone: string
  cargo: string
  data_admissao: string
  departamento_id: string
  password: string
}

export default function Profile() {
  const { user: authUser, refreshUser } = useAuth()
  const isCeo = authUser?.role === 'CEO'

  const [me, setMe] = useState<User | null>(null)
  const [metrics, setMetrics] = useState<ProductivityMetrics | null>(null)
  const [tasks, setTasks] = useState<TaskDetail[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const [form, setForm] = useState<EditableForm>({
    nome_completo: '',
    email: '',
    telefone: '',
    cargo: '',
    data_admissao: '',
    departamento_id: '',
    password: '',
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authUser) return
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [u, m, t] = await Promise.all([
          getUser(authUser.id),
          getEmployeeProductivity(authUser.id),
          listTasks({ assigned_to: authUser.id }),
        ])
        if (!active) return
        setMe(u)
        setMetrics(m)
        setTasks(t)
        setForm({
          nome_completo: u.nome_completo,
          email: u.email,
          telefone: u.telefone ?? '',
          cargo: u.cargo ?? '',
          data_admissao: u.data_admissao ?? '',
          departamento_id: u.departamento_id ? String(u.departamento_id) : '',
          password: '',
        })
        if (isCeo) setDepartments(await listDepartments())
      } catch {
        if (active) setError('Não foi possível carregar o perfil.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [authUser, isCeo])

  if (loading) return <LoadingState />
  if (error || !me || !authUser) return <ErrorState message={error || 'Sem dados do perfil.'} onRetry={() => window.location.reload()} />

  const departamentoNome = me.departamento_nome ?? authUser.departamento_nome ?? null

  const save = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      let updated: User
      if (authUser.role === 'EMPLOYEE') {
        updated = await updateUser(authUser.id, {
          telefone: form.telefone.trim() || null,
          password: form.password || undefined,
        })
      } else {
        const payload: Record<string, unknown> = {}
        if (isCeo) payload.departamento_id = form.departamento_id ? Number(form.departamento_id) : null
        updated = await updateUser(authUser.id, {
          nome_completo: form.nome_completo.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim() || null,
          cargo: form.cargo.trim() || null,
          data_admissao: form.data_admissao || null,
          ...(isCeo ? payload : {}),
          password: form.password || undefined,
        })
      }
      setMe({ ...me, ...updated })
      await refreshUser()
      setForm((f) => ({ ...f, password: '' }))
      setFeedback({ type: 'ok', text: 'Perfil atualizado com sucesso.' })
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFeedback({ type: 'error', text: typeof detail === 'string' ? detail : 'Erro ao guardar o perfil.' })
    } finally {
      setSaving(false)
    }
  }

  const savePhoto = async () => {
    if (!photo) return
    setSaving(true)
    setFeedback(null)
    try {
      const updated = await uploadUserPhoto(authUser.id, photo)
      setMe({ ...me, ...updated })
      await refreshUser()
      setPhoto(null)
      if (photoRef.current) photoRef.current.value = ''
      setFeedback({ type: 'ok', text: 'Fotografia atualizada.' })
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFeedback({ type: 'error', text: typeof detail === 'string' ? detail : 'Erro ao enviar a fotografia.' })
    } finally {
      setSaving(false)
    }
  }

  const photoPreview = photo ? URL.createObjectURL(photo) : null

  return (
    <div>
      <PageHeader title="Meu Perfil" subtitle={ROLE_LABELS[authUser.role]} />

      {feedback && (
        <div
          style={{
            border: `1px solid ${feedback.type === 'ok' ? 'rgba(22,163,74,0.4)' : 'rgba(220,38,38,0.4)'}`,
            background: feedback.type === 'ok' ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
            borderRadius: 10,
            padding: '0.7rem 1rem',
            marginBottom: '1rem',
            color: feedback.type === 'ok' ? 'var(--success)' : 'var(--danger)',
            fontSize: '0.85rem',
          }}
        >
          {feedback.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1rem', alignItems: 'start', marginBottom: '1rem' }}>
        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            {photoPreview ? (
              <img
                src={photoPreview}
                alt={me.nome_completo}
                style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--clop-gold)' }}
              />
            ) : (
              <Avatar nome={me.nome_completo} foto={me.foto} size={120} />
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--clop-white)', fontWeight: 600, fontSize: '1rem' }}>{me.nome_completo}</div>
              <div style={{ color: 'var(--clop-gray)', fontSize: '0.8rem' }}>{me.cargo ?? ROLE_LABELS[authUser.role]}</div>
              <div style={{ marginTop: '0.35rem' }}>
                <StatusBadge value={me.estado} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <input
              ref={photoRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              style={{ fontSize: '0.78rem', color: 'var(--clop-gray)' }}
            />
            <GhostButton disabled={saving || !photo} onClick={() => void savePhoto()}>
              Atualizar fotografia
            </GhostButton>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Dados</h3>
            <table style={tableStyle}>
              <tbody>
                {[
                  ['Nome completo', me.nome_completo],
                  ['Email', me.email],
                  ['Telefone', me.telefone ?? '—'],
                  ['Cargo', me.cargo ?? '—'],
                  ['Departamento', departamentoNome ?? '—'],
                  ['Chefe', me.chefe_nome ?? authUser.chefe_nome ?? '—'],
                  ['Data de admissão', me.data_admissao ? new Date(me.data_admissao + 'T00:00:00').toLocaleDateString('pt-PT') : '—'],
                  ['Membro desde', new Date(me.created_at).toLocaleDateString('pt-PT')],
                ].map(([k, v]) => (
                  <tr key={String(k)}>
                    <td style={{ ...tdStyle, color: 'var(--clop-gray)', width: 180 }}>{String(k)}</td>
                    <td style={{ ...tdStyle, color: 'var(--clop-white)' }}>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Editar perfil</h3>
            {authUser.role === 'EMPLOYEE' && (
              <p style={{ color: 'var(--clop-gray)', fontSize: '0.8rem', margin: '0 0 0.9rem' }}>
                Como funcionário só pode alterar o telefone e a palavra-passe.
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
              {authUser.role !== 'EMPLOYEE' && (
                <>
                  <FormField label="Nome completo">
                    <input style={inputStyle} value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
                  </FormField>
                  <FormField label="Email">
                    <input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </FormField>
                </>
              )}
              <FormField label="Telefone">
                <input style={inputStyle} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </FormField>
              <FormField label="Nova palavra-passe">
                <input style={inputStyle} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Deixar vazio para manter" />
              </FormField>
              {authUser.role !== 'EMPLOYEE' && (
                <>
                  <FormField label="Cargo">
                    <input style={inputStyle} value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                  </FormField>
                  <FormField label="Data de admissão">
                    <input style={inputStyle} type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} />
                  </FormField>
                  {isCeo && (
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
                  )}
                </>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <PrimaryButton disabled={saving} onClick={() => void save()}>
                {saving ? 'A guardar…' : 'Guardar alterações'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <StatCard title="Tarefas atribuídas" value={metrics.total_tasks} />
          <StatCard title="Concluídas" value={metrics.completed_tasks} accent="success" />
          <StatCard title="Pendentes" value={metrics.pending_tasks} accent="warning" />
          <StatCard title="Atrasadas" value={metrics.overdue_tasks} accent="danger" />
          <StatCard title="Taxa de conclusão" value={`${metrics.completion_rate}%`} />
          <StatCard title="No prazo" value={`${metrics.on_time_rate}%`} />
        </div>
      )}

      <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
        <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Tarefas recentes</h3>
        {tasks.length === 0 ? (
          <p style={{ color: 'var(--clop-gray)', fontSize: '0.85rem' }}>Sem tarefas atribuídas.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Tarefa</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Progresso</th>
                <th style={thStyle}>Prazo</th>
              </tr>
            </thead>
            <tbody>
              {tasks.slice(0, 6).map((t) => (
                <tr key={t.id}>
                  <td style={{ ...tdStyle, color: 'var(--clop-white)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Link to={`/tasks/${t.id}`} style={{ color: 'var(--clop-gold-light)', textDecoration: 'none' }}>
                      {t.titulo}
                    </Link>
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge value={t.status} />
                  </td>
                  <td style={{ ...tdStyle, minWidth: 110 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ProgressBar value={t.progress} />
                      <span style={{ fontSize: '0.72rem', color: 'var(--clop-gray)' }}>{t.progress}%</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>{t.deadline ? new Date(t.deadline).toLocaleDateString('pt-PT') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}