# ⚽ Bolão Copa do Mundo

Site de ranking para bolão da Copa do Mundo, hospedado no GitHub Pages. O sistema lê os palpites dos participantes de uma planilha Google Sheets e obtém os resultados das partidas em tempo real via API, calculando automaticamente o ranking de acertos de placar exato.

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Formato da Planilha Google Sheets](#formato-da-planilha-google-sheets)
- [Deploy no GitHub Pages](#deploy-no-github-pages)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Tecnologias](#tecnologias)

## Pré-requisitos

Antes de começar, você vai precisar de:

1. **Chave de API do Google Sheets**
   - Acesse o [Google Cloud Console](https://console.cloud.google.com/)
   - Crie um projeto (ou selecione um existente)
   - Ative a **Google Sheets API**
   - Crie uma credencial do tipo **API Key**

2. **Token da football-data.org**
   - Registre-se gratuitamente em [football-data.org](https://www.football-data.org/)
   - Copie o token disponível no painel da sua conta

3. **Planilha Google Sheets** com os palpites dos participantes (veja os formatos suportados abaixo)

## Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/bolao-copa-do-mundo.git
cd bolao-copa-do-mundo
```

### 2. Configure as credenciais

Abra o arquivo `config.js` e substitua os valores placeholder pelas suas credenciais:

```javascript
const CONFIG = {
  // Sua API key do Google Cloud Console
  SHEETS_API_KEY: 'SUA_API_KEY_AQUI',

  // ID da planilha (encontrado na URL: docs.google.com/spreadsheets/d/{ID}/edit)
  SPREADSHEET_ID: 'ID_DA_SUA_PLANILHA',

  // Range dos dados (ex: 'Palpites!A:F' para aba única ou 'João!A:E' para aba individual)
  SHEET_RANGE: 'Palpites!A:F',

  // Token da football-data.org
  FOOTBALL_API_TOKEN: 'SEU_TOKEN_AQUI',

  // Código da competição (WC = Copa do Mundo)
  COMPETITION_CODE: 'WC',
};
```

### 3. Torne a planilha acessível

A planilha Google Sheets precisa estar acessível pela API. Você tem duas opções:

- **Opção A (Recomendada):** Torne a planilha pública (Compartilhar > Qualquer pessoa com o link pode visualizar)
- **Opção B:** Mantenha a planilha privada e configure as permissões OAuth adequadas no Google Cloud Console

## Formato da Planilha Google Sheets

O sistema suporta dois formatos de organização dos palpites:

### Formato A: Aba Única

Todos os palpites ficam em uma única aba, com uma coluna identificando o participante.

| Participante | Time Mandante | Time Visitante | Placar Mandante | Placar Visitante |
|:-------------|:--------------|:---------------|:---------------:|:----------------:|
| João         | Brasil        | Argentina      | 2               | 1                |
| João         | México        | Canadá         | 1               | 0                |
| Maria        | Brasil        | Argentina      | 1               | 1                |
| Maria        | México        | Canadá         | 2               | 2                |

**Configuração:** `SHEET_RANGE: 'Palpites!A:E'` (ajuste o nome da aba conforme necessário)

### Formato B: Múltiplas Abas

Cada participante tem sua própria aba na planilha, com o nome da aba sendo o nome do participante.

**Aba "João":**

| Time Mandante | Time Visitante | Placar Mandante | Placar Visitante |
|:--------------|:---------------|:---------------:|:----------------:|
| Brasil        | Argentina      | 2               | 1                |
| México        | Canadá         | 1               | 0                |

**Aba "Maria":**

| Time Mandante | Time Visitante | Placar Mandante | Placar Visitante |
|:--------------|:---------------|:---------------:|:----------------:|
| Brasil        | Argentina      | 1               | 1                |
| México        | Canadá         | 2               | 2                |

**Configuração:** O sistema detecta automaticamente as abas e usa o nome de cada aba como nome do participante.

### Observações sobre a Planilha

- A primeira linha de cada aba/range é tratada como cabeçalho e ignorada
- Os nomes dos times devem corresponder aos nomes usados pela API football-data.org
- Placares devem ser números inteiros

## Deploy no GitHub Pages

1. Faça push do código para o repositório no GitHub
2. Acesse o repositório no GitHub
3. Vá em **Settings** > **Pages**
4. Em **Source**, selecione a branch `main` e a pasta `/ (root)`
5. Clique em **Save**
6. Aguarde alguns minutos — o GitHub exibirá a URL do seu site (geralmente `https://SEU_USUARIO.github.io/bolao-copa-do-mundo/`)

O site será atualizado automaticamente a cada push na branch configurada.

## Estrutura do Projeto

```
bolao-copa-do-mundo/
├── index.html              # Página principal
├── app.js                  # Entry point da aplicação
├── config.js               # Configurações (API keys, IDs)
├── styles.css              # Estilos da aplicação
├── services/
│   ├── sheets-service.js       # Integração com Google Sheets API
│   └── football-api-service.js # Integração com football-data.org
├── engine/
│   └── ranking-engine.js       # Cálculo do ranking de acertos
├── ui/
│   └── ui-renderer.js          # Renderização da interface
└── tests/
    └── ...                     # Testes unitários e de propriedade
```

## Tecnologias

- **HTML5** — Estrutura da página
- **CSS3** — Estilização responsiva com custom properties
- **JavaScript (ES Modules)** — Lógica da aplicação, sem frameworks
- **Google Sheets API v4** — Leitura dos palpites
- **football-data.org API v4** — Resultados das partidas em tempo real
- **GitHub Pages** — Hospedagem estática gratuita

Nenhum build step necessário — o projeto utiliza ES Modules nativos do navegador e pode ser servido diretamente como arquivos estáticos.

## Como Funciona

1. O usuário acessa o site hospedado no GitHub Pages
2. O site busca os palpites dos participantes na planilha Google Sheets
3. Simultaneamente, busca os resultados das partidas finalizadas na football-data.org
4. O ranking é calculado comparando cada palpite com o placar final real (acerto = placar exato)
5. Os participantes são ordenados por quantidade de acertos (empates resolvidos alfabeticamente)
6. O ranking é exibido com opção de ver os detalhes de cada participante

## Licença

Este projeto é de uso pessoal para organização de bolões entre amigos.
