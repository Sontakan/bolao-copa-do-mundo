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
        // Encontra a partida correspondente ao palpite
        const match = matches.find(
          m => m.homeTeam === prediction.homeTeam && m.awayTeam === prediction.awayTeam
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
