/**
 * Configurações da aplicação Bolão Copa do Mundo.
 * Substitua os valores placeholder pelas suas credenciais reais.
 */
const CONFIG = {
  // API key do Google Cloud Console (habilite a Google Sheets API)
  SHEETS_API_KEY: 'YOUR_GOOGLE_SHEETS_API_KEY',

  // ID da planilha Google Sheets (encontrado na URL da planilha)
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID',

  // Range dos dados na planilha (ex: 'Palpites!A:F')
  SHEET_RANGE: 'Palpites!A:F',

  // Token da football-data.org (registre-se em https://www.football-data.org/)
  FOOTBALL_API_TOKEN: 'YOUR_FOOTBALL_DATA_API_TOKEN',

  // Código da competição Copa do Mundo na football-data.org
  COMPETITION_CODE: 'WC',
};

export default CONFIG;
