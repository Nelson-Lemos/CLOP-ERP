import { useEffect, useState } from 'react'
import { selectStyle } from './common'
import { listUsers } from '../../services/users'
import type { User } from '../../types/user'

export default function OperatorPicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (id: number | null) => void
}) {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    let active = true
    listUsers()
      .then((items) => {
        if (active) setUsers(items)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  return (
    <select style={{ ...selectStyle, minWidth: 190 }} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">Operador: eu (registos próprios)</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.nome_completo}
        </option>
      ))}
    </select>
  )
}
