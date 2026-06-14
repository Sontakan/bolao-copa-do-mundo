/**
 * @typedef {Object} PredictionDetail
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {number} predictedHome
 * @property {number} predictedAway
 * @property {number|null} actualHome
 * @property {number|null} actualAway
 * @property {number} points - Pontos ganhos nesse palpite (0, 3 ou 5)
 * @property {string} pointType - 'exact', 'winner', 'miss' ou 'pending'
 * @property {string} matchStatus
 */

/**
 * @typedef {Object} ParticipantScore
 * @property {string} name - Nome do participante
 * @property {number} totalPoints - Pontuação total
 * @property {number} exactPredictions - Quantidade de placares exatos (5pts)
 * @property {number} winnerPredictions - Quantidade de acertos de vencedor (3pts)
 * @property {number} championPoints - Pontos do campeão (0 ou 10)
 * @property {string|null} championPick - Campeão escolhido pelo participante
 * @property {number} totalPredictions - Total de palpites válidos
 * @property {PredictionDetail[]} details - Detalhes de cada palpite
 */

/**
 * Pontuação do bolão:
 * - Placar exato: 5 pontos
 * - Acertou vencedor/empate mas errou placar: 3 pontos
 * - Acertou gols de um time (mas não o placar exato nem vencedor): 1 ponto
 * - Acertou o campeão: 10 pontos
 * - Errou resultado: 0 pontos
 */
const POINTS = {
  EXACT: 5,
  WINNER: 3,
  ONE_SCORE: 1,
  CHAMPION: 10,
  MISS: 0,
};

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
 * Nomes alternativos usados pela ESPN que diferem do football-data.org.
 * Mapeia nome ESPN → nome canônico usado no TEAM_NAME_MAP.
 */
const TEAM_ALIASES = {
  'Türkiye': 'Turkey',
  'Korea Republic': 'South Korea',
  'IR Iran': 'Iran',
  'Congo DR': 'Congo DR',
  'Cape Verde Islands': 'Cape Verde Islands',
  'Cabo Verde': 'Cape Verde Islands',
};

/**
 * Normaliza nome de time para comparação.
 */
function normalizeTeamName(name) {
  // Primeiro tenta o mapa PT-BR → inglês
  if (TEAM_NAME_MAP[name]) return TEAM_NAME_MAP[name];
  // Depois tenta aliases da ESPN
  if (TEAM_ALIASES[name]) return TEAM_ALIASES[name];
  return name;
}

/**
 * Motor de cálculo de ranking do bolão.
 * Compara palpites dos participantes com os resultados reais das partidas
 * e produz um ranking ordenado.
 */
class RankingEngine {
  /**
   * Calcula o ranking completo comparando palpites com resultados de partidas.
   *
   * @param {import('../services/sheets-service.js').Prediction[]} predictions - Lista de palpites
   * @param {import('../services/football-api-service.js').MatchResult[]} matches - Lista de partidas
   * @param {Map<string, string>} [championPicks] - Mapa de participante -> campeão escolhido
   * @param {string|null} [actualChampion] - Campeão real (null se copa não acabou)
   * @returns {ParticipantScore[]} Ranking ordenado
   */
  calculateRanking(predictions, matches, championPicks = new Map(), actualChampion = null) {
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
      let totalPoints = 0;
      let exactPredictions = 0;
      let winnerPredictions = 0;
      const details = [];

      for (const prediction of participantPredictions) {
        // Normaliza os nomes dos times para o padrão da API
        const normalizedHome = normalizeTeamName(prediction.homeTeam);
        const normalizedAway = normalizeTeamName(prediction.awayTeam);

        // Encontra a partida correspondente ao palpite
        const match = matches.find(
          m => normalizeTeamName(m.homeTeam) === normalizedHome && normalizeTeamName(m.awayTeam) === normalizedAway
        );

        if (match && match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null) {
          const result = this._calculatePoints(prediction, match);
          totalPoints += result.points;

          if (result.pointType === 'exact') exactPredictions++;
          if (result.pointType === 'winner') winnerPredictions++;

          details.push({
            homeTeam: prediction.homeTeam,
            awayTeam: prediction.awayTeam,
            predictedHome: prediction.homeScore,
            predictedAway: prediction.awayScore,
            actualHome: match.homeScore,
            actualAway: match.awayScore,
            points: result.points,
            pointType: result.pointType,
            matchStatus: match.status,
          });
        } else {
          details.push({
            homeTeam: prediction.homeTeam,
            awayTeam: prediction.awayTeam,
            predictedHome: prediction.homeScore,
            predictedAway: prediction.awayScore,
            actualHome: match ? match.homeScore : null,
            actualAway: match ? match.awayScore : null,
            points: 0,
            pointType: 'pending',
            matchStatus: match ? match.status : 'UNKNOWN',
          });
        }
      }

      // Pontuação do campeão
      let championPoints = 0;
      const championPick = championPicks.get(name) || null;
      if (actualChampion && championPick) {
        const normalizedPick = TEAM_NAME_MAP[championPick] || championPick;
        if (normalizedPick === actualChampion) {
          championPoints = POINTS.CHAMPION;
          totalPoints += championPoints;
        }
      }

      scores.push({
        name,
        totalPoints,
        exactPredictions,
        winnerPredictions,
        championPoints,
        championPick,
        totalPredictions: participantPredictions.length,
        details,
      });
    }

    return this._sortRanking(scores);
  }

  /**
   * Calcula pontos de um palpite individual.
   * - Placar exato: 5 pontos
   * - Acertou vencedor/empate: 3 pontos
   * - Acertou gols de um time: 1 ponto
   * - Errou: 0 pontos
   *
   * @param {import('../services/sheets-service.js').Prediction} prediction
   * @param {import('../services/football-api-service.js').MatchResult} match
   * @returns {{points: number, pointType: string}}
   */
  _calculatePoints(prediction, match) {
    // Placar exato (incluindo empates com mesma quantidade de gols)
    if (prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore) {
      return { points: POINTS.EXACT, pointType: 'exact' };
    }

    // Acertou o vencedor ou empate (mas errou o placar)
    const predictedResult = Math.sign(prediction.homeScore - prediction.awayScore);
    const actualResult = Math.sign(match.homeScore - match.awayScore);

    if (predictedResult === actualResult) {
      return { points: POINTS.WINNER, pointType: 'winner' };
    }

    // Acertou gols de pelo menos um time
    if (prediction.homeScore === match.homeScore || prediction.awayScore === match.awayScore) {
      return { points: POINTS.ONE_SCORE, pointType: 'one_score' };
    }

    return { points: POINTS.MISS, pointType: 'miss' };
  }

  /**
   * Ordena os participantes no ranking:
   * 1. Decrescente por pontuação total
   * 2. Desempate: mais placares exatos
   * 3. Desempate: ordem alfabética
   *
   * @param {ParticipantScore[]} scores
   * @returns {ParticipantScore[]}
   */
  _sortRanking(scores) {
    return [...scores].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      if (b.exactPredictions !== a.exactPredictions) {
        return b.exactPredictions - a.exactPredictions;
      }
      return a.name.localeCompare(b.name);
    });
  }
}

export { RankingEngine, POINTS, TEAM_NAME_MAP };
