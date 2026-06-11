/**
 * Configurações da aplicação Bolão Copa do Mundo.
 * Substitua os valores placeholder pelas suas credenciais reais.
 */
const CONFIG = {
  // API key do Google Cloud Console (habilite a Google Sheets API)
  SHEETS_API_KEY: 'AIzaSyCoKOR6yTO3yIfR6ZfAmpc-t5hRsr1vZWs',

  // ID da planilha Google Sheets (encontrado na URL da planilha)
  SPREADSHEET_ID: '18nDcIoQTtBqVKnc7megteYbIOjVK_AjCmeBO4IFKn0s',

  // Range dos dados na planilha (ex: 'Palpites!A:F')
  SHEET_RANGE: 'joao manoel!A:D',

  // Token da football-data.org (registre-se em https://www.football-data.org/)
  FOOTBALL_API_TOKEN: '4d5a8f8a11cf468d8a3c5364f549d381',

  // Código da competição Copa do Mundo na football-data.org
  COMPETITION_CODE: 'WC',
};

export default CONFIG;
