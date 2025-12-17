// ===== Dual Core v20.0 — Full Stable Integration + Clean FX (No Neon Road) =====
// 완전한 통합버전 (테트리스 + 자동차게임 + 리더보드 + 폭발효과)
// -----------------------------------------------------------------------------

// ===== CANVAS =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.imageSmoothingEnabled = false;

// ===== AUDIO =====
const AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bgmAudio = null, bgmRateInterval = null;

function playSound(type, pitchOffset = 0) {
  const osc = AudioCtx.createOscillator();
  const gain = AudioCtx.createGain();
  osc.connect(gain).connect(AudioCtx.destination);
  const now = AudioCtx.currentTime;
  gain.gain.setValueAtTime(0.25, now);
  osc.frequency.value =
    type === "line" ? 880 + pitchOffset :
    type === "crash" ? 150 + pitchOffset :
    type === "beep" ? 600 + pitchOffset : 300;
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  osc.type = "sine";
  osc.start(now);
  osc.stop(now + 0.4);
}

function playBGM() {
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio.currentTime = 0;
  }
  bgmAudio = new Audio("assets/Neon Dreams Collide.mp3");
  bgmAudio.loop = true;
  bgmAudio.volume = 0.5;
  bgmAudio.playbackRate = 1.0;
  bgmAudio.play().catch(() => {});
}

function adjustBGMRate(targetRate) {
  if (!bgmAudio) return;
  if (bgmRateInterval) clearInterval(bgmRateInterval);
  const step = targetRate > bgmAudio.playbackRate ? 0.01 : -0.01;
  bgmRateInterval = setInterval(() => {
    bgmAudio.playbackRate += step;
    if (
      (step > 0 && bgmAudio.playbackRate >= targetRate) ||
      (step < 0 && bgmAudio.playbackRate <= targetRate)
    ) {
      bgmAudio.playbackRate = targetRate;
      clearInterval(bgmRateInterval);
      bgmRateInterval = null;
    }
  }, 40);
}
function stopBGM() { if (bgmAudio) bgmAudio.pause(); }

// ===== GLOBAL =====
let laneCount = 3, obstacleSpeedBase = 3, obstacleSpawnRate = 1800;
let tetrisSpeed = 1, lives = 5, score = 0;
let feedbackText = "", feedbackColor = "", feedbackTimer = 0;
let roadOffset = 0, collisionFlashes = [], lineParticles = [];
let playerName = localStorage.getItem("dualcore_name") || null;
let leaderboard = JSON.parse(localStorage.getItem("dualcore_scores") || "[]");
let gameStarted = false, startTime = null, hoveredButton = null;
let menuFrameId = null;
let bgImage = new Image();
bgImage.src = "assets/title_bg.png";

// ===== ASSETS =====
const assets = {
  car: new Image(),
  obstacle: new Image(),
  road: new Image(),
};
assets.car.src = "assets/car.png";
assets.obstacle.src = "assets/obstacle.png";

// ===== MENU =====
const modes = [
  { label: "EASY", lanes: 3, color: "#00ffae" },
  { label: "NORMAL", lanes: 4, color: "#00c896" },
  { label: "HARD", lanes: 5, color: "#009977" },
];

function lightenColor(hex, amt) {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) + Math.floor(255 * amt);
  let g = ((num >> 8) & 0x00ff) + Math.floor(255 * amt);
  let b = (num & 0x0000ff) + Math.floor(255 * amt);
  r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
  return `rgb(${r},${g},${b})`;
}

function drawMenu() {
   showFeedbackLink(); // 🔹 메뉴 진입 시 링크 표시
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bgImage.complete) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "38px Orbitron";
  ctx.fillText("SELECT DIFFICULTY", canvas.width / 2 - 210, canvas.height / 2 - 40);

  const totalWidth = modes.length * 160 - 20;
  const startX = canvas.width / 2 - totalWidth / 2;
  modes.forEach((mode, i) => {
    const x = startX + i * 160;
    const y = canvas.height / 2 + 100;
    const w = 140, h = 70;
    let drawColor = mode.color, scale = 1.0;
    if (hoveredButton === i) {
      drawColor = lightenColor(mode.color, 0.25);
      scale = 1.08;
    }
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = drawColor;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = "white";
    ctx.font = "26px Orbitron";
    const tw = ctx.measureText(mode.label).width;
    ctx.fillText(mode.label, -tw / 2, 10);
    ctx.restore();
  });

  ctx.font = "20px Orbitron";
  const hint = playerName ? `Welcome, ${playerName}! Click to Start` : "Click to Begin";
  ctx.fillText(
    hint,
    canvas.width / 2 - ctx.measureText(hint).width / 2,
    canvas.height / 2 + 240
  );
  menuFrameId = requestAnimationFrame(drawMenu);
}
// ===== FEEDBACK LINK (only visible in menu) =====
let feedbackLink = null;

