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
    this.detailsSection = document.getElementById('participant-details');
    this.detailsContent = document.getElementById('details-content');
    this.matchListSection = document.getElementById('match-list');
    this.matchesContent = document.getElementById('matches-content');
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
   * Renderiza os detalhes de um participante selecionado.
   * @param {ParticipantScore} participant
   */
  renderParticipantDetails(participant) {
    const header = document.createElement('div');
    header.classList.add('details-header');

    const championInfo = participant.championPick
      ? `<p class="details-champion">🏆 Campeão: ${this._escapeHtml(participant.championPick)} ${participant.championPoints > 0 ? '(+10 pts ✅)' : ''}</p>`
      : '';

    header.innerHTML = `
      <h3>${this._escapeHtml(participant.name)}</h3>
      <p class="details-summary">
        <strong>${participant.totalPoints}</strong> ponto${participant.totalPoints !== 1 ? 's' : ''} 
        — ${participant.exactPredictions} placar exato, ${participant.winnerPredictions} acertos parciais
      </p>
      ${championInfo}
    `;

    const list = document.createElement('ul');
    list.classList.add('predictions-list');
    list.setAttribute('aria-label', `Palpites de ${participant.name}`);

    for (const detail of participant.details) {
      const item = document.createElement('li');
      item.classList.add('prediction-item');

      const isPending = detail.pointType === 'pending';

      if (!isPending) {
        if (detail.pointType === 'exact') item.classList.add('prediction-correct');
        else if (detail.pointType === 'winner') item.classList.add('prediction-partial');
        else if (detail.pointType === 'one_score') item.classList.add('prediction-one-score');
        else item.classList.add('prediction-wrong');
      } else {
        item.classList.add('prediction-pending');
      }

      const indicators = {
        'exact': '✅',
        'winner': '🟡',
        'one_score': '🔵',
        'miss': '❌',
        'pending': '⏳',
      };
      const indicator = indicators[detail.pointType] || '⏳';

      const pointsLabel = {
        'exact': '+5',
        'winner': '+3',
        'one_score': '+1',
        'miss': '0',
        'pending': '-',
      };

      const actualScore = !isPending
        ? `${detail.actualHome} x ${detail.actualAway}`
        : 'Aguardando';

      item.innerHTML = `
        <span class="prediction-indicator" aria-hidden="true">${indicator}</span>
        <span class="prediction-match">${this._escapeHtml(detail.homeTeam)} vs ${this._escapeHtml(detail.awayTeam)}</span>
        <span class="prediction-score">Palpite: ${detail.predictedHome} x ${detail.predictedAway}</span>
        <span class="prediction-actual">Real: ${actualScore}</span>
        <span class="prediction-points">${pointsLabel[detail.pointType]}</span>
        <span class="sr-only">${detail.pointType === 'exact' ? 'Placar exato' : detail.pointType === 'winner' ? 'Acertou vencedor' : detail.pointType === 'one_score' ? 'Acertou gols de um time' : detail.pointType === 'miss' ? 'Errou' : 'Pendente'}</span>
      `;

      list.appendChild(item);
    }

    this.detailsContent.innerHTML = '';
    this.detailsContent.appendChild(header);
    this.detailsContent.appendChild(list);
    this.detailsSection.hidden = false;
  }

  /**
   * Renderiza a lista de partidas com placares.
   * @param {MatchResult[]} matches
   */
  renderMatchList(matches) {
    const list = document.createElement('ul');
    list.classList.add('match-list');
    list.setAttribute('aria-label', 'Lista de partidas');

    for (const match of matches) {
      const item = document.createElement('li');
      item.classList.add('match-item');

      const isFinished = match.status === 'FINISHED';
      const scoreDisplay = isFinished
        ? `${match.homeScore} x ${match.awayScore}`
        : this._getStatusLabel(match.status);

      const dateStr = this._formatDate(match.utcDate);

      item.innerHTML = `
        <span class="match-teams">${this._escapeHtml(match.homeTeam)} vs ${this._escapeHtml(match.awayTeam)}</span>
        <span class="match-score ${isFinished ? 'score-final' : 'score-pending'}">${scoreDisplay}</span>
        <span class="match-info">Rodada ${match.matchday} • ${dateStr}</span>
      `;

      list.appendChild(item);
    }

    this.matchesContent.innerHTML = '';
    this.matchesContent.appendChild(list);
    this.matchListSection.hidden = false;
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
    this.detailsSection.hidden = true;
    this.matchListSection.hidden = true;
    this.loadingEl.hidden = false;
  }

  // --- Private helpers ---

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
