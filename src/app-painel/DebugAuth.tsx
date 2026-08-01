import { useAuth } from '../context/AuthContext'
import { logistaTheme } from './logista/logistaTheme'

export default function DebugAuth() {
  const auth = useAuth()

  const items = [
    ['user?.uid', auth.user?.uid || '(null)'],
    ['user?.phoneNumber', auth.user?.phoneNumber || '(null)'],
    ['loading', String(auth.loading)],
    ['profileLoading', String(auth.profileLoading)],
    ['isLogista', String(auth.isLogista)],
    ['isCliente', String(auth.isCliente)],
    ['clientProfile?.fullName', auth.clientProfile?.fullName || '(vazio)'],
    ['clientProfile?.email', auth.clientProfile?.email || '(vazio)'],
    ['clientProfile?.phone', auth.clientProfile?.phone || '(vazio)'],
  ] as const

  return (
    <div style={{ maxWidth: 780, margin: '40px auto', padding: 24, background: logistaTheme.colors.surface, borderRadius: 12, border: `1px solid ${logistaTheme.colors.border}` }}>
      <h1 style={{ color: logistaTheme.colors.accentDark, fontSize: 20, marginBottom: 16 }}>
        🔍 Debug de Autenticação — Painel
      </h1>

      <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: logistaTheme.colors.surfaceAlt, color: logistaTheme.colors.text }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Como usar:</div>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Abra o Console do navegador (F12) e filtre por <code>[AuthContext]</code></li>
          <li>Faça login normalmente na tela de login do painel</li>
          <li>Volte para esta URL (<code>/debug</code>) e compare os valores abaixo com os logs do console</li>
          <li>Se <code>isLogista</code> aparecer <strong style={{ color: logistaTheme.colors.errorText }}>false</strong>, procure no console a linha <code>🔑 Resposta RTDB</code> ou <code>❌ ERRO ao ler loja/arealogista</code></li>
        </ol>
      </div>

      <h2 style={{ color: logistaTheme.colors.accentDark, fontSize: 16, margin: '16px 0 8px' }}>Estado atual do AuthContext</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', color: logistaTheme.colors.text }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 10, borderBottom: `1px solid ${logistaTheme.colors.border}`, color: logistaTheme.colors.textMuted }}>Propriedade</th>
            <th style={{ textAlign: 'left', padding: 10, borderBottom: `1px solid ${logistaTheme.colors.border}`, color: logistaTheme.colors.textMuted }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {items.map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: 10, borderBottom: `1px solid ${logistaTheme.colors.border}`, fontFamily: 'monospace', fontSize: 13 }}>{k}</td>
              <td
                style={{
                  padding: 10,
                  borderBottom: `1px solid ${logistaTheme.colors.border}`,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  fontWeight: k === 'isLogista' ? 800 : 500,
                  color:
                    k === 'isLogista'
                      ? v === 'true'
                        ? logistaTheme.colors.successText
                        : logistaTheme.colors.errorText
                      : logistaTheme.colors.text,
                }}
              >
                {v}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 24, padding: 12, borderRadius: 10, background: logistaTheme.colors.successBackground, border: `1px solid ${logistaTheme.colors.successBorder}`, color: logistaTheme.colors.successText }}>
        ✅ Se <strong>isLogista = true</strong> e ainda sim você não consegue acessar a página principal, provavelmente é problema de cache do roteador. Tente limpar o localStorage do site e fazer login de novo.
      </div>
    </div>
  )
}
