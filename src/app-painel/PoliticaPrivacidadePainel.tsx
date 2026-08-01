import { logistaTheme } from './logista/logistaTheme'

export default function PoliticaPrivacidadePainel() {
  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px', background: logistaTheme.colors.surface, borderRadius: 12, border: `1px solid ${logistaTheme.colors.border}` }}>
      <h1 style={{ color: logistaTheme.colors.accentDark, padding: '20px 16px 0' }}>Política de Privacidade</h1>
      <div style={{ padding: '0 16px 24px', color: logistaTheme.colors.text }}>
        <p>
          Valorizamos a sua privacidade. Esta Política descreve como coletamos, utilizamos e protegemos suas informações
          ao utilizar nossos serviços.
        </p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Informações que coletamos</h2>
        <p>
          Podemos coletar dados de contato, informações de pedidos, dados de navegação e interações no site para melhorar
          sua experiência e cumprir obrigações legais.
        </p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Uso das informações</h2>
        <p>
          Utilizamos seus dados para processar compras, oferecer suporte, personalizar conteúdo e realizar análises de
          uso. Não vendemos suas informações.
        </p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Compartilhamento</h2>
        <p>
          Compartilhamos dados apenas com parceiros necessários para operação (pagamentos, logística) e quando exigido
          por lei.
        </p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Segurança</h2>
        <p>
          Adotamos medidas técnicas e organizacionais para proteger seus dados. Apesar dos esforços, nenhum sistema é
          100% seguro.
        </p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Seus direitos</h2>
        <p>
          Você pode solicitar acesso, correção ou exclusão dos seus dados, bem como revogar consentimentos quando
          aplicável.
        </p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Contato</h2>
        <p>Em caso de dúvidas, entre em contato pelos canais oficiais de atendimento informados no site.</p>
      </div>
    </div>
  )
}
