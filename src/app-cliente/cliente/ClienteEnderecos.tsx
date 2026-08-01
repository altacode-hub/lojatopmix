import { useEffect, useMemo, useState } from 'react'
import { FiMapPin, FiPlus, FiTrash2 } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { siteTheme } from '../siteTheme'
import {
  getClienteAddresses,
  loadClienteAddresses,
  saveClienteAddresses,
  toUppercaseInput,
  type ClienteAddress,
} from './clientStorage'

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
  const [addresses, setAddresses] = useState<ClienteAddress[]>(() => getClienteAddresses(storageKey))
  const [form, setForm] = useState<AddressFormState>(createEmptyForm)
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    setAddresses(getClienteAddresses(storageKey))
    setLoadingAddresses(true)

    void loadClienteAddresses(storageKey)
      .then((loadedAddresses) => {
        if (!active) {
          return
        }

        setAddresses(loadedAddresses)
      })
      .catch(() => {
        if (!active) {
          return
        }

        setErrorMessage('Nao foi possivel carregar os enderecos salvos.')
      })
      .finally(() => {
        if (active) {
          setLoadingAddresses(false)
        }
      })

    return () => {
      active = false
    }
  }, [storageKey])

  const handleChange = (field: keyof AddressFormState, value: string) => {
    setErrorMessage(null)
    setForm((current) => ({
      ...current,
      [field]: toUppercaseInput(value),
    }))
  }

  const isFormValid = useMemo(
    () => Boolean(form.label.trim() && form.street.trim() && form.number.trim() && form.city.trim()),
    [form.city, form.label, form.number, form.street],
  )

  const handleSave = async () => {
    if (!isFormValid) {
      setErrorMessage('Preencha identificacao, rua, numero e cidade para salvar o endereco.')
      return
    }

    const nextAddresses = [
      ...addresses,
      {
        id: `${Date.now()}`,
        ...form,
      },
    ]

    const previousAddresses = addresses

    try {
      setSaving(true)
      setErrorMessage(null)
      setAddresses(nextAddresses)
      await saveClienteAddresses(storageKey, nextAddresses)
      setForm(createEmptyForm())
    } catch (error) {
      setAddresses(previousAddresses)
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o endereco.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (addressId: string) => {
    const previousAddresses = addresses
    const nextAddresses = addresses.filter((address) => address.id !== addressId)

    try {
      setSaving(true)
      setErrorMessage(null)
      setAddresses(nextAddresses)
      await saveClienteAddresses(storageKey, nextAddresses)
    } catch (error) {
      setAddresses(previousAddresses)
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel remover o endereco.')
    } finally {
      setSaving(false)
    }
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
          Cadastre enderecos de entrega para acelerar o checkout e manter seus pedidos organizados no banco de dados.
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

        {errorMessage ? (
          <div
            style={{
              borderRadius: 12,
              padding: '12px 14px',
              border: `1px solid ${siteTheme.colors.errorBorder}`,
              background: siteTheme.colors.errorBackground,
              color: siteTheme.colors.errorText,
              width: 'fit-content',
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <div>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !isFormValid}
            style={{
              padding: '14px 20px',
              borderRadius: 12,
              border: 'none',
              background: saving || !isFormValid ? siteTheme.colors.primaryMuted : siteTheme.colors.primary,
              color: siteTheme.colors.surface,
              fontWeight: 700,
              cursor: saving || !isFormValid ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FiPlus size={16} />
            {saving ? 'Salvando...' : 'Adicionar endereco'}
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 14 }}>
        {loadingAddresses ? (
          <div
            style={{
              background: siteTheme.colors.surface,
              borderRadius: siteTheme.radius.md,
              border: `1px solid ${siteTheme.colors.border}`,
              padding: 24,
              color: siteTheme.colors.textMuted,
            }}
          >
            Carregando enderecos salvos...
          </div>
        ) : addresses.length === 0 ? (
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
                  onClick={() => void handleRemove(address.id)}
                  disabled={saving}
                  style={{
                    border: `1px solid ${siteTheme.colors.border}`,
                    background: siteTheme.colors.surface,
                    borderRadius: 10,
                    padding: '8px 12px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
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
