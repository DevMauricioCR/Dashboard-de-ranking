import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAdvisorRoster, saveAdvisorConfig, ADVISOR_CONFIG_QUERY_KEY } from '../hooks/useData'

const VERSION = '2.0.0'

const inputStyle = {
  background: 'var(--s3)',
  border: '1px solid var(--b2)',
  color: 'var(--text)',
  fontFamily: 'var(--sans)',
  fontSize: 12,
  padding: '5px 8px',
  outline: 'none',
  minWidth: 0,
}

// Campo de dinero: muestra 100,000,000 con comas pero guarda el número.
function MoneyInput({ value, onChange, style }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={Number(value || 0).toLocaleString('en-US')}
      onChange={e => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
      onFocus={e => e.target.select()}
      style={style}
    />
  )
}

const money = n => '$' + Number(n || 0).toLocaleString('en-US')

// Edita la lista de asesores del ranking y su meta mensual. Se guarda en n8n
// (webhook asesores-config) para que todas las pantallas/TVs lean la misma lista.
function AsesoresEditor() {
  const queryClient = useQueryClient()
  const { roster, metaWeb, isSaved } = useAdvisorRoster()
  const [rows, setRows] = useState(() => roster.map(a => ({ ...a })))
  const [webMeta, setWebMeta] = useState(metaWeb)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState(null) // { ok, msg }
  const [saving, setSaving] = useState(false)

  // Si llega la lista guardada (o cambia desde otro equipo) y no hay edición en
  // curso, se refleja en pantalla.
  useEffect(() => {
    if (!dirty) {
      setRows(roster.map(a => ({ ...a })))
      setWebMeta(metaWeb)
    }
  }, [roster, metaWeb, dirty])

  const update = (index, patch) => {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setDirty(true)
    setStatus(null)
  }
  const remove = index => {
    setRows(prev => prev.filter((_, i) => i !== index))
    setDirty(true)
    setStatus(null)
  }
  const add = () => {
    setRows(prev => [...prev, { nombre: '', cargo: 'Asesor', metaMensual: 50000 }])
    setDirty(true)
    setStatus(null)
  }

  const save = async () => {
    const clean = rows.filter(r => r.nombre.trim())
    if (!clean.length) {
      setStatus({ ok: false, msg: 'Agrega al menos un asesor' })
      return
    }
    setSaving(true)
    try {
      const saved = await saveAdvisorConfig(clean, webMeta)
      queryClient.setQueryData(ADVISOR_CONFIG_QUERY_KEY, saved)
      setRows(saved.asesores.map(a => ({ ...a })))
      setWebMeta(saved.metaWeb)
      setDirty(false)
      setStatus({ ok: true, msg: 'Guardado' })
    } catch (err) {
      setStatus({ ok: false, msg: err.message || 'No se pudo guardar' })
    } finally {
      setSaving(false)
    }
  }

  const totalMeta = rows.reduce((sum, r) => sum + (Number(r.metaMensual) || 0), 0) + (Number(webMeta) || 0)

  return (
    <Section title="Asesores">
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--b1)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.03em', lineHeight: 1.5 }}>
        Solo estas personas aparecen en el ranking, cada una con su meta mensual. El nombre debe
        coincidir con el del owner en HubSpot (basta con las palabras que lo identifiquen, p. ej. "Héctor Cortez").
        {!isSaved && ' Aún no hay una lista guardada en n8n: se usan los valores por defecto hasta que guardes.'}
      </div>

      {rows.map((row, index) => (
        <div key={index} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 20px', borderBottom: '1px solid var(--b1)',
        }}>
          <input
            value={row.nombre}
            placeholder="Nombre del asesor"
            onChange={e => update(index, { nombre: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>$</span>
            <MoneyInput
              value={row.metaMensual}
              onChange={v => update(index, { metaMensual: v })}
              style={{ ...inputStyle, width: 120, textAlign: 'right' }}
            />
          </div>
          <button
            onClick={() => remove(index)}
            title="Quitar del ranking"
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
          >×</button>
        </div>
      ))}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', borderBottom: '1px solid var(--b1)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text)' }}>Ponch (Web)</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Ventas de la página de Diego Díaz</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>$</span>
          <MoneyInput
            value={webMeta}
            onChange={v => { setWebMeta(v); setDirty(true); setStatus(null) }}
            style={{ ...inputStyle, width: 120, textAlign: 'right' }}
          />
        </div>
        <div style={{ width: 24 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={add} style={{ ...inputStyle, cursor: 'pointer', color: 'var(--dim)' }}>+ Agregar asesor</button>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Meta total: {money(totalMeta)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {status && (
            <span style={{ fontSize: 10, color: status.ok ? 'var(--gold)' : '#e5484d' }}>{status.msg}</span>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            style={{
              ...inputStyle,
              cursor: dirty && !saving ? 'pointer' : 'default',
              background: dirty ? 'var(--gold)' : 'var(--s3)',
              color: dirty ? '#00110d' : 'var(--muted)',
              borderColor: dirty ? 'var(--amber)' : 'var(--b2)',
              fontWeight: 'bold',
              opacity: saving ? 0.6 : 1,
            }}
          >{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Section>
  )
}

function Row({ label, sub, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px',
      borderBottom: '1px solid var(--b1)',
      gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: sub ? 3 : 0 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.03em' }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head">
        <span className="panel-title">{title}</span>
      </div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20,
        background: value ? 'var(--gold)' : 'var(--s4)',
        border: `1px solid ${value ? 'var(--amber)' : 'var(--b3)'}`,
        borderRadius: 10,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background .2s, border-color .2s',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 2, left: value ? 16 : 2,
        width: 14, height: 14,
        background: value ? '#00110d' : 'var(--muted)',
        borderRadius: '50%',
        transition: 'left .2s',
      }} />
    </div>
  )
}

export default function VistaAjustes({
  tvMode, onToggleTV,
  refreshInterval, onRefreshInterval,
}) {
  const webhookUrl = import.meta.env.VITE_WEBHOOK_DATASET ||
    import.meta.env.VITE_WEBHOOK_RANKING ||
    `${import.meta.env.VITE_N8N_BASE_URL || 'https://diaz-lara.app.n8n.cloud/webhook'}/ranking-asesores`

  const maskedUrl = webhookUrl.replace(/https?:\/\//, '').replace(/\/.*/, '') + '/…'

  const intervalSec = Math.round(refreshInterval / 1000)
  const handleIntervalChange = raw => {
    const v = Math.max(10, Math.min(3600, Number(raw) || 60))
    onRefreshInterval(v * 1000)
  }

  return (
    <div style={{ maxWidth: 600, animation: 'up 0.5s ease both' }}>
      <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--b2)', marginBottom: 20 }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>
          Ajustes
        </div>
        <div style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: '-0.03em', color: 'var(--text)' }}>
          Configuración
        </div>
      </div>

      {/* MODO TV */}
      <Section title="Modo TV">
        <Row
          label="Pantalla completa"
          sub="Oculta la barra lateral y agranda la vista actual para proyectar"
        >
          <Toggle value={tvMode} onChange={onToggleTV} />
        </Row>
        <Row
          label="Rotación automática"
          sub="Con Pantalla completa activo, cambia de pantalla cada 30s: Día → Mes → Año → Podio → Eventos"
        >
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12, color: 'var(--dim)' }}>
            {tvMode ? 'activa' : 'se activa con TV'}
          </div>
        </Row>
        <Row
          label="5 pantallas sueltas para TV"
          sub="Cada TV también puede abrir su propia URL fija (sin rotación): ?view=pantalla-dia, ?view=pantalla-mes, ?view=pantalla-anio, ?view=pantalla-podio, ?view=pantalla-eventos"
        />
      </Section>

      {/* ASESORES */}
      <AsesoresEditor />

      {/* GENERAL */}
      <Section title="General">
        <Row
          label="Intervalo de actualización"
          sub="Cada cuántos segundos se consultan datos nuevos (mín. 10s)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min={10} max={3600}
              value={intervalSec}
              onChange={e => handleIntervalChange(e.target.value)}
              onBlur={e => handleIntervalChange(e.target.value)}
              style={{
                width: 56,
                background: 'var(--s3)',
                border: '1px solid var(--b2)',
                color: 'var(--text)',
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 14,
                padding: '3px 8px',
                outline: 'none',
                textAlign: 'center',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--gold)'}
            />
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--muted)' }}>s</span>
          </div>
        </Row>
      </Section>

      {/* CONEXIÓN */}
      <Section title="Conexión">
        <Row label="Fuente de datos" sub="Webhook n8n conectado a HubSpot">
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 10,
            color: 'var(--muted)', letterSpacing: '0.03em',
            maxWidth: 200, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {maskedUrl}
          </div>
        </Row>
        <Row label="Estado">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, background: 'var(--gold)', borderRadius: '50%', animation: 'blink 2.4s ease infinite' }} />
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em' }}>
              Conectado
            </span>
          </div>
        </Row>
      </Section>

      {/* ACERCA DE */}
      <Section title="Acerca de">
        <Row label="Dashboard de Ranking" sub="Díaz Lara — Sistema de seguimiento comercial">
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--dim)' }}>
            v{VERSION}
          </div>
        </Row>
        <Row label="Datos en tiempo real" sub="HubSpot CRM vía n8n + React">
          <div style={{ fontSize: 10, color: 'var(--dim)' }}>2026</div>
        </Row>
      </Section>
    </div>
  )
}
