/**
 * T-Rex Runner App - SPA Logic
 * Manages screen transitions, API calls, and game integration.
 */

// ── State ──────────────────────────────────────────────────────
let state = {
  playerId: null,
  playerName: '',
  currentScore: 0,
};

let gameInstance = null;

// ── Screen Management ──────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${id}`).classList.add('active');
}

// ── API Helpers ────────────────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Load Stats ─────────────────────────────────────────────────
async function loadStats() {
  try {
    const s = await api('GET', '/api/stats');
    document.getElementById('stat-players').textContent = `${s.total_players} jogadores`;
    document.getElementById('stat-games').textContent = `${s.total_games} partidas`;
    document.getElementById('stat-winrate').textContent = `${s.win_rate}% vitórias`;
  } catch (e) {
    // Stats are non-critical, silently fail
  }
}

// ── Registration ───────────────────────────────────────────────
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const company = document.getElementById('company').value.trim();

  if (!name || !email) return;

  const btn = e.target.querySelector('button');
  btn.textContent = 'CARREGANDO...';
  btn.disabled = true;

  try {
    const data = await api('POST', '/api/register', { name, email, company });
    state.playerId = data.player_id;
    state.playerName = data.name;
    startGame();
  } catch (err) {
    alert('Falha no cadastro. Tente novamente.');
    btn.textContent = 'INICIAR JOGO';
    btn.disabled = false;
  }
});

// ── Game ───────────────────────────────────────────────────────
function startGame() {
  showScreen('game');
  document.getElementById('player-label').textContent = `Jogador: ${state.playerName}`;

  const canvas = document.getElementById('game-canvas');
  if (gameInstance) gameInstance.destroy();

  gameInstance = new TRexGame(canvas, onGameOver);
  gameInstance.start();
}

async function onGameOver(score) {
  state.currentScore = score;
  if (gameInstance) {
    gameInstance.destroy();
    gameInstance = null;
  }
  await showAiPlaying(score);
}

// ── AI Playing Animation ───────────────────────────────────────
async function showAiPlaying(humanScore) {
  showScreen('ai');

  // Submit score to backend (AI score + commentary generated server-side)
  const resultPromise = api('POST', '/api/score', {
    player_id: state.playerId,
    player_name: state.playerName,
    score: humanScore,
  });

  // Run AI animation while waiting for API
  const aiCanvas = document.getElementById('ai-canvas');
  const ctx = aiCanvas.getContext('2d');
  aiCanvas.width = 800;
  aiCanvas.height = 200;

  const progress = document.getElementById('ai-progress');
  const scoreDisp = document.getElementById('ai-score-display');

  let frame = 0;
  const totalFrames = 180; // ~3 seconds at 60fps
  let aiAnimScore = 0;
  let groundOffset = 0;

  function animateAi() {
    frame++;
    const pct = Math.min(frame / totalFrames * 100, 100);
    progress.style.width = pct + '%';

    // Fast-scrolling ground and obstacles
    groundOffset = (groundOffset + 12) % 20;
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(0, 0, 800, 200);

    // Ground
    ctx.strokeStyle = '#535353';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 165);
    ctx.lineTo(800, 165);
    ctx.stroke();

    // Running dino
    const dinoSprite = frame % 8 < 4 ? 'dinoRun1' : 'dinoRun2';
    drawAiSprite(ctx, dinoSprite, 50, 122);

    // Speed-blurred obstacles (just vertical lines flying by)
    ctx.fillStyle = '#535353';
    for (let i = 0; i < 5; i++) {
      const ox = ((800 - (frame * 15 + i * 180)) % 1000 + 1000) % 1000 - 100;
      if (ox > 100 && ox < 800) {
        ctx.fillRect(ox, 130, 6, 35);
        ctx.fillRect(ox - 4, 140, 4, 15);
        ctx.fillRect(ox + 6, 138, 4, 12);
      }
    }

    // Score climbing
    aiAnimScore = Math.floor(pct / 100 * 999);
    scoreDisp.textContent = String(aiAnimScore).padStart(5, '0');

    if (frame < totalFrames) {
      requestAnimationFrame(animateAi);
    }
  }

  requestAnimationFrame(animateAi);

  // Wait for both animation and API response
  const result = await resultPromise;

  // Ensure minimum animation time
  await new Promise(r => setTimeout(r, Math.max(0, 3200 - frame * 16)));

  // Update final AI score display
  scoreDisp.textContent = String(result.ai_score).padStart(5, '0');
  progress.style.width = '100%';

  await new Promise(r => setTimeout(r, 500));
  showResults(result);
}

