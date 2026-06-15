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
 * @property {string} name
 * @property {number} correctPredictions
 * @property {number} totalPredictions
 * @property {PredictionDetail[]} details
 */

/**
 * @typedef {Object} MatchResult
 * @property {number} id
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {number|null} homeScore
 * @property {number|null} awayScore
 * @property {string} status
 * @property {string} utcDate
 * @property {number} matchday
 */

/**
 * UIRenderer - Renderiza o ranking e os detalhes na interface.
 */
export class UIRenderer {
  /**
   * @param {HTMLElement} containerElement - Elemento principal (#app)
   */
  constructor(containerElement) {
    this.container = containerElement;
    this.loadingEl = document.getElementById('loading');
    this.errorEl = document.getElementById('error');
    this.rankingSection = document.getElementById('ranking');
    this.rankingTable = document.getElementById('ranking-table');
    this.matchListSection = document.getElementById('match-list');
    this.matchesContent = document.getElementById('matches-content');

    // Modal
    this.modal = document.getElementById('modal');
    this.modalBody = this.modal.querySelector('.modal-body');
    this.modal.querySelector('.modal-close').addEventListener('click', () => this._closeModal());
    this.modal.querySelector('.modal-backdrop').addEventListener('click', () => this._closeModal());
  }

  /**
   * Renderiza o ranking principal.
   * @param {ParticipantScore[]} ranking
   */
  renderRanking(ranking) {
    this._hideLoading();
    this._hideError();

    const table = document.createElement('table');
    table.classList.add('ranking-table');
    table.setAttribute('role', 'table');
    table.setAttribute('aria-label', 'Ranking do Bolão');

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th scope="col">#</th>
        <th scope="col">Participante</th>
        <th scope="col">Pts</th>
        <th scope="col">Exatos</th>
        <th scope="col">Campeão</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    let position = 1;
    for (let i = 0; i < ranking.length; i++) {
      const participant = ranking[i];
      if (i > 0 && participant.totalPoints < ranking[i - 1].totalPoints) {
        position = i + 1;
      }

      const row = document.createElement('tr');
      row.classList.add('ranking-row');
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-label', `Ver detalhes de ${participant.name}`);
      row.dataset.participant = participant.name;

      row.innerHTML = `
        <td class="ranking-position">${position}</td>
        <td class="ranking-name">${this._escapeHtml(participant.name)}</td>
        <td class="ranking-score">${participant.totalPoints}</td>
        <td class="ranking-exact">${participant.exactPredictions}</td>
        <td class="ranking-champion">${participant.championPick ? this._escapeHtml(participant.championPick) : '-'}</td>
      `;

      row.addEventListener('click', () => {
        this.renderParticipantDetails(participant);
      });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.renderParticipantDetails(participant);
        }
      });

      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    this.rankingTable.innerHTML = '';
    this.rankingTable.appendChild(table);

    // Botão de compartilhar ranking como imagem
    const shareBtn = document.createElement('button');
    shareBtn.classList.add('share-btn');
    shareBtn.textContent = '📷 Compartilhar Ranking';
    shareBtn.addEventListener('click', () => this._shareRankingAsImage());
    this.rankingTable.appendChild(shareBtn);

    this.rankingSection.hidden = false;
  }

  /**
   * Renderiza os detalhes de um participante selecionado (em modal).
   * @param {ParticipantScore} participant
   */
  renderParticipantDetails(participant) {
    const championInfo = participant.championPick
      ? `<p class="details-champion">🏆 Campeão: ${this._escapeHtml(participant.championPick)} ${participant.championPoints > 0 ? '(+10 pts ✅)' : ''}</p>`
      : '';

    let html = `
      <h3>${this._escapeHtml(participant.name)}</h3>
      <p class="details-summary">
        <strong>${participant.totalPoints}</strong> ponto${participant.totalPoints !== 1 ? 's' : ''} 
        — ${participant.exactPredictions} placar exato, ${participant.winnerPredictions} acertos parciais
      </p>
      ${championInfo}
      <ul class="predictions-list">
    `;

    for (const detail of participant.details) {
      const isPending = detail.pointType === 'pending';
      let cssClass = 'prediction-pending';
      if (!isPending) {
        if (detail.pointType === 'exact') cssClass = 'prediction-correct';
        else if (detail.pointType === 'winner') cssClass = 'prediction-partial';
        else if (detail.pointType === 'one_score') cssClass = 'prediction-one-score';
        else cssClass = 'prediction-wrong';
      }

      const indicators = { 'exact': '✅', 'winner': '🟡', 'one_score': '🔵', 'miss': '❌', 'pending': '⏳' };
      const indicator = indicators[detail.pointType] || '⏳';
      const pointsLabel = { 'exact': '+5', 'winner': '+3', 'one_score': '+1', 'miss': '0', 'pending': '-' };

      const actualScore = !isPending
        ? `${detail.actualHome} x ${detail.actualAway}`
        : 'Aguardando';

      html += `
        <li class="prediction-item ${cssClass}">
          <span class="prediction-indicator" aria-hidden="true">${indicator}</span>
          <span class="prediction-match">${this._escapeHtml(detail.homeTeam)} vs ${this._escapeHtml(detail.awayTeam)}</span>
          <span class="prediction-score">Palpite: ${detail.predictedHome} x ${detail.predictedAway}</span>
          <span class="prediction-actual">Real: ${actualScore}</span>
          <span class="prediction-points">${pointsLabel[detail.pointType]}</span>
        </li>
      `;
    }

    html += '</ul>';
    this._openModal(html);
  }

  /**
   * Renderiza a lista de partidas com abas (Finalizadas / Próximas).
   * @param {MatchResult[]} matches
   * @param {Prediction[]|null} predictions
   */
  renderMatchList(matches, predictions = null) {
    this._predictions = predictions;
    const finished = matches.filter(m => m.status === 'FINISHED' && m.homeScore !== null);
    const upcoming = matches.filter(m => m.status !== 'FINISHED' || m.homeScore === null);

    // Container de abas
    const tabs = document.createElement('div');
    tabs.classList.add('match-tabs');
    tabs.innerHTML = `
      <button class="match-tab active" data-tab="finished">Finalizadas (${finished.length})</button>
      <button class="match-tab" data-tab="upcoming">Próximas (${upcoming.length})</button>
    `;

    const finishedList = this._createMatchList(finished);
    const upcomingList = this._createMatchList(upcoming);
    upcomingList.hidden = true;

    // Event listeners das abas
    tabs.querySelectorAll('.match-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.querySelectorAll('.match-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (btn.dataset.tab === 'finished') {
          finishedList.hidden = false;
          upcomingList.hidden = true;
        } else {
          finishedList.hidden = true;
          upcomingList.hidden = false;
        }
      });
    });

    this.matchesContent.innerHTML = '';
    this.matchesContent.appendChild(tabs);
    this.matchesContent.appendChild(finishedList);
    this.matchesContent.appendChild(upcomingList);
    this.matchListSection.hidden = false;
  }

  /**
   * Cria uma lista UL de partidas.
   * @param {MatchResult[]} matches
   * @returns {HTMLUListElement}
   */
  _createMatchList(matches) {
    const list = document.createElement('ul');
    list.classList.add('match-list');

    if (matches.length === 0) {
      const empty = document.createElement('li');
      empty.classList.add('match-item');
      empty.innerHTML = '<span class="match-teams">Nenhuma partida</span>';
      list.appendChild(empty);
      return list;
    }

    for (const match of matches) {
      const item = document.createElement('li');
      item.classList.add('match-item');
      item.style.cursor = 'pointer';

      const isFinished = match.status === 'FINISHED' && match.homeScore !== null;
      const scoreDisplay = isFinished
        ? `${match.homeScore} x ${match.awayScore}`
        : this._getStatusLabel(match.status);

      const dateStr = this._formatDate(match.utcDate);

      item.innerHTML = `
        <span class="match-teams">${this._escapeHtml(match.homeTeam || 'A definir')} vs ${this._escapeHtml(match.awayTeam || 'A definir')}</span>
        <span class="match-score ${isFinished ? 'score-final' : 'score-pending'}">${scoreDisplay}</span>
        <span class="match-info">${dateStr}</span>
      `;

      // Ao clicar, mostra palpites de todos para esse jogo
      if (match.homeTeam && match.awayTeam) {
        item.addEventListener('click', () => this._showMatchPredictions(match));
      }

      list.appendChild(item);
    }

    return list;
  }

  /**
   * Mostra os palpites de todos os participantes para uma partida.
   * @param {MatchResult} match
   */
  _showMatchPredictions(match) {
    if (!this._predictions || this._predictions.length === 0) return;

    const predictions = this._predictions;

    // Busca palpites que correspondem a essa partida
    const matchPredictions = [];
    const normalizedMatchHome = this._normalizeTeamName(match.homeTeam);
    const normalizedMatchAway = this._normalizeTeamName(match.awayTeam);

    for (const p of predictions) {
      const normalizedPredHome = this._normalizeTeamName(p.homeTeam);
      const normalizedPredAway = this._normalizeTeamName(p.awayTeam);
      if (normalizedPredHome === normalizedMatchHome && normalizedPredAway === normalizedMatchAway) {
        matchPredictions.push(p);
      }
    }

    const isFinished = match.status === 'FINISHED' && match.homeScore !== null;
    const resultText = isFinished ? `Resultado: ${match.homeScore} x ${match.awayScore}` : 'Aguardando resultado';

    let html = `
      <h3>${this._escapeHtml(match.homeTeam)} vs ${this._escapeHtml(match.awayTeam)}</h3>
      <p class="details-summary">${resultText}</p>
      <ul class="predictions-list">
    `;

    if (matchPredictions.length === 0) {
      html += '<li class="prediction-item"><span class="prediction-match">Nenhum palpite encontrado</span></li>';
    } else {
      for (const p of matchPredictions) {
        let indicator = '⏳';
        let cssClass = 'prediction-pending';

        if (isFinished) {
          if (p.homeScore === match.homeScore && p.awayScore === match.awayScore) {
            indicator = '✅'; cssClass = 'prediction-correct';
          } else {
            const predResult = Math.sign(p.homeScore - p.awayScore);
            const actResult = Math.sign(match.homeScore - match.awayScore);
            if (predResult === actResult) {
              indicator = '🟡'; cssClass = 'prediction-partial';
            } else if (p.homeScore === match.homeScore || p.awayScore === match.awayScore) {
              indicator = '🔵'; cssClass = 'prediction-one-score';
            } else {
              indicator = '❌'; cssClass = 'prediction-wrong';
            }
          }
        }

        html += `
          <li class="prediction-item ${cssClass}">
            <span class="prediction-indicator" aria-hidden="true">${indicator}</span>
            <span class="prediction-match">${this._escapeHtml(p.participantName)}</span>
            <span class="prediction-score">${p.homeScore} x ${p.awayScore}</span>
          </li>
        `;
      }
    }

    html += '</ul>';
    this._openModal(html);
  }

  /**
   * Normaliza nome de time PT-BR para inglês (para matching).
   */
  _normalizeTeamName(name) {
    const map = {
      'México': 'Mexico', 'África do Sul': 'South Africa', 'Coreia do Sul': 'South Korea',
      'República Tcheca': 'Czechia', 'Bósnia': 'Bosnia-Herzegovina', 'Estados Unidos': 'United States',
      'Suíça': 'Switzerland', 'Escócia': 'Scotland', 'Austrália': 'Australia', 'Alemanha': 'Germany',
      'Curaçao': 'Curaçao', 'Costa do Marfim': 'Ivory Coast', 'Equador': 'Ecuador',
      'Holanda': 'Netherlands', 'Japão': 'Japan', 'Suécia': 'Sweden', 'Tunísia': 'Tunisia',
      'Espanha': 'Spain', 'Cabo Verde': 'Cape Verde Islands', 'Arábia Saudita': 'Saudi Arabia',
      'Uruguai': 'Uruguay', 'Bélgica': 'Belgium', 'Egito': 'Egypt', 'Irã': 'Iran',
      'Nova Zelândia': 'New Zealand', 'França': 'France', 'Iraque': 'Iraq', 'Noruega': 'Norway',
      'Argentina': 'Argentina', 'Argélia': 'Algeria', 'Áustria': 'Austria', 'Jordânia': 'Jordan',
      'Portugal': 'Portugal', 'RD Congo': 'Congo DR', 'Inglaterra': 'England', 'Croácia': 'Croatia',
      'Gana': 'Ghana', 'Panamá': 'Panama', 'Uzbequistão': 'Uzbekistan', 'Colômbia': 'Colombia',
      'Turquia': 'Turkey', 'Paraguai': 'Paraguay', 'Marrocos': 'Morocco', 'Brasil': 'Brazil',
      'Haiti': 'Haiti', 'Canadá': 'Canada', 'Catar': 'Qatar', 'Senegal': 'Senegal',
      'Türkiye': 'Turkey',
      'Cape Verde': 'Cape Verde Islands',
    };
    return map[name] || name;
  }

  /**
   * Exibe mensagem de erro.
   * @param {string} message
   */
  renderError(message) {
    this._hideLoading();
    this.errorEl.innerHTML = `<p>${this._escapeHtml(message)}</p>`;
    this.errorEl.hidden = false;
    this.errorEl.setAttribute('role', 'alert');
  }

  /**
   * Exibe estado de carregamento.
   */
  renderLoading() {
    this._hideError();
    this.rankingSection.hidden = true;
    this.matchListSection.hidden = true;
    this.loadingEl.hidden = false;
  }

  // --- Private helpers ---

  _openModal(html) {
    this.modalBody.innerHTML = html;
    this.modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  _closeModal() {
    this.modal.hidden = true;
    document.body.style.overflow = '';
  }

  _hideLoading() {
    this.loadingEl.hidden = true;
  }

  _hideError() {
    this.errorEl.hidden = true;
  }

  /**
   * Escapa HTML para prevenir XSS.
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Formata data UTC para exibição local.
   * @param {string} utcDate
   * @returns {string}
   */
  _formatDate(utcDate) {
    try {
      const date = new Date(utcDate);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return utcDate;
    }
  }

  /**
   * Retorna label em português para o status da partida.
   * @param {string} status
   * @returns {string}
   */
  _getStatusLabel(status) {
    const labels = {
      'SCHEDULED': 'Agendada',
      'IN_PLAY': 'Em andamento',
      'PAUSED': 'Intervalo',
      'POSTPONED': 'Adiada',
      'CANCELLED': 'Cancelada',
      'SUSPENDED': 'Suspensa',
      'AWARDED': 'W.O.',
      'FINISHED': 'Finalizada'
    };
    return labels[status] || status;
  }

  /**
   * Gera imagem PNG do ranking e oferece para download/compartilhamento.
   */
  async _shareRankingAsImage() {
    const table = this.rankingTable.querySelector('.ranking-table');
    if (!table) return;

    // Carrega html2canvas dinamicamente
    if (!window.html2canvas) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      document.head.appendChild(script);
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
    }

    // Cria container temporário com estilo para a imagem
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding: 20px; background: #f8f9fa; width: fit-content;';
    wrapper.innerHTML = `
      <div style="background: #1a5276; color: white; padding: 12px 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <strong>⚽ Bolão Copa do Mundo 2026</strong>
        <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${new Date().toLocaleDateString('pt-BR')}</div>
      </div>
    `;
    const tableClone = table.cloneNode(true);
    tableClone.style.borderRadius = '0 0 8px 8px';
    wrapper.appendChild(tableClone);
    document.body.appendChild(wrapper);

    try {
      const canvas = await window.html2canvas(wrapper, { scale: 2, backgroundColor: '#f8f9fa' });
      document.body.removeChild(wrapper);

      // Tenta usar a Web Share API (mobile)
      if (navigator.share && navigator.canShare) {
        canvas.toBlob(async (blob) => {
          const file = new File([blob], 'ranking-bolao.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Ranking Bolão Copa do Mundo' });
          } else {
            this._downloadCanvas(canvas);
          }
        });
      } else {
        this._downloadCanvas(canvas);
      }
    } catch {
      document.body.removeChild(wrapper);
      alert('Erro ao gerar imagem. Tente novamente.');
    }
  }

  /**
   * Faz download do canvas como PNG.
   * @param {HTMLCanvasElement} canvas
   */
  _downloadCanvas(canvas) {
    const link = document.createElement('a');
    link.download = 'ranking-bolao.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
}
