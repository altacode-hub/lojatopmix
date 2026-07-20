import { useEffect, useState } from 'react'
import { FiMapPin, FiPlus, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { siteTheme } from '../siteTheme'
import { getClienteAddresses, saveClienteAddresses, toUppercaseInput, type ClienteAddress } from './clientStorage'

type AddressFormState = Omit<ClienteAddress, 'id'>

const createEmptyForm = (): AddressFormState => ({
  label: '',
  recipient: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  zipCode: '',
  reference: '',
})

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

export default function ClienteEnderecos() {
  const { user } = useAuth()
  const storageKey = user?.uid || 'anonimo'
  const [addresses, setAddresses] = useState<ClienteAddress[]>([])
  const [form, setForm] = useState<AddressFormState>(createEmptyForm)

  useEffect(() => {
    setAddresses(getClienteAddresses(storageKey))
  }, [storageKey])

  const handleChange = (field: keyof AddressFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: toUppercaseInput(value),
    }))
  }

  const handleSave = () => {
    if (!form.label.trim() || !form.street.trim() || !form.number.trim() || !form.city.trim()) {
      return
    }

    const nextAddresses = [
      ...addresses,
      {
        id: `${Date.now()}`,
        ...form,
      },
    ]

    setAddresses(nextAddresses)
    saveClienteAddresses(storageKey, nextAddresses)
    setForm(createEmptyForm())
  }

  const handleRemove = (addressId: string) => {
    const nextAddresses = addresses.filter((address) => address.id !== addressId)
    setAddresses(nextAddresses)
    saveClienteAddresses(storageKey, nextAddresses)
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
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, color: siteTheme.colors.text }}>Endereços</h1>
        <p style={{ margin: '10px 0 0', color: siteTheme.colors.textMuted }}>
          Cadastre endereços de entrega para acelerar o checkout e manter seus pedidos organizados.
        </p>
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
            <span>Identificação</span>
            <input value={form.label} onChange={(event) => handleChange('label', event.target.value)} placeholder="Casa, trabalho..." style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Destinatário</span>
            <input value={form.recipient} onChange={(event) => handleChange('recipient', event.target.value)} placeholder="Nome de quem recebe" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>CEP</span>
            <input value={form.zipCode} onChange={(event) => handleChange('zipCode', event.target.value)} placeholder="00000-000" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Rua</span>
            <input value={form.street} onChange={(event) => handleChange('street', event.target.value)} placeholder="Nome da rua" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Número</span>
            <input value={form.number} onChange={(event) => handleChange('number', event.target.value)} placeholder="123" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Complemento</span>
            <input value={form.complement} onChange={(event) => handleChange('complement', event.target.value)} placeholder="Apto, bloco..." style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Bairro</span>
            <input value={form.district} onChange={(event) => handleChange('district', event.target.value)} placeholder="Bairro" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Cidade</span>
            <input value={form.city} onChange={(event) => handleChange('city', event.target.value)} placeholder="Cidade" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 8 }}>
            <span>Estado</span>
            <input value={form.state} onChange={(event) => handleChange('state', event.target.value)} placeholder="UF" style={inputStyle} />
          </label>
        </div>

        <label style={{ display: 'grid', gap: 8 }}>
          <span>Referência</span>
          <input value={form.reference} onChange={(event) => handleChange('reference', event.target.value)} placeholder="Ponto de referência para entrega" style={inputStyle} />
        </label>

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
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FiPlus size={16} />
            Adicionar endereço
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 14 }}>
        {addresses.length === 0 ? (
          <div
            style={{
              background: siteTheme.colors.surface,
              borderRadius: siteTheme.radius.md,
              border: `1px dashed ${siteTheme.colors.primarySoftBorder}`,
              padding: 24,
              color: siteTheme.colors.textMuted,
            }}
          >
            Nenhum endereço salvo ainda.
          </div>
        ) : (
          addresses.map((address) => (
            <article
              key={address.id}
              style={{
                background: siteTheme.colors.surface,
                borderRadius: siteTheme.radius.md,
                border: `1px solid ${siteTheme.colors.border}`,
                padding: 20,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: siteTheme.colors.primary }}>
                  <FiMapPin size={18} />
                  <strong>{address.label || 'Endereço'}</strong>
                </div>
                <button
                  onClick={() => handleRemove(address.id)}
                  style={{
                    border: `1px solid ${siteTheme.colors.border}`,
                    background: siteTheme.colors.surface,
                    borderRadius: 10,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    color: siteTheme.colors.text,
                  }}
                >
                  <FiTrash2 size={16} />
                  Remover
                </button>
              </div>
              <div style={{ color: siteTheme.colors.text }}>
                {address.recipient && <div>{address.recipient}</div>}
                <div>
                  {address.street}, {address.number}
                  {address.complement ? ` - ${address.complement}` : ''}
                </div>
                <div>
                  {address.district} - {address.city}/{address.state}
                </div>
                {address.zipCode ? <div>CEP: {address.zipCode}</div> : null}
                {address.reference ? <div>Referência: {address.reference}</div> : null}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
