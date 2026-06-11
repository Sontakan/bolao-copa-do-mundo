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
      const timeout = setTimeout(() => controller.abort(), 15000);
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

const IGNORED_TABS = ['seleções', 'instruções'];

/**
 * Serviço responsável por buscar e normalizar os dados de palpites da Google Sheets.
 * Usa batchGet para buscar todas as abas em uma única requisição.
 */
class SheetsService {
  constructor(spreadsheetId, apiKey, options = {}) {
    this.spreadsheetId = spreadsheetId;
    this.apiKey = apiKey;
    this.range = options.range || 'Palpites!A:F';
    this._cache = null;
  }

  /**
   * Busca todos os dados da planilha de uma vez (palpites + campeões).
   * Usa batchGet para fazer UMA única requisição à API.
   * @returns {Promise<{predictions: Prediction[], championPicks: Map<string, string>}>}
   */
  async fetchAll() {
    if (this._cache) return this._cache;

    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`;

    // 1. Busca metadados para saber os nomes das abas
    const metaUrl = `${baseUrl}?fields=sheets.properties.title&key=${this.apiKey}`;
    const meta = await fetchWithRetry(metaUrl);

    if (!meta.sheets || meta.sheets.length === 0) {
      throw new Error('Planilha vazia ou inacessível.');
    }

    // Filtra abas de participantes
    const participantTabs = meta.sheets
      .map(s => s.properties.title)
      .filter(title => !IGNORED_TABS.includes(title.toLowerCase()));

    if (participantTabs.length === 0) {
      throw new Error('Nenhuma aba de participante encontrada.');
    }

    // 2. Busca TODAS as abas numa única chamada com batchGet
    const ranges = participantTabs.map(t => encodeURIComponent(t)).join('&ranges=');
    const batchUrl = `${baseUrl}/values:batchGet?ranges=${ranges}&key=${this.apiKey}`;
    const batchData = await fetchWithRetry(batchUrl);

    if (!batchData.valueRanges) {
      throw new Error('Formato da planilha inválido.');
    }

    // 3. Processa todas as abas
    const predictions = [];
    const championPicks = new Map();

    for (let i = 0; i < batchData.valueRanges.length; i++) {
      const sheetTitle = participantTabs[i];
      const values = batchData.valueRanges[i].values;

      if (!values || values.length < 2) continue;

      // Extrai campeão
      for (const row of values) {
        if (row && row[0] && row[0].toLowerCase().includes('campeão') && row[3]) {
          championPicks.set(sheetTitle, row[3].trim());
          break;
        }
      }

      // Extrai palpites
      const tabPredictions = this._parseMultiTabSheet(sheetTitle, { values });
      predictions.push(...tabPredictions);
    }

    if (predictions.length === 0) {
      throw new Error('Formato da planilha inválido. Verifique se as colunas estão corretas.');
    }

    this._cache = { predictions, championPicks };
    return this._cache;
  }

  /**
   * Busca todos os palpites (mantém compatibilidade).
   * @returns {Promise<Prediction[]>}
   */
  async fetchPredictions() {
    const { predictions } = await this.fetchAll();
    return predictions;
  }

  /**
   * Busca os campeões escolhidos (mantém compatibilidade).
   * @returns {Promise<Map<string, string>>}
   */
  async fetchChampionPicks() {
    const { championPicks } = await this.fetchAll();
    return championPicks;
  }

  /**
   * Normaliza os dados de uma aba individual (formato multi-tab).
   * Formato esperado: Data | Grupo | Jogo | Time 1 | Gols | x | Gols2 | Time 2
   * @param {string} participantName
   * @param {Object} data
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

      if (!row || row.length < 8) continue;

      const [, , , homeTeam, homeScoreStr, , awayScoreStr, awayTeam] = row;

      if (!homeTeam || !awayTeam || homeTeam === 'Time 1' || awayTeam === 'Time 2') continue;
      if (!homeScoreStr || !awayScoreStr || homeScoreStr.trim() === '' || awayScoreStr.trim() === '') continue;

      const homeScore = Number(homeScoreStr);
      const awayScore = Number(awayScoreStr);

      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
      if (homeScore < 0 || awayScore < 0) continue;
      if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) continue;

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
