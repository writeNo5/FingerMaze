/**
 * Finger Maze: Abyssal Descent (Addictive Edition)
 * [Julian, Minho, Ken, Hana]
 * 
 * New Features:
 * - Record System (Best Depth, Best Time)
 * - Combo System (Consecutive Clear Bonus)
 * - Depth-based Theme Evolution
 */

let mazeWalls = [];
let particles = [];
let terrainBuffer;
let isStarted = false;
let isWon = false;

// 게임 상태 및 설정
let currentDepth = 1;
let startTime;
let timerInterval;

// [New] 기록 & 콤보 시스템
let bestDepth = 0;
let bestTime = Infinity;
let comboCount = 0;
let lastClearTime = 0;
let comboTimeout = null;
let levelStartTime = 0;

// [New] 설정 시스템
let currentTheme = 'auto'; // 'auto', 'cyan', 'purple', 'green', 'red'
let currentLanguage = 'ko'; // 'ko', 'en'

let cols, rows;
let cellSize;
let grid = [];
let stack = [];
let goal = null;
let startPos = { x: 0, y: 0 };

let shakeAmount = 0;
let collisionThisFrame = false;

// [Update] 묵직한 조작감을 위한 감도 및 저항 세팅
let pointerX = 0;
let pointerY = 0;
let prevInputX = 0;
let prevInputY = 0;
let isMoving = false;
let sensitivity = 0.75;
let groundFriction = 0.55;

// 구체 변수 (Rolling Ball)
let ballSize = 24;
let ballScale = 1.0;
let ballRotation = 0;
let ballVelX = 0;
let ballVelY = 0;

// 사운드 엔진
let audioCtx;

function setup() {
    const canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('canvas-container');

    terrainBuffer = createGraphics(width, height);
    terrainBuffer.background(0, 0);

    // [New] 기록 불러오기
    loadRecords();
    loadSettings();

    initGame(1);

    const startBtn = document.getElementById('start-button');
    if (startBtn) {
        startBtn.onclick = (e) => {
            e.stopPropagation();
            initAudio();

            let curX = (touches.length > 0) ? touches[0].x : mouseX;
            let curY = (touches.length > 0) ? touches[0].y : mouseY;
            prevInputX = curX;
            prevInputY = curY;

            pointerX = startPos.x;
            pointerY = startPos.y;

            isStarted = true;
            document.getElementById('ui-overlay').style.display = 'none';
            const hud = document.getElementById('hud');
            if (hud) {
                hud.classList.remove('hidden');
                updateHUD();

                // 재시작 버튼 이벤트 연결
                const restartBtn = document.getElementById('mini-restart');
                if (restartBtn) {
                    restartBtn.onclick = (e) => {
                        e.stopPropagation();
                        if ("vibrate" in navigator) navigator.vibrate(30);
                        currentDepth = 1;
                        comboCount = 0;
                        initGame(1);
                        startTimer();
                    };
                }

                // [New] 설정 버튼 이벤트
                const settingsBtn = document.getElementById('settings-btn');
                if (settingsBtn) {
                    settingsBtn.onclick = (e) => {
                        e.stopPropagation();
                        showSettingsModal();
                    };
                }
            }
            startTimer();
            levelStartTime = Date.now();
        };
    }
    textFont('Outfit');
    noCursor();
}

function initAudio() {
    if (audioCtx) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let g = audioCtx.createGain();
        g.gain.setValueAtTime(0.02, audioCtx.currentTime);
        g.connect(audioCtx.destination);
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(45, audioCtx.currentTime);
        osc.connect(g);
        osc.start();
    } catch (e) { }
}

function initGame(depth) {
    cellSize = Math.max(50, 115 - (depth - 1) * 10);
    cols = floor(width / cellSize);
    rows = floor(height / cellSize);

    grid = [];
    stack = [];
    mazeWalls = [];
    particles = [];
    ballScale = 1.5;
    ballVelX = 0; ballVelY = 0;

    terrainBuffer.clear();
    generateFullMaze();

    updateHUD();
    isWon = false;
    levelStartTime = Date.now();

    if (isStarted) {
        pointerX = startPos.x;
        pointerY = startPos.y;
        let curX = (touches.length > 0) ? touches[0].x : mouseX;
        let curY = (touches.length > 0) ? touches[0].y : mouseY;
        prevInputX = curX;
        prevInputY = curY;
    }
}