function showFeedbackLink() {
  if (!feedbackLink) {
    feedbackLink = document.createElement("a");
    feedbackLink.href = "https://github.com/starbin29/dual-core/discussions";
    feedbackLink.target = "_blank";
    feedbackLink.innerText = "💬 Feedback";
    feedbackLink.style.position = "fixed";
    feedbackLink.style.bottom = "20px";
    feedbackLink.style.right = "25px";
    feedbackLink.style.color = "#00ffd0";
    feedbackLink.style.fontFamily = "Orbitron, sans-serif";
    feedbackLink.style.fontSize = "18px";
    feedbackLink.style.textDecoration = "none";
    feedbackLink.style.opacity = "0.8";
    feedbackLink.style.transition = "opacity 0.3s";
    feedbackLink.onmouseenter = () => (feedbackLink.style.opacity = "1.0");
    feedbackLink.onmouseleave = () => (feedbackLink.style.opacity = "0.8");
    document.body.appendChild(feedbackLink);
  }
  feedbackLink.style.display = "block";
}

function hideFeedbackLink() {
  if (feedbackLink) feedbackLink.style.display = "none";
}

canvas.addEventListener("mousemove", e => {
  if (gameStarted) return;
  const mx = e.clientX, my = e.clientY;
  hoveredButton = null;
  const totalWidth = modes.length * 160 - 20;
  const startX = canvas.width / 2 - totalWidth / 2;
  modes.forEach((m, i) => {
    const x = startX + i * 160, y = canvas.height / 2 + 100, w = 140, h = 70;
    if (mx >= x && mx <= x + w && my >= y && my <= y + h) hoveredButton = i;
  });
});

canvas.addEventListener("click", e => {
  if (gameStarted) return;
  const mx = e.clientX, my = e.clientY;
  const totalWidth = modes.length * 160 - 20;
  const startX = canvas.width / 2 - totalWidth / 2;
  modes.forEach((mode, i) => {
    const x = startX + i * 160, y = canvas.height / 2 + 100, w = 140, h = 70;
    if (mx >= x && mx <= x + w && my >= y && my <= y + h) {
      hideFeedbackLink();
      if (!playerName) {
        playerName = prompt("Enter your name:") || "PLAYER";
        localStorage.setItem("dualcore_name", playerName);
      }
      laneCount = mode.lanes;
      obstacleSpeedBase = laneCount === 3 ? 2.8 : laneCount === 4 ? 3.6 : 4.4;
      obstacleSpawnRate = laneCount === 3 ? 1800 : laneCount === 4 ? 1400 : 1000;
      cancelAnimationFrame(menuFrameId);
      playBGM();
      loadRoadImage(() => startCountdown());
    }
  });
});

// ===== LOAD ROAD =====
function loadRoadImage(cb) {
  assets.road.onload = cb;
  if (laneCount === 3) assets.road.src = "assets/road.png";
  else if (laneCount === 4) assets.road.src = "assets/road_4lanes.svg";
  else assets.road.src = "assets/road_5lanes.svg";
}

// ===== COUNTDOWN =====
function startCountdown() {
  const sequence = ["3", "2", "1", "READY", "GO!"];
  let index = 0;
  function showNext() {
    const text = sequence[index];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bgImage.complete) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00ffc3";
    ctx.font = "200px Orbitron";
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, canvas.width / 2 - tw / 2, canvas.height / 2 + 80);
    playSound("beep", 50 * (5 - index));
    index++;
    if (index < sequence.length) setTimeout(showNext, 1000);
    else setTimeout(() => { gameStarted = true; startTime = Date.now(); initGame(); }, 500);
  }
  showNext();
}

