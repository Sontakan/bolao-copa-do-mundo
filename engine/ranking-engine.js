/**
 * @typedef {Object} PredictionDetail
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {number} predictedHome
 * @property {number} predictedAway
 * @property {number|null} actualHome
 * @property {number|null} actualAway
 * @property {boolean} isCorrect
 * @property {string} matchStatus
 */

/**
 * @typedef {Object} ParticipantScore
 * @property {string} name - Nome do participante
 * @property {number} correctPredictions - Quantidade de acertos
 * @property {number} totalPredictions - Total de palpites válidos
 * @property {PredictionDetail[]} details - Detalhes de cada palpite
 */

/**
 * Mapeamento de nomes de times em PT-BR (planilha) para inglês (API football-data.org).
 */
const TEAM_NAME_MAP = {
  'México': 'Mexico',
  'África do Sul': 'South Africa',
  'Coreia do Sul': 'South Korea',
  'República Tcheca': 'Czechia',
  'Bósnia': 'Bosnia-Herzegovina',
  'Estados Unidos': 'United States',
  'Suíça': 'Switzerland',
  'Escócia': 'Scotland',
  'Austrália': 'Australia',
  'Alemanha': 'Germany',
  'Curaçao': 'Curaçao',
  'Costa do Marfim': 'Ivory Coast',
  'Equador': 'Ecuador',
  'Holanda': 'Netherlands',
  'Japão': 'Japan',
  'Suécia': 'Sweden',
  'Tunísia': 'Tunisia',
  'Espanha': 'Spain',
  'Cabo Verde': 'Cape Verde Islands',
  'Arábia Saudita': 'Saudi Arabia',
  'Uruguai': 'Uruguay',
  'Bélgica': 'Belgium',
  'Egito': 'Egypt',
  'Irã': 'Iran',
  'Nova Zelândia': 'New Zealand',
  'França': 'France',
  'Iraque': 'Iraq',
  'Noruega': 'Norway',
  'Argentina': 'Argentina',
  'Argélia': 'Algeria',
  'Áustria': 'Austria',
  'Jordânia': 'Jordan',
  'Portugal': 'Portugal',
  'RD Congo': 'Congo DR',
  'Inglaterra': 'England',
  'Croácia': 'Croatia',
  'Gana': 'Ghana',
  'Panamá': 'Panama',
  'Uzbequistão': 'Uzbekistan',
  'Colômbia': 'Colombia',
  'Turquia': 'Turkey',
  'Paraguai': 'Paraguay',
  'Marrocos': 'Morocco',
  'Brasil': 'Brazil',
  'Haiti': 'Haiti',
  'Canadá': 'Canada',
  'Catar': 'Qatar',
  'Senegal': 'Senegal',
};

/**
 * Motor de cálculo de ranking do bolão.
 * Compara palpites dos participantes com os resultados reais das partidas
 * e produz um ranking ordenado.
 */
class RankingEngine {
  /**
   * Calcula o ranking completo comparando palpites com resultados de partidas.
   * Apenas partidas com status "FINISHED" são consideradas para contabilizar acertos.
   *
   * @param {import('../services/sheets-service.js').Prediction[]} predictions - Lista de palpites
   * @param {import('../services/football-api-service.js').MatchResult[]} matches - Lista de partidas
   * @returns {ParticipantScore[]} Ranking ordenado
   */
  calculateRanking(predictions, matches) {
    // Agrupa palpites por participante
    const participantMap = new Map();

    for (const prediction of predictions) {
      const name = prediction.participantName;
      if (!participantMap.has(name)) {
        participantMap.set(name, []);
      }
      participantMap.get(name).push(prediction);
    }

    // Calcula score de cada participante
    const scores = [];

    for (const [name, participantPredictions] of participantMap) {
      let correctPredictions = 0;
      const details = [];

      for (const prediction of participantPredictions) {
        // Normaliza os nomes dos times para o padrão da API
        const normalizedHome = TEAM_NAME_MAP[prediction.homeTeam] || prediction.homeTeam;
        const normalizedAway = TEAM_NAME_MAP[prediction.awayTeam] || prediction.awayTeam;

        // Encontra a partida correspondente ao palpite
        const match = matches.find(
          m => m.homeTeam === normalizedHome && m.awayTeam === normalizedAway
        );

        if (match) {
          const isCorrect = this._isExactMatch(prediction, match);
          if (isCorrect) {
            correctPredictions++;
          }

          details.push({
            homeTeam: prediction.homeTeam,
            awayTeam: prediction.awayTeam,
            predictedHome: prediction.homeScore,
            predictedAway: prediction.awayScore,
            actualHome: match.homeScore,
            actualAway: match.awayScore,
            isCorrect,
            matchStatus: match.status,
          });
        } else {
          // Partida não encontrada nos resultados
          details.push({
            homeTeam: prediction.homeTeam,
            awayTeam: prediction.awayTeam,
            predictedHome: prediction.homeScore,
            predictedAway: prediction.awayScore,
            actualHome: null,
            actualAway: null,
            isCorrect: false,
            matchStatus: 'UNKNOWN',
          });
        }
      }

      scores.push({
        name,
        correctPredictions,
        totalPredictions: participantPredictions.length,
        details,
      });
    }

    return this._sortRanking(scores);
  }

  /**
   * Compara um palpite individual com o resultado da partida.
   * Um acerto ocorre quando o placar previsto é exatamente igual ao placar final
   * e a partida está finalizada.
   *
   * @param {import('../services/sheets-service.js').Prediction} prediction - Palpite do participante
   * @param {import('../services/football-api-service.js').MatchResult} match - Resultado da partida
   * @returns {boolean} true se o palpite acertou o placar exato
   */
  _isExactMatch(prediction, match) {
    // Só conta acerto se a partida estiver finalizada
    if (match.status !== 'FINISHED') {
      return false;
    }

    // Scores devem ser não-nulos para comparação
    if (match.homeScore === null || match.awayScore === null) {
      return false;
    }

    return (
      prediction.homeScore === match.homeScore &&
      prediction.awayScore === match.awayScore
    );
  }

  /**
   * Ordena os participantes no ranking:
   * 1. Decrescente por quantidade de acertos (correctPredictions)
   * 2. Em caso de empate, ordem alfabética pelo nome
   *
   * @param {ParticipantScore[]} scores - Lista de scores a ordenar
   * @returns {ParticipantScore[]} Lista ordenada
   */
  _sortRanking(scores) {
    return [...scores].sort((a, b) => {
      // Primeiro critério: mais acertos primeiro (decrescente)
      if (b.correctPredictions !== a.correctPredictions) {
        return b.correctPredictions - a.correctPredictions;
      }
      // Segundo critério: ordem alfabética pelo nome (crescente)
      return a.name.localeCompare(b.name);
    });
  }
}

export { RankingEngine };