function generateFullMaze() {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            grid.push(new Cell(c, r));
        }
    }

    let startIndex = Math.floor(Math.random() * grid.length);
    let current = grid[startIndex];
    current.visited = true;
    startPos = {
        x: (current.c + 0.5) * cellSize,
        y: (current.r + 0.5) * cellSize
    };

    while (true) {
        let next = current.checkNeighbors();
        if (next) {
            next.visited = true;
            stack.push(current);
            removeWalls(current, next);
            current = next;
        } else if (stack.length > 0) {
            current = stack.pop();
        } else {
            break;
        }
    }

    const wallThickness = 14;
    grid.forEach(cell => {
        let x = cell.c * cellSize;
        let y = cell.r * cellSize;
        if (cell.walls[0]) mazeWalls.push(new Wall(x + cellSize / 2, y, cellSize, wallThickness));
        if (cell.walls[1]) mazeWalls.push(new Wall(x + cellSize, y + cellSize / 2, wallThickness, cellSize));
        if (cell.walls[2]) mazeWalls.push(new Wall(x + cellSize / 2, y + cellSize, cellSize, wallThickness));
        if (cell.walls[3]) mazeWalls.push(new Wall(x, y + cellSize / 2, wallThickness, cellSize));
    });

    // [Update] HUD 영역(상단 100px)을 피하는 포털 위치 필터
    let potentialGoals = grid.filter(cell => {
        let d = Math.sqrt(Math.pow(cell.c - grid[startIndex].c, 2) + Math.pow(cell.r - grid[startIndex].r, 2));
        let cellY = (cell.r + 0.5) * cellSize;
        return d > (cols + rows) / 2.8 && cellY > 120;
    });

    let goalCell = potentialGoals.length > 0 ? potentialGoals[Math.floor(Math.random() * potentialGoals.length)] : grid[grid.length - 1];
    goal = {
        x: (goalCell.c + 0.5) * cellSize,
        y: (goalCell.r + 0.5) * cellSize,
        r: cellSize * 0.22 // [Update] 70% 축소 (0.32 -> 0.22)
    };
}

function Wall(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.offsets = [];
    for (let i = 0; i < 8; i++) this.offsets.push(random(-3, 3));
}

function updateTrackpadInput() {
    if (isWon || !isStarted) return;

    let ciX = mouseX, ciY = mouseY;
    if (touches.length > 0) { ciX = touches[0].x; ciY = touches[0].y; }

    if (mouseIsPressed || touches.length > 0) {
        if (!isMoving) {
            isMoving = true;
            prevInputX = ciX;
            prevInputY = ciY;
        } else {
            let targetDx = (ciX - prevInputX) * sensitivity;
            let targetDy = (ciY - prevInputY) * sensitivity;

            ballVelX = targetDx * groundFriction;
            ballVelY = targetDy * groundFriction;

            let steps = 6;
            for (let s = 0; s < steps; s++) {
                let nX = pointerX + ballVelX / steps;
                let nY = pointerY + ballVelY / steps;
                let colW = null;
                for (let wall of mazeWalls) {
                    if (nX >= wall.x - wall.w / 2 - ballSize / 2 && nX <= wall.x + wall.w / 2 + ballSize / 2 &&
                        nY >= wall.y - wall.h / 2 - ballSize / 2 && nY <= wall.y + wall.h / 2 + ballSize / 2) {
                        colW = wall; break;
                    }
                }
                if (!colW) {
                    pointerX = nX; pointerY = nY;
                    terrainBuffer.noStroke();
                    terrainBuffer.fill(18, 16, 14, 4);
                    terrainBuffer.ellipse(pointerX, pointerY, ballSize * 0.7, ballSize * 0.7);
                } else {
                    if ("vibrate" in navigator) navigator.vibrate(20);
                    let pDX = pointerX - colW.x, pDY = pointerY - colW.y;
                    let dW = dist(0, 0, pDX, pDY);
                    if (dW > 0) {
                        pointerX += (pDX / dW) * 10;
                        pointerY += (pDY / dW) * 10;
                    }
                    break;
                }
            }
        }
    } else {
        isMoving = false;
        ballVelX *= 0.3; ballVelY *= 0.3;
    }

    ballRotation += (ballVelX + ballVelY) * 0.12;
    pointerX = constrain(pointerX, 8, width - 8);
    pointerY = constrain(pointerY, 8, height - 8);
    prevInputX = ciX; prevInputY = ciY;

    ballScale = lerp(ballScale, 1.0, 0.08);
}