// Minimal sprite renderer for AI animation
function drawAiSprite(ctx, name, x, y) {
  const sprites = {
    dinoRun1: [
      '......####..',
      '.....#.####.',
      '.....######.',
      '.....###....',
      '.#..########',
      '##.########.',
      '###.#######.',
      '.##########.',
      '..#########.',
      '...#######..',
      '....#####...',
      '.....###....',
      '.....#.#....',
      '....#...#...',
    ],
    dinoRun2: [
      '......####..',
      '.....#.####.',
      '.....######.',
      '.....###....',
      '.#..########',
      '##.########.',
      '###.#######.',
      '.##########.',
      '..#########.',
      '...#######..',
      '....#####...',
      '.....###....',
      '.....#..#...',
      '.....#..#...',
    ],
  };
  const spr = sprites[name];
  if (!spr) return;
  ctx.fillStyle = '#535353';
  for (let r = 0; r < spr.length; r++) {
    for (let c = 0; c < spr[r].length; c++) {
      if (spr[r][c] === '#') {
        ctx.fillRect(x + c * 3, y + r * 3, 3, 3);
      }
    }
  }
}

// ── Results Screen ─────────────────────────────────────────────
function showResults(result) {
  showScreen('results');

  const banner = document.getElementById('result-banner');
  const humanScoreEl = document.getElementById('result-human-score');
  const aiScoreEl = document.getElementById('result-ai-score');
  const commentary = document.getElementById('llm-commentary');
  const swag = document.getElementById('swag-banner');

  humanScoreEl.textContent = result.human_score;
  aiScoreEl.textContent = result.ai_score;
  commentary.textContent = result.commentary;

  if (result.human_won) {
    banner.textContent = 'VOCÊ VENCEU!';
    banner.className = 'result-banner win';
    swag.classList.remove('hidden');
  } else {
    banner.textContent = 'A IA VENCEU!';
    banner.className = 'result-banner lose';
    swag.classList.add('hidden');
  }

  // Animate score counting up
  animateCount(humanScoreEl, 0, result.human_score, 1000);
  animateCount(aiScoreEl, 0, result.ai_score, 1000);
}

function animateCount(el, from, to, duration) {
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const pct = Math.min(elapsed / duration, 1);
    // Ease-out
    const val = Math.floor(from + (to - from) * (1 - Math.pow(1 - pct, 3)));
    el.textContent = val;
    if (pct < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Leaderboard ────────────────────────────────────────────────
document.getElementById('btn-leaderboard').addEventListener('click', () => {
  showLeaderboard();
});

async function showLeaderboard() {
  showScreen('leaderboard');
  try {
    const data = await api('GET', '/api/leaderboard');
    renderLeaderboard(data);
  } catch (e) {
    console.error('Failed to load leaderboard', e);
  }
}

function renderLeaderboard(entries) {
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';

  entries.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (entry.name === state.playerName) tr.classList.add('highlight');

    const resultClass = entry.human_won ? 'badge-win' : 'badge-lose';
    const resultText = entry.human_won ? 'GANHOU' : 'PERDEU';

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(entry.name)}</td>
      <td>${escapeHtml(entry.company || '-')}</td>
      <td>${entry.score}</td>
      <td>${entry.ai_score}</td>
      <td><span class="${resultClass}">${resultText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Navigation Buttons ─────────────────────────────────────────
document.getElementById('btn-play-again').addEventListener('click', () => {
  resetForNextPlayer();
});

document.getElementById('btn-back-register').addEventListener('click', () => {
  resetForNextPlayer();
});

function resetForNextPlayer() {
  state = { playerId: null, playerName: '', currentScore: 0 };
  document.getElementById('register-form').reset();
  const btn = document.getElementById('register-form').querySelector('button');
  btn.textContent = 'INICIAR JOGO';
  btn.disabled = false;
  showScreen('register');
  loadStats();
}

// ── Genie Chat ────────────────────────────────────────────────
const genieFab = document.getElementById('genie-fab');
const geniePopup = document.getElementById('genie-popup');
const genieClose = document.getElementById('genie-close');
const genieInput = document.getElementById('genie-input');
const genieSend = document.getElementById('genie-send');
const genieMessages = document.getElementById('genie-messages');

let genieConversationId = null;

genieFab.addEventListener('click', () => {
  geniePopup.classList.toggle('hidden');
  if (!geniePopup.classList.contains('hidden')) {
    genieInput.focus();
  }
});

genieClose.addEventListener('click', () => {
  geniePopup.classList.add('hidden');
});

genieSend.addEventListener('click', () => sendGenieQuestion());
genieInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendGenieQuestion();
});

// Suggested question chips
document.querySelectorAll('.genie-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const q = chip.dataset.q;
    genieInput.value = q;
    sendGenieQuestion();
  });
});

