/**
 * T-Rex Runner Game Engine
 * Chrome Dino game clone using HTML5 Canvas with pixel-art sprites.
 */

// ── Pixel-art sprite data ──────────────────────────────────────────────
// Each sprite is an array of strings; '#' = filled pixel, '.' = empty.
const P = 3; // pixel scale factor

const SPR = {
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
  dinoJump: [
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
    '.....#..#...',
  ],
  dinoDuck1: [
    '..........####..',
    '.........#.####.',
    '.........######.',
    '#####....###....',
    '########.######.',
    '.##############.',
    '..############..',
    '...###.###......',
    '...#.....#......',
  ],
  dinoDuck2: [
    '..........####..',
    '.........#.####.',
    '.........######.',
    '#####....###....',
    '########.######.',
    '.##############.',
    '..############..',
    '...###.###......',
    '....#.....#.....',
  ],
  dinoDead: [
    '......####..',
    '.....#X####.',
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
  cactusSmall: [
    '..##..',
    '..##..',
    '..##..',
    '..##..',
    '#.##..',
    '#.##.#',
    '#.##.#',
    '####.#',
    '.###.#',
    '..####',
    '..##..',
    '..##..',
    '..##..',
    '..##..',
    '..##..',
  ],
  cactusLarge: [
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '#..##..#',
    '#..##..#',
    '#..##..#',
    '#.###..#',
    '#.####.#',
    '######.#',
    '.#####.#',
    '..#####.',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
  ],
  cactusGroup: [
    '..##..##..',
    '..##..##..',
    '..##..##..',
    '#.##..##.#',
    '#.##.###.#',
    '####.###.#',
    '.########.',
    '..######..',
    '..##..##..',
    '..##..##..',
    '..##..##..',
    '..##..##..',
  ],
  birdUp: [
    '....#.......',
    '...##.......',
    '..###.......',
    '.####.......',
    '#.######### ',
    '..##########',
    '............',
  ],
  birdDown: [
    '............',
    '..##########',
    '#.######### ',
    '.####.......',
    '..###.......',
    '...##.......',
    '....#.......',
  ],
  cloud: [
    '...######...',
    '.##########.',
    '############',
    '############',
    '.##########.',
  ],
};

function drawSprite(ctx, sprite, x, y, color) {
  ctx.fillStyle = color;
  for (let r = 0; r < sprite.length; r++) {
    const row = sprite[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '#') {
        ctx.fillRect(x + c * P, y + r * P, P, P);
      } else if (row[c] === 'X') {
        // 'X' = eye highlight in dead sprite
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + c * P, y + r * P, P, P);
        ctx.fillStyle = color;
      }
    }
  }
}

function spriteW(sprite) { return sprite[0].length * P; }
function spriteH(sprite) { return sprite.length * P; }

// ── Game Engine ────────────────────────────────────────────────────────

class TRexGame {
  constructor(canvas, onGameOver) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onGameOver = onGameOver;

    // Virtual game dimensions (canvas is scaled via CSS)
    this.W = 800;
    this.H = 200;
    canvas.width = this.W;
    canvas.height = this.H;

    this.GROUND_Y = 160;
    this.DINO_X = 50;