function draw() {
    try {
        updateTrackpadInput();
        background(14, 13, 16);

        drawFloorTexture();

        terrainBuffer.push();
        terrainBuffer.blendMode(REMOVE);
        terrainBuffer.fill(255, 1.0);
        terrainBuffer.rect(0, 0, width, height);
        terrainBuffer.pop();
        image(terrainBuffer, 0, 0);

        // [Update] 화면 흔들림 효과 완전 제거

        push();
        drawVisibleMaze();
        drawGoal();

        if (isStarted && !isWon) {
            // [Update] 충돌 판정 확대 (0.45 -> 0.7)
            if (goal && dist(pointerX, pointerY, goal.x, goal.y) < goal.r * 0.7) winGame();

            textAlign(CENTER, CENTER);
            fill(100, 150, 255, 40);
            textSize(10);
            text("DEEP LINK ENTRY", startPos.x, startPos.y);
        }

        // [New] 콤보 표시
        if (comboCount >= 3) {
            drawComboIndicator();
        }

        if (isWon) { ballScale *= 0.9; drawWinScreen(); }
        pop();

        drawBall(pointerX, pointerY, ballScale, ballRotation);

    } catch (e) { console.error(e); }
}

function drawFloorTexture() {
    noStroke();
    for (let i = 0; i < 200; i++) {
        let x = noise(i * 15, 15) * width;
        let y = noise(i * 15, 30) * height;
        fill(35, 32, 28, 8);
        ellipse(x, y, 2, 2);
    }
}

function drawVisibleMaze() {
    // [Update] Fog of War: 구슬 주변의 벽만 표시
    let visibilityRadius = 180;

    for (let wall of mazeWalls) {
        let distToPlayer = dist(wall.x, wall.y, pointerX, pointerY);
        if (distToPlayer < visibilityRadius) {
            push(); translate(wall.x, wall.y);
            noStroke();
            let alpha = map(distToPlayer, 0, visibilityRadius, 240, 50);
            fill(38, 36, 45, alpha);
            beginShape();
            let hw = wall.w / 2, hh = wall.h / 2;
            vertex(-hw + wall.offsets[0], -hh + wall.offsets[1]);
            vertex(hw + wall.offsets[2], -hh + wall.offsets[3]);
            vertex(hw + wall.offsets[4], hh + wall.offsets[5]);
            vertex(-hw + wall.offsets[6], hh + wall.offsets[7]);
            endShape(CLOSE);
            pop();
        }
    }
}

function drawGoal() {
    if (!goal) return;

    let distToGoal = dist(pointerX, pointerY, goal.x, goal.y);
    if (distToGoal > 200) return;

    push();
    translate(goal.x, goal.y);

    // [New] 깊이별 테마 색상
    let themeColor = getThemeColor(currentDepth);

    // 1. 외곽 글로우
    noStroke();
    for (let i = 5; i > 0; i--) {
        fill(themeColor.r, themeColor.g, themeColor.b, (6 - i) * 8);
        ellipse(0, 0, goal.r * 3.5 + i * 15, goal.r * 3.5 + i * 15);
    }

    // 2. 회전하는 육각형 링들
    noFill();
    for (let layer = 0; layer < 4; layer++) {
        push();
        rotate(frameCount * 0.02 * (layer % 2 === 0 ? 1 : -1));
        stroke(themeColor.r, themeColor.g - layer * 30, themeColor.b, 180 - layer * 30);
        strokeWeight(2 - layer * 0.3);
        let hexSize = goal.r * (2.2 - layer * 0.4);
        drawHexagon(0, 0, hexSize);
        pop();
    }

    // 3. 내부 코어 (Pulsing Core)
    let pulse = sin(frameCount * 0.08) * 0.2 + 1;
    noStroke();
    fill(themeColor.r, themeColor.g, themeColor.b, 200);
    ellipse(0, 0, goal.r * 1.5 * pulse, goal.r * 1.5 * pulse);
    fill(themeColor.r + 100, themeColor.g, themeColor.b, 150);
    ellipse(0, 0, goal.r * 1.0 * pulse, goal.r * 1.0 * pulse);
    fill(200, themeColor.g, themeColor.b, 100);
    ellipse(0, 0, goal.r * 0.5 * pulse, goal.r * 0.5 * pulse);

    // 4. 회전 입자들
    for (let i = 0; i < 8; i++) {
        let angle = (frameCount * 0.03) + (i * TWO_PI / 8);
        let px = cos(angle) * goal.r * 2;
        let py = sin(angle) * goal.r * 2;
        fill(themeColor.r, themeColor.g, themeColor.b, 200);
        ellipse(px, py, 3, 3);
    }

    pop();
}

