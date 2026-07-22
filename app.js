import { SheetsService } from './services/sheets-service.js';
import { FootballApiService } from './services/football-api-service.js';
import { RankingEngine } from './engine/ranking-engine.js';
import { UIRenderer } from './ui/ui-renderer.js';
import CONFIG from './config.js';

const CACHE_KEYS = {
  PREDICTIONS: 'bolao_predictions',
  MATCHES: 'bolao_matches',
};

/**
 * Salva dados no sessionStorage como fallback.
 * @param {string} key
 * @param {any} data
 */
function cacheData(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // sessionStorage indisponível ou cheio — ignora silenciosamente
  }
}

/**
 * Recupera dados do sessionStorage como fallback.
 * @param {string} key
 * @returns {any|null}
 */
function getCachedData(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Ponto de entrada da aplicação.
 * Orquestra os serviços, engine e renderização com degradação graciosa.
 */
async function main() {
  const container = document.getElementById('app');
  const ui = new UIRenderer(container);

  ui.renderLoading();

  const sheetsService = new SheetsService(CONFIG.SPREADSHEET_ID, CONFIG.SHEETS_API_KEY);
  const footballService = new FootballApiService(CONFIG.FOOTBALL_API_TOKEN);
  const rankingEngine = new RankingEngine();

  let predictions = null;
  let matches = null;
  let championPicks = new Map();
  let predictionsError = null;
  let matchesError = null;

  // Busca palpites e campeões numa única requisição
  try {
    const sheetsData = await sheetsService.fetchAll();
    predictions = sheetsData.predictions;
    championPicks = sheetsData.championPicks;
    cacheData(CACHE_KEYS.PREDICTIONS, { predictions: predictions, champions: [...championPicks] });
  } catch (error) {
    predictionsError = error;
    const cached = getCachedData(CACHE_KEYS.PREDICTIONS);
    if (cached) {
      predictions = cached.predictions;
      championPicks = new Map(cached.champions || []);
    }
  }

  // Busca partidas com fallback para cache
  try {
    matches = await footballService.fetchMatches();
    cacheData(CACHE_KEYS.MATCHES, matches);
  } catch (error) {
    matchesError = error;
    matches = getCachedData(CACHE_KEYS.MATCHES);
  }

  // Ambas as fontes falharam e sem cache disponível
  if (!predictions && !matches) {
    ui.renderError(
      'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.'
    );
    return;
  }

  // Exibe alertas de falhas parciais
  if (predictionsError && !predictions) {
    ui.renderError(
      'Não foi possível carregar os palpites. Verifique sua conexão e tente novamente.'
    );
  }

  if (matchesError && !matches) {
    ui.renderError(
      'Não foi possível obter os resultados das partidas. Tente novamente mais tarde.'
    );
  }

  // Se temos partidas, renderiza lista de partidas
  if (matches) {
    const finishedMatches = footballService.getFinishedMatches(matches);

    if (predictions) {
      // Temos ambos — calcula ranking completo
      const ranking = rankingEngine.calculateRanking(predictions, finishedMatches, championPicks, 'Spain');
      ui.renderRanking(ranking);

      if (finishedMatches.length === 0) {
        ui.renderError('Nenhuma partida finalizada ainda.');
      }
    }

    ui.renderMatchList(matches, predictions);
  } else if (predictions) {
    // Temos palpites mas não temos partidas — mostra ranking zerado
    const ranking = rankingEngine.calculateRanking(predictions, [], championPicks, 'Spain');
    ui.renderRanking(ranking);
    ui.renderError(
      'Não foi possível obter os resultados das partidas. Tente novamente mais tarde.'
    );
  }

  // Alerta parcial: palpites falharam mas temos cache
  if (predictionsError && predictions) {
    console.warn('Usando palpites do cache. Erro original:', predictionsError.message);
  }

  // Alerta parcial: partidas falharam mas temos cache
  if (matchesError && matches) {
    console.warn('Usando partidas do cache. Erro original:', matchesError.message);
  }
}

document.addEventListener('DOMContentLoaded', main);

export { main, cacheData, getCachedData, CACHE_KEYS };