async function sendGenieQuestion() {
  const question = genieInput.value.trim();
  if (!question) return;

  genieInput.value = '';
  genieSend.disabled = true;

  // Remove suggestion chips after first question
  const suggestions = genieMessages.querySelector('.genie-suggestions');
  if (suggestions) suggestions.remove();

  // Add user message
  appendGenieMsg(question, 'user');

  // Add loading indicator
  const loadingEl = appendGenieMsg('Consultando...', 'bot genie-msg-loading');

  try {
    const data = await api('POST', '/api/genie/ask', {
      question,
      conversation_id: genieConversationId,
    });

    loadingEl.remove();

    if (data.error) {
      appendGenieMsg(data.error, 'bot error');
    } else {
      genieConversationId = data.conversation_id || genieConversationId;
      renderGenieResponse(data);
    }
  } catch (e) {
    loadingEl.remove();
    appendGenieMsg('Erro na conexão. Tente novamente.', 'bot error');
  }

  genieSend.disabled = false;
  genieMessages.scrollTop = genieMessages.scrollHeight;
}

function appendGenieMsg(text, type) {
  const div = document.createElement('div');
  div.className = `genie-msg genie-msg-${type}`;
  div.textContent = text;
  genieMessages.appendChild(div);
  genieMessages.scrollTop = genieMessages.scrollHeight;
  return div;
}

function renderGenieResponse(data) {
  const wrapper = document.createElement('div');
  wrapper.className = 'genie-msg genie-msg-bot';

  // Text response
  if (data.text) {
    const p = document.createElement('div');
    p.textContent = data.text;
    wrapper.appendChild(p);
  }

  // Description
  if (data.description) {
    const desc = document.createElement('div');
    desc.textContent = data.description;
    desc.style.marginBottom = '6px';
    wrapper.appendChild(desc);
  }

  // Data table
  if (data.columns && data.data && data.data.length > 0) {
    const table = document.createElement('table');
    table.className = 'genie-data-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    data.columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.data.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell !== null ? cell : '-';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);

    if (!data.text && !data.description) {
      const info = document.createElement('div');
      info.textContent = `${data.data.length} resultado(s)`;
      info.style.marginTop = '6px';
      info.style.color = '#888';
      info.style.fontSize = '8px';
      wrapper.appendChild(info);
    }
  }

  // SQL toggle
  if (data.sql) {
    const sqlId = 'sql-' + Date.now();
    const toggle = document.createElement('button');
    toggle.className = 'genie-sql-toggle';
    toggle.textContent = 'Ver SQL';
    toggle.addEventListener('click', () => {
      const block = document.getElementById(sqlId);
      block.classList.toggle('visible');
      toggle.textContent = block.classList.contains('visible') ? 'Esconder SQL' : 'Ver SQL';
    });
    wrapper.appendChild(toggle);

    const sqlBlock = document.createElement('pre');
    sqlBlock.id = sqlId;
    sqlBlock.className = 'genie-sql-block';
    sqlBlock.textContent = data.sql;
    wrapper.appendChild(sqlBlock);
  }

  genieMessages.appendChild(wrapper);
  genieMessages.scrollTop = genieMessages.scrollHeight;
}

// ── Init ───────────────────────────────────────────────────────
loadStats();

// Auto-refresh leaderboard if on that screen
setInterval(() => {
  if (document.getElementById('screen-leaderboard').classList.contains('active')) {
    api('GET', '/api/leaderboard').then(renderLeaderboard).catch(() => {});
  }
}, 10000);