function drawHexagon(x, y, radius) {
    beginShape();
    for (let i = 0; i < 6; i++) {
        let angle = TWO_PI / 6 * i - HALF_PI;
        let vx = x + cos(angle) * radius;
        let vy = y + sin(angle) * radius;
        vertex(vx, vy);
    }
    endShape(CLOSE);
}

function drawBall(x, y, scale, rotation) {
    push(); translate(x, y);

    // [New] 깊이별 테마 색상
    let themeColor = getThemeColor(currentDepth);

    // 1. 외곽 글로우
    noStroke();
    for (let i = 3; i > 0; i--) {
        fill(themeColor.r, themeColor.g, themeColor.b, (4 - i) * 15);
        ellipse(0, 0, (ballSize + i * 12) * scale);
    }

    // 2. 회전하는 육각형 링
    noFill();
    push();
    rotate(frameCount * 0.03);
    stroke(themeColor.r, themeColor.g, themeColor.b, 150);
    strokeWeight(1.5);
    drawHexagon(0, 0, ballSize * 0.6 * scale);
    pop();

    // 3. 구슬 본체
    let s = ballSize * scale;
    noStroke();
    fill(20, 25, 35);
    ellipse(0, 0, s, s);
    fill(themeColor.r * 0.3, themeColor.g * 0.7, themeColor.b * 0.9, 100);
    ellipse(0, 0, s * 0.85, s * 0.85);

    // 4. 중앙 빛나는 코어
    fill(themeColor.r, themeColor.g, themeColor.b, 200);
    ellipse(0, 0, s * 0.4, s * 0.4);
    fill(200, themeColor.g, themeColor.b);
    ellipse(0, 0, s * 0.2, s * 0.2);

    pop();
}

function winGame() {
    if (isWon) return;
    isWon = true;

    // [New] 콤보 시스템
    let now = Date.now();
    if (now - lastClearTime < 5000) {
        comboCount++;
        if (comboCount >= 3) {
            if ("vibrate" in navigator) navigator.vibrate([50, 30, 50, 30, 100]);
        }
    } else {
        comboCount = 1;
    }
    lastClearTime = now;

    if (comboTimeout) clearTimeout(comboTimeout);
    comboTimeout = setTimeout(() => { comboCount = 0; }, 5000);

    // [New] 기록 갱신 체크
    if (currentDepth > bestDepth) {
        bestDepth = currentDepth;
        saveRecords();
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 200]);
    }

    clearInterval(timerInterval);
    if ("vibrate" in navigator) navigator.vibrate([100, 50, 200]);
    setTimeout(() => { currentDepth++; initGame(currentDepth); }, 2000);
}

function drawWinScreen() {
    textAlign(CENTER, CENTER);
    fill(255);
    textSize(35);
    text("DESCENDING...", width / 2, height / 2);
}

function drawComboIndicator() {
    push();
    textAlign(CENTER, CENTER);
    let pulse = sin(frameCount * 0.15) * 0.2 + 1;
    textSize(40 * pulse);
    fill(255, 200, 0, 200);
    text(`COMBO x${comboCount}! 🔥`, width / 2, height / 2 - 100);
    pop();
}

