import CONFIG from '../config.js';

/**
 * @typedef {Object} MatchResult
 * @property {number} id - ID da partida na API
 * @property {string} homeTeam - Time mandante
 * @property {string} awayTeam - Time visitante
 * @property {number|null} homeScore - Gols mandante (null se não finalizada)
 * @property {number|null} awayScore - Gols visitante (null se não finalizada)
 * @property {string} status - "FINISHED", "IN_PLAY", "SCHEDULED", etc.
 * @property {string} utcDate - Data/hora da partida em UTC
 * @property {number} matchday - Rodada da partida
 */

/**
 * Wrapper para chamadas de API com retry e timeout.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} maxRetries
 * @returns {Promise<any>}
 */
async function fetchWithRetry(url, options, maxRetries = 2) {
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
 * Serviço responsável por buscar os resultados das partidas da Copa do Mundo
 * via football-data.org API v4.
 */
class FootballApiService {
  /**
   * @param {string} apiToken - Token de autenticação da football-data.org
   */
  constructor(apiToken) {
    this.apiToken = apiToken;
  }

  /**
   * Busca todas as partidas da Copa do Mundo.
   * @returns {Promise<MatchResult[]>}
   */
  async fetchMatches() {
    const url = `https://api.football-data.org/v4/competitions/${CONFIG.COMPETITION_CODE}/matches`;
    const options = {
      headers: {
        'X-Auth-Token': this.apiToken,
      },
    };

    const data = await fetchWithRetry(url, options);
    return this._parseMatchesResponse(data);
  }

  /**
   * Filtra apenas partidas finalizadas.
   * @param {MatchResult[]} matches
   * @returns {MatchResult[]}
   */
  getFinishedMatches(matches) {
    return matches.filter(match => match.status === 'FINISHED');
  }

  /**
   * Transforma a resposta da API em MatchResult[].
   * @param {Object} data - Resposta da API football-data.org
   * @returns {MatchResult[]}
   */
  _parseMatchesResponse(data) {
    if (!data || !Array.isArray(data.matches)) {
      return [];
    }

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

export { FootballApiService, fetchWithRetry };
