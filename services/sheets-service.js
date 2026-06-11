/**
 * @typedef {Object} Prediction
 * @property {string} participantName - Nome do participante
 * @property {string} homeTeam - Time mandante
 * @property {string} awayTeam - Time visitante
 * @property {number} homeScore - Placar previsto para o mandante
 * @property {number} awayScore - Placar previsto para o visitante
 */

/**
 * Wrapper para chamadas de API com retry e timeout.
 * @param {string} url - URL para buscar
 * @param {RequestInit} options - Opções do fetch
 * @param {number} maxRetries - Número máximo de tentativas adicionais
 * @returns {Promise<any>} Resposta JSON
 */
async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

/**
 * Serviço responsável por buscar e normalizar os dados de palpites da Google Sheets.
 */
class SheetsService {
  /**
   * @param {string} spreadsheetId - ID da planilha Google Sheets
   * @param {string} apiKey - API key do Google Cloud Console
   * @param {Object} [options] - Opções adicionais
   * @param {string} [options.range] - Range dos dados na planilha (ex: 'Palpites!A:F')
   */
  constructor(spreadsheetId, apiKey, options = {}) {
    this.spreadsheetId = spreadsheetId;
    this.apiKey = apiKey;
    this.range = options.range || 'Palpites!A:F';
  }

  /**
   * Busca todos os palpites da planilha.
   * Tenta primeiro o formato de aba única; se a planilha tiver múltiplas abas,
   * busca os metadados e itera sobre cada aba.
   * @returns {Promise<Prediction[]>}
   */
  async fetchPredictions() {
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`;

    // Tenta buscar no formato aba única primeiro
    try {
      const url = `${baseUrl}/values/${encodeURIComponent(this.range)}?key=${this.apiKey}`;
      const data = await fetchWithRetry(url);

      if (data.values && data.values.length > 1) {
        const parsed = this._parseSheetsResponse(data);
        if (parsed.length > 0) {
          return parsed;
        }
      }
    } catch (error) {
      // Se falhar, tenta formato multi-tab abaixo
    }

    // Formato multi-tab: busca metadados da planilha para obter nomes das abas
    const metaUrl = `${baseUrl}?fields=sheets.properties.title&key=${this.apiKey}`;
    const meta = await fetchWithRetry(metaUrl);

    if (!meta.sheets || meta.sheets.length === 0) {
      throw new Error('Formato da planilha inválido. Verifique se as colunas estão corretas.');
    }

    const predictions = [];
    const ignoredTabs = ['Seleções', 'seleções', 'Instruções', 'instruções'];

    for (const sheet of meta.sheets) {
      const sheetTitle = sheet.properties.title;

      // Ignora abas auxiliares que não são participantes
      if (ignoredTabs.includes(sheetTitle)) {
        continue;
      }

      const sheetUrl = `${baseUrl}/values/${encodeURIComponent(sheetTitle)}?key=${this.apiKey}`;

      try {
        const sheetData = await fetchWithRetry(sheetUrl);
        const tabPredictions = this._parseMultiTabSheet(sheetTitle, sheetData);
        predictions.push(...tabPredictions);
      } catch (error) {
        // Ignora abas que não consegue ler (podem ser abas auxiliares)
        continue;
      }
    }

    if (predictions.length === 0) {
      throw new Error('Formato da planilha inválido. Verifique se as colunas estão corretas.');
    }

    return predictions;
  }

  /**
   * Normaliza os dados brutos da API (formato aba única com coluna de participante)
   * em Prediction[].
   * Espera que a primeira linha seja o cabeçalho e as subsequentes sejam dados.
   * @param {Object} data - Resposta da Google Sheets API
   * @param {string[][]} data.values - Matriz de valores da planilha
   * @returns {Prediction[]}
   */
  _parseSheetsResponse(data) {
    if (!data || !data.values || data.values.length < 2) {
      return [];
    }

    const rows = data.values;
    const predictions = [];

    // Pula a primeira linha (cabeçalho)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // Precisa de pelo menos 5 colunas: participante, time mandante, time visitante, placar mandante, placar visitante
      if (!row || row.length < 5) {
        continue;
      }

      const [participantName, homeTeam, awayTeam, homeScoreStr, awayScoreStr] = row;

      // Valida que temos dados essenciais
      if (!participantName || !homeTeam || !awayTeam) {
        continue;
      }

      const homeScore = Number(homeScoreStr);
      const awayScore = Number(awayScoreStr);

      // Valida que os placares são números válidos e não-negativos
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
        continue;
      }

      if (homeScore < 0 || awayScore < 0) {
        continue;
      }

      // Valida que os placares são inteiros
      if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
        continue;
      }

      predictions.push({
        participantName: participantName.trim(),
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeScore,
        awayScore,
      });
    }

    return predictions;
  }

  /**
   * Normaliza os dados de uma aba individual (formato multi-tab).
   * Cada aba representa um participante.
   * Formato esperado: Data | Grupo | Jogo | Time 1 | Gols | x | Gols2 | Time 2
   * @param {string} participantName - Nome do participante (título da aba)
   * @param {Object} data - Resposta da Google Sheets API para a aba
   * @param {string[][]} data.values - Matriz de valores da aba
   * @returns {Prediction[]}
   */
  _parseMultiTabSheet(participantName, data) {
    if (!data || !data.values || data.values.length < 2) {
      return [];
    }

    const rows = data.values;
    const predictions = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Precisa de pelo menos 8 colunas: Data, Grupo, Jogo, Time1, Gols, x, Gols2, Time2
      if (!row || row.length < 8) {
        continue;
      }

      const [, , , homeTeam, homeScoreStr, , awayScoreStr, awayTeam] = row;

      // Pula cabeçalhos e linhas sem times válidos
      if (!homeTeam || !awayTeam || homeTeam === 'Time 1' || awayTeam === 'Time 2') {
        continue;
      }

      // Pula linhas de fases futuras sem palpite preenchido
      if (!homeScoreStr || !awayScoreStr || homeScoreStr.trim() === '' || awayScoreStr.trim() === '') {
        continue;
      }

      const homeScore = Number(homeScoreStr);
      const awayScore = Number(awayScoreStr);

      // Valida que os placares são números válidos e não-negativos
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
        continue;
      }

      if (homeScore < 0 || awayScore < 0) {
        continue;
      }

      // Valida que os placares são inteiros
      if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
        continue;
      }

      predictions.push({
        participantName: participantName.trim(),
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        homeScore,
        awayScore,
      });
    }

    return predictions;
  }
}

export { SheetsService, fetchWithRetry };
