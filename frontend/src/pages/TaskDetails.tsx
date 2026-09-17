import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Attachment, TaskDetail, TaskHistoryItem, TaskUpdateItem } from '../types/task'
import {
  approveTask,
  attachmentUrl,
  getTask,
  getTaskHistory,
  getTaskUpdates,
  listTaskAttachments,
  rejectTask,
  submitTask,
  updateTaskProgress,
  updateTaskStatus,
  uploadAttachment,
} from '../services/tasks'
import type { TaskRejectPayload, TaskSubmitPayload } from '../types/task'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import { useAuth } from '../hooks/useAuth'
import {
  DangerButton,
  ErrorState,
  FormField,
  GhostButton,
  LoadingState,
  PageHeader,
  PrimaryButton,
  ProgressBar,
  inputStyle,
  tableStyle,
  tdStyle,
} from '../components/ui/common'

export default function TaskDetails() {
  const { id } = useParams()
  const taskId = Number(id)
  const { user: authUser } = useAuth()

  const [task, setTask] = useState<TaskDetail | null>(null)
  const [history, setHistory] = useState<TaskHistoryItem[]>([])
  const [updates, setUpdates] = useState<TaskUpdateItem[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitForm, setSubmitForm] = useState<TaskSubmitPayload>({ progress: 100, descricao: '' })
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressForm, setProgressForm] = useState<{ progress: number; descricao: string }>({ progress: 0, descricao: '' })
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectForm, setRejectForm] = useState<TaskRejectPayload>({ motivo: '' })
  const [fileInput, setFileInput] = useState<File | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [t, h, u, a] = await Promise.all([getTask(taskId), getTaskHistory(taskId), getTaskUpdates(taskId), listTaskAttachments(taskId)])
      setTask(t)
      setHistory(h)
      setUpdates(u)
      setAttachments(a)
    } catch {
      setError('Não foi possível carregar a tarefa.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const assignedToMe = task?.assigned_to === authUser?.id
  const canStart = assignedToMe && (task?.status === 'PENDING' || task?.status === 'OVERDUE' || task?.status === 'REJECTED')
  const canSubmit = assignedToMe && (task?.status === 'IN_PROGRESS' || task?.status === 'PENDING' || task?.status === 'OVERDUE' || task?.status === 'REJECTED')
  const canReview =
    (task &&
      ((authUser?.role === 'CEO' && task.created_by !== authUser.id) ||
        (authUser?.role === 'MANAGER' && task.department_id === authUser.departamento_id && task.assigned_to !== authUser.id))) ||
    false
  const reviewable = task && (task.status === 'SUBMITTED' || task.status === 'UNDER_REVIEW')
  const showReviewActions = Boolean(reviewable && canReview)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      await load()
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Operação não concluída.')
    } finally {
      setBusy(false)
    }
  }

  const doUpload = async () => {
    if (!fileInput) return
    await run(async () => uploadAttachment(taskId, fileInput))
    setFileInput(null)
    if (uploadRef.current) uploadRef.current.value = ''
  }

  if (loading) return <LoadingState />
  if (error || !task) return <ErrorState message={error || 'Tarefa não encontrada.'} onRetry={load} />

  return (
    <div>
      <PageHeader
        title={task.titulo}
        subtitle={`Criada por ${task.created_by_nome ?? '—'} · ${new Date(task.created_at).toLocaleString('pt-PT')}`}
        actions={<StatusBadge value={task.status} />}
      />

      {task.is_overdue && (
        <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '1rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
          Esta tarefa está atrasada.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
          <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Detalhes</h3>
          <table style={tableStyle}>
            <tbody>
              {[
                ['Descrição', task.descricao || '—'],
                ['Tipo', task.tipo],
                ['Prioridade', task.prioridade],
                ['Atribuída a', task.assigned_to_nome ?? '—'],
                ['Departamento', task.department_nome ?? '—'],
                ['Data de início', task.start_date ? new Date(task.start_date).toLocaleString('pt-PT') : '—'],
                ['Prazo', task.deadline ? new Date(task.deadline).toLocaleString('pt-PT') : '—'],
                ['Concluída em', task.completed_at ? new Date(task.completed_at).toLocaleString('pt-PT') : '—'],
                ['Criada em', new Date(task.created_at).toLocaleString('pt-PT')],
              ].map(([k, v]) => (
                <tr key={String(k)}>
                  <td style={{ ...tdStyle, color: 'var(--clop-gray)', width: 200 }}>{String(k)}</td>
                  <td style={{ ...tdStyle, color: 'var(--clop-white)' }}>{String(v)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...tdStyle, color: 'var(--clop-gray)' }}>Progresso</td>
                <td style={{ ...tdStyle, width: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <ProgressBar value={task.progress} color={task.status === 'COMPLETED' ? 'var(--success)' : 'var(--clop-gold)'} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--clop-white)', fontWeight: 600 }}>{task.progress}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1.25rem' }}>
            {canStart && (
              <GhostButton disabled={busy} onClick={() => run(() => updateTaskStatus(taskId, 'IN_PROGRESS'))}>
                Iniciar tarefa
              </GhostButton>
            )}
            {assignedToMe && task.status === 'IN_PROGRESS' && (
              <GhostButton disabled={busy} onClick={() => setProgressOpen(true)}>
                Atualizar progresso
              </GhostButton>
            )}
            {canSubmit && (
              <PrimaryButton disabled={busy} onClick={() => setSubmitOpen(true)}>
                Submeter tarefa
              </PrimaryButton>
            )}
            {showReviewActions && (
              <>
                <PrimaryButton disabled={busy} onClick={() => run(() => approveTask(taskId))}>
                  Aprovar
                </PrimaryButton>
                <DangerButton disabled={busy} onClick={() => setRejectOpen(true)}>
                  Rejeitar
                </DangerButton>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Evidências e anexos</h3>
            {attachments.length === 0 ? (
              <p style={{ color: 'var(--clop-gray)', fontSize: '0.82rem' }}>Sem anexos.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={attachmentUrl(taskId, a.id)}
                      download
                      style={{ color: 'var(--clop-gold-light)', fontSize: '0.85rem', wordBreak: 'break-all' }}
                    >
                      {a.filename}
                      {a.size != null ? ` (${(a.size / 1024).toFixed(1)} KB)` : ''}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
              <input ref={uploadRef} type="file" onChange={(e) => setFileInput(e.target.files?.[0] ?? null)} style={{ fontSize: '0.78rem', color: 'var(--clop-gray)', flex: 1 }} />
              <GhostButton disabled={busy || !fileInput} onClick={() => void doUpload()}>
                Enviar
              </GhostButton>
            </div>
          </div>

          <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
            <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Atualizações de progresso</h3>
            {updates.length === 0 ? (
              <p style={{ color: 'var(--clop-gray)', fontSize: '0.82rem' }}>Sem atualizações.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {updates.map((u) => (
                  <li key={u.id} style={{ fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--clop-gold-light)' }}>{u.user_nome ?? '—'}</span>{' '}
                    <span style={{ color: 'var(--clop-gray)' }}>
                      — {u.progress}%
                      {u.descricao ? ` · ${u.descricao}` : ''}
                    </span>
                    <div style={{ color: 'var(--clop-gray)', fontSize: '0.72rem' }}>{new Date(u.created_at).toLocaleString('pt-PT')}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--clop-card-bg)', border: '1px solid var(--clop-card-border)', borderRadius: 'var(--clop-card-radius)', padding: '1.25rem' }}>
        <h3 style={{ color: 'var(--clop-gold-light)', fontSize: '0.95rem', marginTop: 0 }}>Histórico da tarefa</h3>
        {history.length === 0 ? (
          <p style={{ color: 'var(--clop-gray)', fontSize: '0.82rem' }}>Sem histórico.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {history.map((h) => (
              <li key={h.id} style={{ fontSize: '0.85rem', color: 'var(--clop-gray)' }}>
                <span style={{ color: 'var(--clop-gold-light)' }}>{new Date(h.created_at).toLocaleTimeString('pt-PT')}</span> —{' '}
                <span style={{ color: 'var(--clop-white)' }}>{h.description || h.action}</span>
                {h.user_nome ? <span> · {h.user_nome}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={submitOpen} onClose={() => setSubmitOpen(false)} title="Submeter atividade" width={480}>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <FormField label="Progresso">
            <input style={inputStyle} type="number" min={0} max={100} value={submitForm.progress} onChange={(e) => setSubmitForm({ ...submitForm, progress: Number(e.target.value) })} />
          </FormField>
          <FormField label="Descrição">
            <textarea style={inputStyle} rows={4} value={submitForm.descricao ?? ''} onChange={(e) => setSubmitForm({ ...submitForm, descricao: e.target.value })} placeholder="O que foi feito…" />
          </FormField>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
          <GhostButton onClick={() => setSubmitOpen(false)} disabled={busy}>
            Cancelar
          </GhostButton>
          <PrimaryButton
            disabled={busy}
            onClick={() => {
              setSubmitOpen(false)
              void run(() => submitTask(taskId, submitForm))
            }}
          >
            Submeter
          </PrimaryButton>
        </div>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Rejeitar tarefa" width={480}>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <FormField label="Motivo da rejeição (obrigatório)">
            <textarea style={inputStyle} rows={4} value={rejectForm.motivo} onChange={(e) => setRejectForm({ ...rejectForm, motivo: e.target.value })} />
          </FormField>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
          <GhostButton onClick={() => setRejectOpen(false)} disabled={busy}>
            Cancelar
          </GhostButton>
          <DangerButton
            disabled={busy || rejectForm.motivo.trim().length < 3}
            onClick={() => {
              setRejectOpen(false)
              void run(() => rejectTask(taskId, rejectForm))
            }}
          >
            Rejeitar
          </DangerButton>
        </div>
      </Modal>

      <Modal open={progressOpen} onClose={() => setProgressOpen(false)} title="Atualizar progresso" width={480}>
        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <FormField label="Progresso">
            <input style={inputStyle} type="number" min={0} max={100} value={progressForm.progress} onChange={(e) => setProgressForm({ ...progressForm, progress: Number(e.target.value) })} />
          </FormField>
          <FormField label="Descrição">
            <textarea style={inputStyle} rows={3} value={progressForm.descricao} onChange={(e) => setProgressForm({ ...progressForm, descricao: e.target.value })} />
          </FormField>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.25rem' }}>
          <GhostButton onClick={() => setProgressOpen(false)} disabled={busy}>
            Cancelar
          </GhostButton>
          <PrimaryButton
            disabled={busy}
            onClick={() => {
              setProgressOpen(false)
              void run(() => updateTaskProgress(taskId, progressForm.progress, progressForm.descricao))
            }}
          >
            Guardar
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  )
}