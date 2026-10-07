import type { Dispatch, SetStateAction } from 'react'
import { logistaInputStyle, logistaTheme } from '../logistaTheme'
import { cardStyle } from '../vendas/helpers'
import type { CustomerRecord } from '../vendas/types'

type ClienteEditProps = {
  isMobile: boolean
  customerForm: Partial<CustomerRecord>
  setCustomerForm: Dispatch<SetStateAction<Partial<CustomerRecord>>>
  editingCustomerId: string | null
  savingCustomer: boolean
  resetForm: () => void
  handleSaveCustomer: () => Promise<void>
}

export default function ClienteEdit({
  isMobile,
  customerForm,
  setCustomerForm,
  editingCustomerId,
  savingCustomer,
  resetForm,
  handleSaveCustomer,
}: ClienteEditProps) {
  return (
    <section style={{ ...cardStyle, display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>
            Nome completo <span style={{ color: logistaTheme.colors.errorText }}>*</span>
          </span>
          <input
            value={customerForm.name || ''}
            onChange={(e) => setCustomerForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="Nome do cliente"
            style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Telefone / WhatsApp</span>
          <input
            value={customerForm.phone_number || ''}
            onChange={(e) => setCustomerForm((s) => ({ ...s, phone_number: e.target.value }))}
            placeholder="(00) 00000-0000"
            style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Data de nascimento</span>
          <input
            type="date"
            value={customerForm.birthDate || ''}
            onChange={(e) => setCustomerForm((s) => ({ ...s, birthDate: e.target.value }))}
            style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>E-mail</span>
          <input
            type="email"
            value={customerForm.email || ''}
            onChange={(e) => setCustomerForm((s) => ({ ...s, email: e.target.value }))}
            placeholder="cliente@email.com"
            style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </label>
      </div>

      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Observações</span>
        <textarea
          value={customerForm.notes || ''}
          onChange={(e) => setCustomerForm((s) => ({ ...s, notes: e.target.value }))}
          rows={4}
          placeholder="Informações adicionais sobre o cliente"
          style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </label>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          onClick={resetForm}
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: `1px solid ${logistaTheme.colors.borderStrong}`,
            background: logistaTheme.colors.surface,
            color: logistaTheme.colors.text,
            cursor: savingCustomer ? 'not-allowed' : 'pointer',
            opacity: savingCustomer ? 0.6 : 1,
          }}
          disabled={savingCustomer}
        >
          Cancelar
        </button>
        <button
          onClick={() => void handleSaveCustomer()}
          disabled={savingCustomer}
          style={{
            padding: '12px 20px',
            borderRadius: 12,
            border: 'none',
            background: logistaTheme.colors.accent,
            color: logistaTheme.colors.surface,
            fontWeight: 700,
            cursor: savingCustomer ? 'not-allowed' : 'pointer',
            opacity: savingCustomer ? 0.7 : 1,
          }}
        >
          {savingCustomer ? 'Salvando...' : editingCustomerId ? 'Salvar alterações' : 'Cadastrar cliente'}
        </button>
      </div>
    </section>
  )
}
