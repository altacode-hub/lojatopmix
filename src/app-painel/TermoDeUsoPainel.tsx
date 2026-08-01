import { logistaTheme } from './logista/logistaTheme'

export default function TermoDeUsoPainel() {
  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 16px', background: logistaTheme.colors.surface, borderRadius: 12, border: `1px solid ${logistaTheme.colors.border}` }}>
      <h1 style={{ color: logistaTheme.colors.accentDark, padding: '20px 16px 0' }}>Termos de Uso</h1>
      <div style={{ padding: '0 16px 24px', color: logistaTheme.colors.text }}>
        <p>
          Ao utilizar nossos serviços, você concorda com os termos abaixo. Leia atentamente para entender suas
          responsabilidades e nossos compromissos.
        </p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Cadastro e conta</h2>
        <p>
          Você é responsável por manter a confidencialidade das credenciais e pela veracidade das informações fornecidas.
        </p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Compras e pagamentos</h2>
        <p>
          Pedidos estão sujeitos à disponibilidade. Preços e condições podem variar. Pagamentos são processados por
          parceiros confiáveis.
        </p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Uso adequado</h2>
        <p>É proibido utilizar o site para atividades ilegais, abusivas ou que violem direitos de terceiros.</p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Limitação de responsabilidade</h2>
        <p>
          Empregamos esforços para oferecer um serviço estável, mas não garantimos ausência de falhas. Não nos
          responsabilizamos por prejuízos indiretos.
        </p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Alterações</h2>
        <p>Os Termos podem ser atualizados periodicamente. O uso contínuo implica concordância com as novas condições.</p>

        <h2 style={{ color: logistaTheme.colors.accentDark }}>Contato</h2>
        <p>Em caso de dúvidas, entre em contato pelos canais oficiais de atendimento informados no site.</p>
      </div>
    </div>
  )
}
