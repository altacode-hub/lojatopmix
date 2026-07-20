import { useEffect, useMemo, useState } from 'react'
import { FiCheckCircle } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { siteTheme } from '../siteTheme'
import { getClienteProfileDraft, saveClienteProfileDraft, toUppercaseInput, type ClienteProfileDraft } from './clientStorage'

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: `1px solid ${siteTheme.colors.borderStrong}`,
  outline: 'none',
  background: siteTheme.colors.surface,
  color: siteTheme.colors.text,
  boxSizing: 'border-box' as const,
  textTransform: 'uppercase' as const,
}

export default function ClienteDadosCadastrais() {
  const { user } = useAuth()
  const storageKey = user?.uid || 'anonimo'
  const initialPhone = user?.phoneNumber || ''
  const [form, setForm] = useState<ClienteProfileDraft>(() => {
    const stored = getClienteProfileDraft(storageKey)
    return {
      ...stored,
      phone: stored.phone || initialPhone,
    }
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = getClienteProfileDraft(storageKey)
    setForm({
      ...stored,
      phone: stored.phone || initialPhone,
    })
  }, [initialPhone, storageKey])

  const completion = useMemo(() => {
    const fields = [form.fullName, form.email, form.cpf, form.phone]
    const completed = fields.filter((field) => field.trim().length > 0).length
    return Math.round((completed / fields.length) * 100)
  }, [form])

  const handleChange = (field: keyof ClienteProfileDraft, value: string) => {
    setSaved(false)
    setForm((current) => ({
      ...current,
      [field]: toUppercaseInput(value),
    }))
  }

  const handleSave = () => {
    saveClienteProfileDraft(storageKey, form)
    setSaved(true)
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section
        style={{
          background: siteTheme.colors.surface,
          borderRadius: siteTheme.radius.lg,
          padding: 24,
          border: `1px solid ${siteTheme.colors.border}`,
          boxShadow: siteTheme.shadow.card,
          display: 'grid',
          gap: 10,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, color: siteTheme.colors.text }}>Dados cadastrais</h1>
        <p style={{ margin: 0, color: siteTheme.colors.textMuted }}>
          Mantenha seus dados atualizados para agilizar compras, entregas e confirmações de pagamento.
        </p>
        <div style={{ marginTop: 6, color: siteTheme.colors.primary, fontWeight: 700 }}>Perfil preenchido: {completion}%</div>
      </section>

      <section
        style={{
          background: siteTheme.colors.surface,
          borderRadius: siteTheme.radius.lg,
          border: `1px solid ${siteTheme.colors.border}`,
          padding: 24,
          display: 'grid',
          gap: 16,
        }}
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: siteTheme.colors.text, fontWeight: 600 }}>Nome completo</span>
            <input
              type="text"
              value={form.fullName}
              onChange={(event) => handleChange('fullName', event.target.value)}
              placeholder="Seu nome completo"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: siteTheme.colors.text, fontWeight: 600 }}>E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => handleChange('email', event.target.value)}
              placeholder="cliente@topmix.com"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: siteTheme.colors.text, fontWeight: 600 }}>CPF</span>
            <input
              type="text"
              value={form.cpf}
              onChange={(event) => handleChange('cpf', event.target.value)}
              placeholder="000.000.000-00"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: siteTheme.colors.text, fontWeight: 600 }}>Telefone</span>
            <input
              type="tel"
              value={form.phone}
              disabled
              onChange={(event) => handleChange('phone', event.target.value)}
              placeholder="(00) 00000-0000"
              style={{...inputStyle, color: siteTheme.colors.textSoft}}
            />
          </label>
        </div>

        {saved ? (
          <div
            style={{
              borderRadius: 12,
              padding: '12px 14px',
              border: `1px solid ${siteTheme.colors.successBorder}`,
              background: siteTheme.colors.successBackground,
              color: siteTheme.colors.successText,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              width: 'fit-content',
            }}
          >
            <FiCheckCircle size={18} />
            Dados salvos neste dispositivo.
          </div>
        ) : null}

        <div>
          <button
            onClick={handleSave}
            style={{
              padding: '14px 20px',
              borderRadius: 12,
              border: 'none',
              background: siteTheme.colors.primary,
              color: siteTheme.colors.surface,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Salvar dados
          </button>
        </div>
      </section>
    </div>
  )
}
