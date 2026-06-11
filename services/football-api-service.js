import CONFIG from '../config.js';

/**
 * @typedef {Object} MatchResult
 * @property {number} id - ID da partida
 * @property {string} homeTeam - Time mandante
 * @property {string} awayTeam - Time visitante
 * @property {number|null} homeScore - Gols mandante
 * @property {number|null} awayScore - Gols visitante
 * @property {string} status - "FINISHED", "IN_PLAY", "TIMED", etc.
 * @property {string} utcDate - Data/hora em UTC
 * @property {number} matchday - Rodada
 */

/**
 * Serviço de resultados das partidas.
 * Fonte principal: results.json (atualizado pela GitHub Action).
 * Fallback: API football-data.org via proxy CORS.
 */
class FootballApiService {
  constructor(apiToken) {
    this.apiToken = apiToken;
  }

  /**
   * Busca as partidas. Usa results.json como fonte de placares,
   * e complementa com a API para jogos futuros.
   * @returns {Promise<MatchResult[]>}
   */
  async fetchMatches() {
    let resultsData = [];
    let apiData = [];

    // Busca results.json (placares atualizados pela Action)
    try {
      const response = await fetch('./results.json?t=' + Date.now());
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          resultsData = data;
        }
      }
    } catch {
      // Continua sem results.json
    }

    // Se results.json tem jogos, usa como fonte principal
    if (resultsData.length > 0) {
      return resultsData;
    }

    // Fallback: API via proxy CORS
    try {
      const targetUrl = `https://api.football-data.org/v4/competitions/${CONFIG.COMPETITION_CODE}/matches`;
      const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl, {
        headers: { 'X-Auth-Token': this.apiToken },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return this._parseMatchesResponse(data);
    } catch {
      throw new Error('Não foi possível obter os resultados das partidas.');
    }
  }

  /**
   * Filtra apenas partidas finalizadas.
   * @param {MatchResult[]} matches
   * @returns {MatchResult[]}
   */
  getFinishedMatches(matches) {
    return matches.filter(m => m.status === 'FINISHED' && m.homeScore !== null && m.awayScore !== null);
  }

  /**
   * Transforma resposta da API em MatchResult[].
   * @param {Object} data
   * @returns {MatchResult[]}
   */
  _parseMatchesResponse(data) {
    if (!data || !Array.isArray(data.matches)) return [];

    return data.matches.map(match => ({
      id: match.id,
      homeTeam: match.homeTeam?.name ?? '',
      awayTeam: match.awayTeam?.name ?? '',
      homeScore: match.score?.fullTime?.home ?? null,
      awayScore: match.score?.fullTime?.away ?? null,
      status: match.status,
      utcDate: match.utcDate,
      matchday: match.matchday,
    }));
  }
}

export { FootballApiService };