// [New] 깊이별 테마 색상
function getThemeColor(depth) {
    if (currentTheme !== 'auto') {
        return getFixedThemeColor(currentTheme);
    }

    // Auto 모드: 깊이별 자동 변화
    if (depth < 5) return { r: 0, g: 200, b: 255 };      // Cyan
    if (depth < 10) return { r: 0, g: 220, b: 200 };     // Cyan-Green
    if (depth < 20) return { r: 100, g: 200, b: 255 };   // Light Blue
    if (depth < 30) return { r: 150, g: 100, b: 255 };   // Purple-Blue
    if (depth < 50) return { r: 200, g: 50, b: 255 };    // Purple
    return { r: 255, g: 100, b: 200 };                   // Pink-Purple
}

function getFixedThemeColor(theme) {
    const themes = {
        'cyan': { r: 0, g: 200, b: 255 },
        'purple': { r: 200, g: 50, b: 255 },
        'green': { r: 50, g: 255, b: 150 },
        'red': { r: 255, g: 50, b: 100 }
    };
    return themes[theme] || themes['cyan'];
}

// [New] 기록 저장/불러오기
function loadRecords() {
    try {
        let saved = localStorage.getItem('fingerMaze_records');
        if (saved) {
            let data = JSON.parse(saved);
            bestDepth = data.bestDepth || 0;
            bestTime = data.bestTime || Infinity;
        }
    } catch (e) { }
}

function saveRecords() {
    try {
        localStorage.setItem('fingerMaze_records', JSON.stringify({
            bestDepth: bestDepth,
            bestTime: bestTime
        }));
    } catch (e) { }
}

// [New] HUD 업데이트
function updateHUD() {
    const hud = document.getElementById('hud');
    if (!hud) return;

    hud.innerHTML = `
        <div class="hud-item">DEPTH <span id="level-val">${currentDepth * 10}m</span> ${bestDepth > 0 ? `<span class="record">⭐${bestDepth * 10}m</span>` : ''}</div>
        <div class="hud-item">TIME <span id="timer-val">00:00</span></div>
        ${comboCount >= 3 ? `<div class="hud-item combo">COMBO <span>x${comboCount}</span></div>` : ''}
        <button id="mini-restart" class="hud-btn">RESTART</button>
    `;

    const restartBtn = document.getElementById('mini-restart');
    if (restartBtn) {
        restartBtn.onclick = (e) => {
            e.stopPropagation();
            if ("vibrate" in navigator) navigator.vibrate(30);
            currentDepth = 1;
            comboCount = 0;
            initGame(1);
            startTimer();
        };
    }
}

function startTimer() {
    startTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        let elapsed = floor((Date.now() - startTime) / 1000);
        let mins = floor(elapsed / 60).toString().padStart(2, '0');
        let secs = (elapsed % 60).toString().padStart(2, '0');
        const timerVal = document.getElementById('timer-val');
        if (timerVal) timerVal.innerText = `${mins}:${secs}`;
    }, 1000);
}

function Cell(c, r) {
    this.c = c; this.r = r; this.walls = [true, true, true, true]; this.visited = false;
    this.checkNeighbors = function () {
        let n = [];
        let t = grid[index(c, r - 1)], ri = grid[index(c + 1, r)], b = grid[index(c, r + 1)], l = grid[index(c - 1, r)];
        if (t && !t.visited) n.push(t); if (ri && !ri.visited) n.push(ri); if (b && !b.visited) n.push(b); if (l && !l.visited) n.push(l);
        return n.length > 0 ? n[Math.floor(Math.random() * n.length)] : undefined;
    };
}
function index(c, r) { if (c < 0 || r < 0 || c > cols - 1 || r > rows - 1) return -1; return c + r * cols; }
function removeWalls(a, b) {
    let x = a.c - b.c; if (x === 1) { a.walls[3] = false; b.walls[1] = false; } else if (x === -1) { a.walls[1] = false; b.walls[3] = false; }
    let y = a.r - b.r; if (y === 1) { a.walls[0] = false; b.walls[2] = false; } else if (y === -1) { a.walls[2] = false; b.walls[0] = false; }
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); terrainBuffer.resizeCanvas(width, height); }
// [New] 설정 저장/불러오기
function loadSettings() {
    try {
        let saved = localStorage.getItem('fingerMaze_settings');
        if (saved) {
            let data = JSON.parse(saved);
            currentTheme = data.theme || 'auto';
            currentLanguage = data.language || 'ko';
        }
    } catch (e) { }
}