    this._reset();
    this._bindInput();
  }

  _reset() {
    this.speed = 6;
    this.score = 0;
    this.frameCount = 0;
    this.gameOver = false;
    this.started = false;

    // Dino state
    this.dino = {
      y: this.GROUND_Y,
      vy: 0,
      jumping: false,
      ducking: false,
      frame: 0,
    };

    this.obstacles = [];
    this.clouds = [];
    this.groundOffset = 0;
    this.nextObstacleIn = 60;
    this.animFrame = 0;
    this.nightMode = false;

    // Pre-spawn some clouds
    for (let i = 0; i < 3; i++) {
      this.clouds.push({
        x: 200 + i * 250 + Math.random() * 100,
        y: 20 + Math.random() * 40,
      });
    }
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        this._jump();
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        this.dino.ducking = true;
      }
    };
    this._onKeyUp = (e) => {
      if (e.code === 'ArrowDown') {
        this.dino.ducking = false;
      }
    };
    this._onTouch = (e) => {
      e.preventDefault();
      this._jump();
    };

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    this.canvas.addEventListener('touchstart', this._onTouch);
  }

  _jump() {
    if (this.gameOver) return;
    if (!this.started) {
      this.started = true;
    }
    if (!this.dino.jumping) {
      this.dino.jumping = true;
      this.dino.vy = -12;
      this.dino.ducking = false;
    }
  }

  start() {
    this._reset();
    this._draw(); // Draw initial frame with "press space" prompt
    this._raf = requestAnimationFrame(() => this._loop());
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('touchstart', this._onTouch);
  }

  _loop() {
    if (this.started && !this.gameOver) {
      this._update();
    }
    this._draw();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _update() {
    this.frameCount++;

    // Speed increases over time
    this.speed = 6 + this.frameCount * 0.002;

    // Score
    this.score = Math.floor(this.frameCount * 0.15);

    // Night mode toggle
    this.nightMode = Math.floor(this.score / 700) % 2 === 1;

    // Ground scroll
    this.groundOffset = (this.groundOffset + this.speed) % 20;

    // Dino physics
    if (this.dino.jumping) {
      this.dino.y += this.dino.vy;
      this.dino.vy += 0.6; // gravity
      if (this.dino.y >= this.GROUND_Y) {
        this.dino.y = this.GROUND_Y;
        this.dino.jumping = false;
        this.dino.vy = 0;
      }
    }

    // Animation frame
    if (this.frameCount % 6 === 0) {
      this.animFrame = 1 - this.animFrame;
    }

    // Clouds
    this.clouds.forEach(c => { c.x -= this.speed * 0.3; });
    this.clouds = this.clouds.filter(c => c.x > -60);
    if (Math.random() < 0.005) {
      this.clouds.push({ x: this.W + 20, y: 20 + Math.random() * 50 });
    }

    // Spawn obstacles
    this.nextObstacleIn--;
    if (this.nextObstacleIn <= 0) {
      this._spawnObstacle();
      this.nextObstacleIn = Math.floor(50 + Math.random() * 80 * (6 / this.speed));
    }

    // Move obstacles
    this.obstacles.forEach(o => { o.x -= this.speed; });
    this.obstacles = this.obstacles.filter(o => o.x > -60);

    // Collision detection
    this._checkCollisions();
  }

  _spawnObstacle() {
    const r = Math.random();
    if (r < 0.3 && this.speed > 8) {
      // Bird at random height
      const heights = [this.GROUND_Y - 20, this.GROUND_Y - 45, this.GROUND_Y - 70];
      const h = heights[Math.floor(Math.random() * heights.length)];
      this.obstacles.push({
        type: 'bird',
        x: this.W + 20,
        y: h,
        sprite: SPR.birdUp,
        w: spriteW(SPR.birdUp),
        h: spriteH(SPR.birdUp),
      });
    } else if (r < 0.55) {
      this.obstacles.push({
        type: 'cactus',
        x: this.W + 20,
        y: this.GROUND_Y + spriteH(SPR.dinoRun1) - spriteH(SPR.cactusSmall),
        sprite: SPR.cactusSmall,
        w: spriteW(SPR.cactusSmall),
        h: spriteH(SPR.cactusSmall),
      });
    } else if (r < 0.8) {
      this.obstacles.push({
        type: 'cactus',
        x: this.W + 20,
        y: this.GROUND_Y + spriteH(SPR.dinoRun1) - spriteH(SPR.cactusLarge),
        sprite: SPR.cactusLarge,
        w: spriteW(SPR.cactusLarge),
        h: spriteH(SPR.cactusLarge),
      });
    } else {
      this.obstacles.push({
        type: 'cactus',
        x: this.W + 20,
        y: this.GROUND_Y + spriteH(SPR.dinoRun1) - spriteH(SPR.cactusGroup),
        sprite: SPR.cactusGroup,
        w: spriteW(SPR.cactusGroup),
        h: spriteH(SPR.cactusGroup),
      });
    }
  }

  _checkCollisions() {
    const pad = 6; // forgiveness padding
    let dinoSprite, dx, dy;

    if (this.dino.ducking) {
      dinoSprite = SPR.dinoDuck1;
      dx = this.DINO_X;
      dy = this.dino.y + (spriteH(SPR.dinoRun1) - spriteH(SPR.dinoDuck1));
    } else {
      dinoSprite = SPR.dinoRun1;
      dx = this.DINO_X;
      dy = this.dino.y;
    }

    const dw = spriteW(dinoSprite);
    const dh = spriteH(dinoSprite);

    for (const o of this.obstacles) {
      // AABB collision with padding
      if (
        dx + pad < o.x + o.w - pad &&
        dx + dw - pad > o.x + pad &&
        dy + pad < o.y + o.h - pad &&
        dy + dh - pad > o.y + pad
      ) {
        this._die();
        return;
      }
    }
  }

  _die() {
    this.gameOver = true;
    // Short delay then notify
    setTimeout(() => {
      if (this.onGameOver) this.onGameOver(this.score);
    }, 800);
  }

  _draw() {
    const ctx = this.ctx;
    const bg = this.nightMode ? '#1a1a2e' : '#f7f7f7';
    const fg = this.nightMode ? '#e0e0e0' : '#535353';

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.W, this.H);

    // Clouds
    const cloudColor = this.nightMode ? '#2a2a4e' : '#e0e0e0';
    this.clouds.forEach(c => drawSprite(ctx, SPR.cloud, c.x, c.y, cloudColor));

    // Ground line
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1;
    const gy = this.GROUND_Y + spriteH(SPR.dinoRun1) + 2;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(this.W, gy);
    ctx.stroke();

    // Ground texture (small dashes)
    ctx.fillStyle = fg;
    for (let i = 0; i < this.W; i += 20) {
      const x = (i - this.groundOffset + this.W) % this.W;
      ctx.fillRect(x, gy + 3, 6, 1);
      ctx.fillRect((x + 10) % this.W, gy + 6, 4, 1);
    }

    // Obstacles
    this.obstacles.forEach(o => {
      if (o.type === 'bird') {
        const birdSprite = this.animFrame === 0 ? SPR.birdUp : SPR.birdDown;
        drawSprite(ctx, birdSprite, o.x, o.y, fg);
      } else {
        drawSprite(ctx, o.sprite, o.x, o.y, fg);
      }
    });

    // Dino
    let dinoSprite;
    if (this.gameOver) {
      dinoSprite = SPR.dinoDead;
      drawSprite(ctx, dinoSprite, this.DINO_X, this.dino.y, fg);
    } else if (this.dino.jumping) {
      dinoSprite = SPR.dinoJump;
      drawSprite(ctx, dinoSprite, this.DINO_X, this.dino.y, fg);
    } else if (this.dino.ducking) {
      const duckSprite = this.animFrame === 0 ? SPR.dinoDuck1 : SPR.dinoDuck2;
      const yOffset = spriteH(SPR.dinoRun1) - spriteH(SPR.dinoDuck1);
      drawSprite(ctx, duckSprite, this.DINO_X, this.dino.y + yOffset, fg);
    } else {
      dinoSprite = this.animFrame === 0 ? SPR.dinoRun1 : SPR.dinoRun2;
      drawSprite(ctx, dinoSprite, this.DINO_X, this.dino.y, fg);
    }

    // Score
    ctx.fillStyle = fg;
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    const scoreStr = String(this.score).padStart(5, '0');
    // Blink every 100 points
    const blink = this.score > 0 && this.score % 100 === 0 && this.frameCount % 10 < 5;
    if (!blink) {
      ctx.fillText(scoreStr, this.W - 20, 30);
    }

    // Start prompt
    if (!this.started) {
      ctx.fillStyle = fg;
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press SPACE to start', this.W / 2, this.H / 2 - 20);
    }

    // Game over text
    if (this.gameOver) {
      ctx.fillStyle = fg;
      ctx.font = '18px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', this.W / 2, this.H / 2 - 20);
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.fillText('Submitting score...', this.W / 2, this.H / 2 + 10);
    }
  }
}

// Make available globally
window.TRexGame = TRexGame;
