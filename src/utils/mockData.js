// Datos de ejemplo para desarrollo local
// Cuando conectes N8N, estos se reemplazan automáticamente

export const MOCK_RANKING = [
  { rank: 1, ownerId: '101', nombre: 'Sofía Ramírez',    deals: 28, monto: 485000, leadsContactados: 64, tendencia: '+3' },
  { rank: 2, ownerId: '102', nombre: 'Carlos Mendoza',   deals: 24, monto: 392000, leadsContactados: 58, tendencia: '+1' },
  { rank: 3, ownerId: '103', nombre: 'Valeria Torres',   deals: 21, monto: 355000, leadsContactados: 52, tendencia: '-1' },
  { rank: 4, ownerId: '104', nombre: 'Diego Herrera',    deals: 18, monto: 298000, leadsContactados: 47, tendencia: '0'  },
  { rank: 5, ownerId: '105', nombre: 'Ana López',        deals: 15, monto: 241000, leadsContactados: 39, tendencia: '+2' },
  { rank: 6, ownerId: '106', nombre: 'Luis Vega',        deals: 13, monto: 198000, leadsContactados: 34, tendencia: '-2' },
  { rank: 7, ownerId: '107', nombre: 'Patricia Ruiz',    deals: 11, monto: 174000, leadsContactados: 30, tendencia: '0'  },
  { rank: 8, ownerId: '108', nombre: 'Roberto Solis',    deals:  9, monto: 135000, leadsContactados: 25, tendencia: '-1' },
]

export const MOCK_LEADS = [
  { id: 'L001', nombre: 'Grupo Alfa S.A.',        asesorId: '101', asesor: 'Sofía Ramírez',  ultimaLlamada: '2026-05-24', totalLlamadas: 4, estadoNegocio: 'Cerrado ganado'  },
  { id: 'L002', nombre: 'TechVentures MX',        asesorId: '101', asesor: 'Sofía Ramírez',  ultimaLlamada: '2026-05-23', totalLlamadas: 2, estadoNegocio: 'Propuesta'       },
  { id: 'L003', nombre: 'Constructora Norte',     asesorId: '101', asesor: 'Sofía Ramírez',  ultimaLlamada: '2026-05-22', totalLlamadas: 1, estadoNegocio: 'Contactado'      },
  { id: 'L004', nombre: 'Distribuidora Sur',      asesorId: '102', asesor: 'Carlos Mendoza', ultimaLlamada: '2026-05-24', totalLlamadas: 3, estadoNegocio: 'Cerrado ganado'  },
  { id: 'L005', nombre: 'Logística Express',      asesorId: '102', asesor: 'Carlos Mendoza', ultimaLlamada: '2026-05-21', totalLlamadas: 2, estadoNegocio: 'Negociación'     },
  { id: 'L006', nombre: 'Inmobiliaria Central',   asesorId: '102', asesor: 'Carlos Mendoza', ultimaLlamada: '2026-05-20', totalLlamadas: 5, estadoNegocio: 'Cerrado ganado'  },
  { id: 'L007', nombre: 'Farmacia Del Valle',     asesorId: '103', asesor: 'Valeria Torres', ultimaLlamada: '2026-05-23', totalLlamadas: 2, estadoNegocio: 'Propuesta'       },
  { id: 'L008', nombre: 'Manufactura Oriente',    asesorId: '103', asesor: 'Valeria Torres', ultimaLlamada: '2026-05-22', totalLlamadas: 3, estadoNegocio: 'Cerrado ganado'  },
  { id: 'L009', nombre: 'Retail Plus',            asesorId: '104', asesor: 'Diego Herrera',  ultimaLlamada: '2026-05-24', totalLlamadas: 1, estadoNegocio: 'Contactado'      },
  { id: 'L010', nombre: 'Servicios Integrales',   asesorId: '104', asesor: 'Diego Herrera',  ultimaLlamada: '2026-05-19', totalLlamadas: 4, estadoNegocio: 'Cerrado ganado'  },
  { id: 'L011', nombre: 'Agropecuaria del Este',  asesorId: '105', asesor: 'Ana López',      ultimaLlamada: '2026-05-23', totalLlamadas: 2, estadoNegocio: 'Negociación'     },
  { id: 'L012', nombre: 'Transporte Veloz S.A.',  asesorId: '105', asesor: 'Ana López',      ultimaLlamada: '2026-05-21', totalLlamadas: 1, estadoNegocio: 'Propuesta'       },
]

export const MOCK_PRODUCTOS = [
  { producto: 'Plan Empresarial',   ventas: 42, monto: 840000, pct: 38 },
  { producto: 'Plan Profesional',   ventas: 35, monto: 525000, pct: 32 },
  { producto: 'Plan Básico',        ventas: 28, monto: 280000, pct: 25 },
  { producto: 'Consultoría',        ventas:  6, monto: 180000, pct: 5  },
]

export const MOCK_KPIS = {
  totalLeadsHoy: 12,
  negociosMes:   139,
  montoMes:      1958000,
  asesorDelDia:  'Sofía Ramírez',
  ultimaActualizacion: new Date().toISOString(),
}