function saveSettings() {
    try {
        localStorage.setItem('fingerMaze_settings', JSON.stringify({
            theme: currentTheme,
            language: currentLanguage
        }));
    } catch (e) { }
}

// [New] 다국어 시스템
const translations = {
    ko: { depth: '깊이', time: '시간', combo: '콤보', restart: '재시작', settings: '설정', theme: '색상 테마', language: '언어', auto: '자동', cyan: '청록색', purple: '보라색', green: '초록색', red: '빨간색', korean: '한국어', english: 'English', close: '닫기', descending: '하강 중...' },
    en: { depth: 'DEPTH', time: 'TIME', combo: 'COMBO', restart: 'RESTART', settings: 'SETTINGS', theme: 'Color Theme', language: 'Language', auto: 'Auto', cyan: 'Cyan', purple: 'Purple', green: 'Green', red: 'Red', korean: '한국어', english: 'English', close: 'Close', descending: 'DESCENDING...' }
};

function t(key) { return translations[currentLanguage][key] || key; }

// [New] 설정 모달
function showSettingsModal() {
    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.className = 'modal';
    modal.innerHTML = <div class=\"modal-content\"><h2>⚙️ +t('settings')+</h2><div class=\"setting-group\"><label>+t('theme')+</label><select id=\"theme-select\"><option value=\"auto\" +(currentTheme === 'auto' ? 'selected' : '')+>+t('auto')+</option><option value=\"cyan\" +(currentTheme === 'cyan' ? 'selected' : '')+>+t('cyan')+</option><option value=\"purple\" +(currentTheme === 'purple' ? 'selected' : '')+>+t('purple')+</option><option value=\"green\" +(currentTheme === 'green' ? 'selected' : '')+>+t('green')+</option><option value=\"red\" +(currentTheme === 'red' ? 'selected' : '')+>+t('red')+</option></select></div><div class=\"setting-group\"><label>+t('language')+</label><select id=\"language-select\"><option value=\"ko\" +(currentLanguage === 'ko' ? 'selected' : '')+>+t('korean')+</option><option value=\"en\" +(currentLanguage === 'en' ? 'selected' : '')+>+t('english')+</option></select></div><button id=\"close-settings\" class=\"hud-btn\">+t('close')+</button></div>;
    document.body.appendChild(modal);
    document.getElementById('theme-select').onchange = (e) => { currentTheme = e.target.value; saveSettings(); };
    document.getElementById('language-select').onchange = (e) => { currentLanguage = e.target.value; saveSettings(); updateHUD(); };
    document.getElementById('close-settings').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function updateHUD() {
    const hud = document.getElementById('hud');
    if (!hud) return;
    hud.innerHTML = <div class=\"hud-item\">+t('depth').toUpperCase()+ <span id=\"level-val\">+(currentDepth * 10)+m</span> +(bestDepth > 0 ? <span class=\"record\">⭐+(bestDepth * 10)+m</span> : '')+</div><div class=\"hud-item\">+t('time').toUpperCase()+ <span id=\"timer-val\">00:00</span></div>+(comboCount >= 3 ? <div class=\"hud-item combo\">+t('combo').toUpperCase()+ <span>x+comboCount+</span></div> : '')+<button id=\"mini-restart\" class=\"hud-btn\">+t('restart').toUpperCase()+</button><button id=\"settings-btn\" class=\"hud-btn\">⚙️</button>;
    const restartBtn = document.getElementById('mini-restart');
    if (restartBtn) { restartBtn.onclick = (e) => { e.stopPropagation(); if (\"vibrate\" in navigator) navigator.vibrate(30); currentDepth = 1; comboCount = 0; initGame(1); startTimer(); }; }
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) { settingsBtn.onclick = (e) => { e.stopPropagation(); showSettingsModal(); }; }
}