// ===== GAME ENGINE =====
function initGame() {
  const leftWidth = canvas.width * 0.45;
  const rightX = canvas.width * 0.55;
  const carZoneWidth = canvas.width * 0.4;
  const car = { lane: Math.floor(laneCount / 2), w: 80, h: 90, y: canvas.height - 180 };
  const obstacles = [];
  score = 0; lives = 5; feedbackTimer = 0;

  const COLS = 10, ROWS = 20, SIZE = 30;
  const fieldWidth = COLS * SIZE, fieldHeight = ROWS * SIZE;
  const offsetX = (leftWidth - fieldWidth) / 2, offsetY = (canvas.height - fieldHeight) / 2;
  let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

  const SHAPES = {
    I: [[1,1,1,1]], O: [[1,1],[1,1]], T: [[0,1,0],[1,1,1]],
    S: [[0,1,1],[1,1,0]], Z: [[1,1,0],[0,1,1]], J: [[1,0,0],[1,1,1]], L: [[0,0,1],[1,1,1]]
  };
  const COLORS = {
    I:"#00ffff", O:"#facc15", T:"#a855f7", S:"#22c55e", Z:"#ef4444", J:"#3b82f6", L:"#f97316"
  };

  function newPiece() {
    const t = Object.keys(SHAPES)[Math.floor(Math.random() * 7)];
    return { shape: SHAPES[t].map(r => [...r]), color: COLORS[t], x: 3, y: 0 };
  }

  let currentPiece = newPiece(), nextPiece = newPiece();

  function drawNextBox() {
    const bx = offsetX + fieldWidth + 30, by = offsetY + 30, s = 100;
    ctx.strokeStyle = "white"; ctx.strokeRect(bx, by, s, s);
    ctx.font = "18px Orbitron"; ctx.fillStyle = "white";
    ctx.fillText("NEXT", bx + 20, by - 10);
    const sh = nextPiece.shape, cell = 20, ox = bx + s/2 - (sh[0].length*cell)/2, oy = by + s/2 - (sh.length*cell)/2;
    ctx.fillStyle = nextPiece.color;
    sh.forEach((r,y)=>r.forEach((v,x)=>v&&ctx.fillRect(ox+x*cell,oy+y*cell,cell-2,cell-2)));
  }

  function collision() {
    for (let r = 0; r < currentPiece.shape.length; r++)
      for (let c = 0; c < currentPiece.shape[r].length; c++)
        if (currentPiece.shape[r][c]) {
          const nx = currentPiece.x + c, ny = currentPiece.y + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS || grid[ny]?.[nx]) return true;
        }
    return false;
  }

  function merge() {
    currentPiece.shape.forEach((row, r) =>
      row.forEach((v, c) => { if (v) grid[currentPiece.y + r][currentPiece.x + c] = currentPiece.color; })
    );
  }

  // 🧱 라인 제거 + 파편 효과
  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every(v => v)) {
        for (let x = 0; x < COLS; x++) {
          lineParticles.push({
            x: offsetX + x * SIZE + SIZE / 2,
            y: offsetY + y * SIZE + SIZE / 2,
            vx: (Math.random() - 0.5) * 6,
            vy: -Math.random() * 5,
            alpha: 1,
            color: grid[y][x]
          });
        }
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(0));
        cleared++; y++;
      }
    }
    if (cleared > 0) playSound("line");
  }

  function dropPiece() {
    currentPiece.y++;
    if (collision()) {
      currentPiece.y--;
      merge();
      clearLines();
      currentPiece = nextPiece;
      nextPiece = newPiece();
      if (collision()) lives = 0;
    }
  }

  window.onkeydown = e => {
    if (e.key === "a") { currentPiece.x--; if (collision()) currentPiece.x++; }
    if (e.key === "d") { currentPiece.x++; if (collision()) currentPiece.x--; }
    if (e.key === "s") {
      const old = currentPiece.shape.map(r => [...r]);
      const rot = old[0].map((_, i) => old.map(r => r[i]).reverse());
      currentPiece.shape = rot;
      if (collision()) currentPiece.shape = old;
    }
    if (e.key === "w") dropPiece();
    if (e.key === "ArrowLeft" && car.lane > 0) car.lane--;
    if (e.key === "ArrowRight" && car.lane < laneCount - 1) car.lane++;
  };

  let lastFrame = 0, dropTimer = 0, lastFrameTime = performance.now();
  let spawnTimer = setInterval(() => {
    if (lives <= 0) { clearInterval(spawnTimer); return; }
    obstacles.push({ lane: Math.floor(Math.random() * laneCount), y: -100, speed: obstacleSpeedBase * (1 + Math.random() * 0.25) });
  }, obstacleSpawnRate);

  function gameLoop(ts) {
    const deltaRaw = (ts - lastFrameTime) / 16.67;
    const delta = isNaN(deltaRaw) || deltaRaw < 0 ? 1 : Math.min(deltaRaw, 3);
    lastFrameTime = ts;
    dropTimer += ts - lastFrame;
    lastFrame = ts;
    if (dropTimer > 800 / tetrisSpeed) { dropPiece(); dropTimer = 0; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bgImage.complete) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    drawTetris(); drawCarGame(delta); drawHUD(); drawParticles(); // ★ 파편 & 폭발 추가
    score++;

    if (lives > 0) requestAnimationFrame(gameLoop);
    else { clearInterval(spawnTimer); showLeaderboard(); }
  }

  // ===== DRAW FUNCTIONS =====
  function drawTetris() {
    ctx.fillStyle = "#081530"; ctx.fillRect(0, 0, leftWidth, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(offsetX, offsetY + y * SIZE);
      ctx.lineTo(offsetX + fieldWidth, offsetY + y * SIZE); ctx.stroke();
    }
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(offsetX + x * SIZE, offsetY);
      ctx.lineTo(offsetX + x * SIZE, offsetY + fieldHeight); ctx.stroke();
    }
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (grid[y][x]) {
          ctx.fillStyle = grid[y][x];
          ctx.fillRect(offsetX + x * SIZE + 1, offsetY + y * SIZE + 1, SIZE - 2, SIZE - 2);
        }
    ctx.fillStyle = currentPiece.color;
    currentPiece.shape.forEach((r, y) => r.forEach((v, x) => {
      if (v) ctx.fillRect(offsetX + (currentPiece.x + x) * SIZE + 1, offsetY + (currentPiece.y + y) * SIZE + 1, SIZE - 2, SIZE - 2);
    }));
    drawNextBox();
  }

  function drawCarGame(delta) {
    const laneWidth = carZoneWidth / laneCount;
    roadOffset = (roadOffset + obstacleSpeedBase * 2 * delta) % 512;
    const offsetY = -Math.floor(roadOffset);
    for (let i = 0; i < 3; i++) {
      const y = Math.round(i * 512 + offsetY - 1);
      ctx.drawImage(assets.road, rightX, y, carZoneWidth, 520);
    }
    const carX = rightX + car.lane * laneWidth + (laneWidth - car.w) / 2;
    ctx.drawImage(assets.car, carX, car.y, car.w, car.h);

    for (let i = 0; i < obstacles.length; i++) {
      obstacles[i].y += obstacles[i].speed * delta;
      const ox = rightX + obstacles[i].lane * laneWidth + (laneWidth - 80) / 2;
      ctx.drawImage(assets.obstacle, ox, obstacles[i].y, 80, 90);
      if (obstacles[i].y > canvas.height) obstacles.splice(i, 1);
      if (car.y < obstacles[i].y + 80 && car.y + car.h > obstacles[i].y && car.lane === obstacles[i].lane) {
        lives--;
        obstacles.splice(i, 1);
        playSound("crash");
        feedbackText = "Speed Up!"; feedbackColor = "#ff4040"; feedbackTimer = 60;
        obstacleSpeedBase *= 1.02; adjustBGMRate(Math.min(1.4, bgmAudio.playbackRate + 0.02));
        collisionFlashes.push({ x: ox + 40, y: car.y + 40, alpha: 1 }); // ★ 충돌이펙트
      }
    }

    collisionFlashes.forEach((s, i) => {
      const size = 60 * s.alpha;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, size);
      g.addColorStop(0, `rgba(255,255,200,${s.alpha})`);
      g.addColorStop(0.4, `rgba(255,180,60,${s.alpha * 0.8})`);
      g.addColorStop(1, `rgba(255,100,0,0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, size, 0, Math.PI * 2); ctx.fill();
      s.alpha -= 0.05;
      if (s.alpha <= 0) collisionFlashes.splice(i, 1);
    });
  }

  function drawParticles() {
    for (let i = 0; i < lineParticles.length; i++) {
      const p = lineParticles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.alpha -= 0.02;
      ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
      ctx.fillRect(p.x, p.y, 4, 4);
      if (p.alpha <= 0) lineParticles.splice(i, 1);
    }
  }

  function drawHUD() {
    ctx.fillStyle = "white";
    ctx.font = "20px Orbitron";
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    ctx.fillText(`Score: ${score}`, 30, 40);
    ctx.fillText(`Time: ${elapsed}s`, 30, 70);
    ctx.fillText(`Lives: ${lives}`, 30, 100);
    if (feedbackTimer > 0) {
      ctx.fillStyle = feedbackColor;
      ctx.font = "40px Orbitron";
      ctx.fillText(feedbackText, canvas.width / 2 - ctx.measureText(feedbackText).width / 2, 80);
      feedbackTimer--;
    }
  }

  function showLeaderboard() {
    leaderboard.push({ name: playerName, score });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 5);
    localStorage.setItem("dualcore_scores", JSON.stringify(leaderboard));
    stopBGM();
    ctx.fillStyle = "white"; ctx.font = "60px Orbitron";
    ctx.fillText("GAME OVER", canvas.width / 2 - 200, canvas.height / 2 - 100);
    ctx.font = "28px Orbitron";
    ctx.fillText("🏆 LEADERBOARD 🏆", canvas.width / 2 - 150, canvas.height / 2 - 40);
    leaderboard.forEach((p, i) =>
      ctx.fillText(`${i + 1}. ${p.name} — ${p.score}`, canvas.width / 2 - 140, canvas.height / 2 + i * 40 + 20)
    );
    setTimeout(() => { gameStarted = false; drawMenu(); }, 6000);
  }

  requestAnimationFrame(gameLoop);
}

// ===== INIT =====
drawMenu();
