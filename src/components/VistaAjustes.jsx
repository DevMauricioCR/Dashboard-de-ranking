const VERSION = '2.0.0'

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
