import type { TaskStatus } from '../../types/task'
import type { UserStatus } from '../../types/user'

const STATUS_META: Record<
  string,
  { label: string; color: string; background: string }
> = {
  COMPLETED: { label: 'Concluída', color: 'var(--success)', background: 'rgba(22,163,74,0.12)' },
  IN_PROGRESS: { label: 'Em andamento', color: '#4f86f7', background: 'rgba(79,134,247,0.14)' },
  PENDING: { label: 'Pendente', color: 'var(--warning)', background: 'rgba(234,179,8,0.12)' },
  OVERDUE: { label: 'Atrasada', color: 'var(--danger)', background: 'rgba(220,38,38,0.12)' },
  REJECTED: { label: 'Rejeitada', color: 'var(--danger)', background: 'rgba(220,38,38,0.12)' },
  SUBMITTED: { label: 'Submetida', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
  UNDER_REVIEW: { label: 'Em revisão', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
  CANCELLED: { label: 'Cancelada', color: 'var(--clop-gray)', background: 'rgba(161,161,170,0.12)' },
  ACTIVE: { label: 'Ativo', color: 'var(--success)', background: 'rgba(22,163,74,0.12)' },
  INACTIVE: { label: 'Inativo', color: 'var(--clop-gray)', background: 'rgba(161,161,170,0.12)' },
  SUSPENDED: { label: 'Suspenso', color: 'var(--warning)', background: 'rgba(234,179,8,0.12)' },
  LOGIN: { label: 'Login', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
  CREATE_USER: { label: 'Criar utilizador', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
  UPDATE_USER: { label: 'Atualizar utilizador', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
  CREATE_TASK: { label: 'Criar tarefa', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
  UPDATE_TASK: { label: 'Atualizar tarefa', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
  DELETE_TASK: { label: 'Eliminar tarefa', color: 'var(--danger)', background: 'rgba(220,38,38,0.12)' },
  ASSIGN_TASK: { label: 'Atribuir tarefa', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
  SUBMIT_TASK: { label: 'Submeter tarefa', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
  APPROVE_TASK: { label: 'Aprovar tarefa', color: 'var(--success)', background: 'rgba(22,163,74,0.12)' },
  REJECT_TASK: { label: 'Rejeitar tarefa', color: 'var(--danger)', background: 'rgba(220,38,38,0.12)' },
  CREATE_DEPARTMENT: { label: 'Criar departamento', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
  UPDATE_DEPARTMENT: { label: 'Atualizar departamento', color: 'var(--clop-gold)', background: 'rgba(212,167,44,0.12)' },
}

export default function StatusBadge({ value }: { value: string }) {
  const meta = STATUS_META[value] ?? {
    label: value,
    color: 'var(--clop-gray)',
    background: 'rgba(161,161,170,0.12)',
  }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.18rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: meta.color,
        background: meta.background,
        border: `1px solid ${meta.color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  )
}

export function userStatusBadge(status: UserStatus) {
  return <StatusBadge value={status} />
}

export const TASK_STATUSES: TaskStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'COMPLETED',
  'REJECTED',
  'OVERDUE',
  'CANCELLED',
]