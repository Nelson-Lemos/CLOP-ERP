import { useCallback, useEffect, useRef, useState } from 'react'
import { evidenceImageUrl, preloadEvidenceImages, uploadEvidence } from '../../services/trading'
import { GhostButton, PrimaryButton, selectStyle } from '../ui/common'
import { EVIDENCIA_TIPO_LABELS, type Evidence, type EvidenceTipo } from '../../types/trading'

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

interface EvidenceThumbProps {
  evidence: Evidence
}

function EvidenceThumb({ evidence }: EvidenceThumbProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    evidenceImageUrl(evidence.id)
      .then((url) => {
        if (active) setSrc(url)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [evidence.id])

  return (
    <a
      href={src ?? undefined}
      target="_blank"
      rel="noreferrer"
      title={`${EVIDENCIA_TIPO_LABELS[evidence.tipo]} · ${evidence.filename} · enviado por ${evidence.uploader_nome ?? '—'}`}
      style={{
        display: 'block',
        position: 'relative',
        border: '1px solid rgba(212,167,44,0.25)',
        borderRadius: 8,
        overflow: 'hidden',
        aspectRatio: '16 / 10',
        background: '#050505',
      }}
    >
      {src ? (
        <img src={src} alt={evidence.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <span style={{ fontSize: '0.68rem', color: 'var(--clop-gray)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          A carregar…
        </span>
      )}
      <span
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          fontSize: '0.6rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '0.1rem 0.35rem',
          borderRadius: 999,
          background: 'rgba(5,5,5,0.8)',
          color: 'var(--clop-gold-light)',
        }}
      >
        {EVIDENCIA_TIPO_LABELS[evidence.tipo]}
      </span>
      {(evidence.alerta_hash_duplicado || evidence.alerta_upload_tardio) && (
        <span
          title={evidence.alerta_hash_duplicado ? 'Ficheiro reutilizado noutra operação' : 'Enviado muito tempo após a operação'}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: 'var(--danger)',
          }}
        />
      )}
    </a>
  )
}

interface EvidenceUploaderProps {
  tradeId: number
  evidencias: Evidence[]
  disabled?: boolean
  onChanged: (evidence: Evidence) => void
}

export default function EvidenceUploader({ tradeId, evidencias, disabled, onChanged }: EvidenceUploaderProps) {
  const [tipo, setTipo] = useState<EvidenceTipo>('ENTRADA')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const byTipo = (t: EvidenceTipo) => evidencias.filter((e) => e.tipo === t)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.url])

  const pick = useCallback((file: File | null | undefined) => {
    setError('')
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      setError('Formato não permitido. Use PNG, JPG ou WEBP.')
      return
    }
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return { file, url: URL.createObjectURL(file) }
    })
  }, [])

  const send = async () => {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      const evidence = await uploadEvidence(tradeId, tipo, preview.file, preview.file.name)
      preloadEvidenceImages([evidence.id])
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url)
        return null
      })
      onChanged(evidence)
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Não foi possível enviar a evidência.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
        {(['ENTRADA', 'GESTAO', 'FECHO'] as EvidenceTipo[]).map((t) => {
          const items = byTipo(t)
          return (
            <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <p style={{ fontSize: '0.68rem', color: 'var(--clop-gray)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>
                {EVIDENCIA_TIPO_LABELS[t]} ({items.length})
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                {items.map((e) => (
                  <EvidenceThumb key={e.id} evidence={e} />
                ))}
              </div>
              {items.length === 0 && (
                <div
                  style={{
                    aspectRatio: '16 / 10',
                    border: '1px dashed rgba(212,167,44,0.25)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.68rem',
                    color: 'var(--clop-gray)',
                    textAlign: 'center',
                    padding: '0.3rem',
                  }}
                >
                  Sem captura
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!disabled && (
        <div
          onPaste={(e) => {
            const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
            if (item) pick(item.getAsFile())
          }}
          style={{
            border: '1px dashed rgba(212,167,44,0.35)',
            borderRadius: 10,
            padding: '0.7rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              style={{ ...selectStyle, minWidth: 130, fontSize: '0.8rem' }}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as EvidenceTipo)}
            >
              {(['ENTRADA', 'GESTAO', 'FECHO'] as EvidenceTipo[]).map((t) => (
                <option key={t} value={t}>
                  {EVIDENCIA_TIPO_LABELS[t]}
                </option>
              ))}
            </select>
            <GhostButton onClick={() => inputRef.current?.click()}>Escolher ficheiro</GhostButton>
            <span style={{ fontSize: '0.72rem', color: 'var(--clop-gray)' }}>ou cole a captura (Ctrl+V)</span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => pick(e.target.files?.[0])}
          />

          <p style={{ fontSize: '0.7rem', color: 'var(--clop-gray)', margin: 0 }}>
            PNG, JPG ou WEBP até 5 MB. No telemóvel pode usar a cámara directamente. A evidência enviada não pode ser substituída nem apagada.
          </p>

          {preview && (
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <img
                src={preview.url}
                alt="Pré-visualização"
                style={{ maxWidth: 180, maxHeight: 110, objectFit: 'contain', border: '1px solid var(--clop-card-border)', borderRadius: 6 }}
              />
              <PrimaryButton onClick={() => void send()} disabled={busy}>
                {busy ? 'A enviar…' : 'Enviar captura'}
              </PrimaryButton>
              <GhostButton
                onClick={() => {
                  setPreview((current) => {
                    if (current) URL.revokeObjectURL(current.url)
                    return null
                  })
                }}
                disabled={busy}
              >
                Cancelar
              </GhostButton>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.78rem', margin: 0 }}>{error}</p>}
    </div>
  )
}
