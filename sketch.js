/**
 * Finger Maze: Abyssal Descent (Viscous & Heavy Tweak)
 * [Julian, Minho, Ken, Hana]
 */

let mazeWalls = [];
let particles = [];
let terrainBuffer;
let isStarted = false;
let isWon = false;

// 게임 상태 및 설정
let currentDepth = 1;

// [New] 설정 & 다국어 시스템
let currentLanguage = 'ko'; // 'ko', 'en'
const translations = {
    ko: {
        title: "Finger Maze",
        instruction: "미로를 따라 하얀 빛을 목적지까지 인도하세요.",
        start: "탐험 시작",
        depth: "깊이",
        restart: "재시작",
        color: "색상",
        descending: "하강 중..."
    },
    en: {
        title: "Finger Maze",
        instruction: "Guide the white light through the maze to the portal.",
        start: "START EXPLORING",
        depth: "DEPTH",
        restart: "RESTART",
        color: "COLOR",
        descending: "DESCENDING..."
    }
};

function t(key) {
    return translations[currentLanguage][key] || key;
}

// [New] 기록 시스템
let bestDepth = 0;

// [New] 테마 시스템
let currentTheme = 'auto'; // 'auto', 'cyan', 'purple', 'green', 'red'
const themes = {
    'cyan': { r: 0, g: 200, b: 255, bg: [10, 15, 20] },
    'purple': { r: 180, g: 80, b: 255, bg: [20, 10, 25] },
    'green': { r: 50, g: 230, b: 150, bg: [10, 20, 15] },
    'red': { r: 255, g: 60, b: 90, bg: [25, 10, 12] }
};

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
let sensitivity = 0.75; // [Tuning] 감도를 낮춰 정교함 확보
let groundFriction = 0.55; // [Tuning] 지면의 점성 저항 강화

// 구체 변수 (Rolling Ball)
let ballSize = 24; // [Update] 구슬 크기 증가
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

    // [New] 기록 & 설정 불러오기
    loadRecords();
    loadTheme();
    loadLanguage();

    initGame(1);

    // [New] 언어 선택 버튼 이벤트
    const koBtn = document.getElementById('lang-ko');
    const enBtn = document.getElementById('lang-en');

    if (koBtn) koBtn.onclick = () => setLanguage('ko');
    if (enBtn) enBtn.onclick = () => setLanguage('en');

    updateStartScreen(); // 시작 화면 텍스트 초기화

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
                updateHUDOnly();
            }
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

    const levelVal = document.getElementById('level-val');
    if (levelVal) levelVal.innerText = (depth * 10) + "m";

    // HUD 업데이트 (기록 표시 갱신을 위해)
    updateHUDOnly();

    isWon = false;

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
        return d > (cols + rows) / 2.8 && cellY > 120; // HUD 회피
    });

    let goalCell = potentialGoals.length > 0 ? potentialGoals[Math.floor(Math.random() * potentialGoals.length)] : grid[grid.length - 1];
    goal = {
        x: (goalCell.c + 0.5) * cellSize,
        y: (goalCell.r + 0.5) * cellSize,
        r: cellSize * 0.32
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
            // [Fix] 묵직한 가속을 위해 입력값을 댐핑 처리
            let targetDx = (ciX - prevInputX) * sensitivity;
            let targetDy = (ciY - prevInputY) * sensitivity;

            // 점성 저항 적용 (이전보다 절반만 힘이 전달됨)
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
                    terrainBuffer.fill(18, 16, 14, 4); // 더 은은한 궤적
                    terrainBuffer.ellipse(pointerX, pointerY, ballSize * 0.7, ballSize * 0.7);
                } else {
                    // [Update] 화면 흔들림 제거 (shakeAmount 비활성화)
                    if ("vibrate" in navigator) navigator.vibrate(20);
                    let pDX = pointerX - colW.x, pDY = pointerY - colW.y;
                    let dW = dist(0, 0, pDX, pDY);
                    if (dW > 0) {
                        // 반발력을 22 -> 10으로 낮춰 자석처럼 붙는 느낌 억제
                        pointerX += (pDX / dW) * 10;
                        pointerY += (pDY / dW) * 10;
                    }
                    break;
                }
            }
        }
    } else {
        isMoving = false;
        ballVelX *= 0.3; ballVelY *= 0.3; // 정지 마찰력 강화
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

        let tCol = getThemeColor();
        updateHUDCSS(tCol); // [New] 상단 메뉴 CSS 실시간 업데이트

        // 테마에 따른 배경색 적용 (기본값 또는 테마별 지정값)
        if (tCol.bg) {
            background(tCol.bg[0], tCol.bg[1], tCol.bg[2]);
        } else {
            // Auto 모드나 bg 정보가 없는 경우 동적으로 어두운 배경 생성
            background(tCol.r * 0.05, tCol.g * 0.05, tCol.b * 0.05);
        }

        drawFloorTexture();

        terrainBuffer.push();
        terrainBuffer.blendMode(REMOVE);
        terrainBuffer.fill(255, 1.0); // 자국이 더 오래 남게 (Heal 속도 하향)
        terrainBuffer.rect(0, 0, width, height);
        terrainBuffer.pop();
        image(terrainBuffer, 0, 0);

        // [Update] 화면 흔들림 효과 완전 제거

        push();
        drawVisibleMaze();
        drawGoal();

        if (isStarted && !isWon) {
            if (goal && dist(pointerX, pointerY, goal.x, goal.y) < goal.r * 0.45) winGame();

            textAlign(CENTER, CENTER);
            fill(100, 150, 255, 40);
            textSize(10);
            text("DEEP LINK ENTRY", startPos.x, startPos.y);
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
    let visibilityRadius = 180; // 가시 반경

    for (let wall of mazeWalls) {
        let distToPlayer = dist(wall.x, wall.y, pointerX, pointerY);
        if (distToPlayer < visibilityRadius) {
            push(); translate(wall.x, wall.y);
            noStroke();
            // 거리에 따른 페이드 효과
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

    // Fog of War: 포털도 가시 범위 내에서만 표시
    let distToGoal = dist(pointerX, pointerY, goal.x, goal.y);
    if (distToGoal > 200) return; // 가시 범위 밖이면 숨김

    push();
    translate(goal.x, goal.y);

    let tCol = getThemeColor();

    // 1. 외곽 글로우
    noStroke();
    for (let i = 5; i > 0; i--) {
        fill(tCol.r, tCol.g, tCol.b, (6 - i) * 8);
        ellipse(0, 0, goal.r * 3.5 + i * 15, goal.r * 3.5 + i * 15);
    }

    // 2. 회전하는 육각형 링들
    noFill();
    for (let layer = 0; layer < 4; layer++) {
        push();
        rotate(frameCount * 0.02 * (layer % 2 === 0 ? 1 : -1));
        stroke(tCol.r, tCol.g - layer * 20, tCol.b, 180 - layer * 30);
        strokeWeight(2 - layer * 0.3);
        let hexSize = goal.r * (2.2 - layer * 0.4);
        drawHexagon(0, 0, hexSize);
        pop();
    }

    // 3. 내부 코어 (Pulsing Core)
    let pulse = sin(frameCount * 0.08) * 0.2 + 1;
    noStroke();
    fill(tCol.r, tCol.g + 50, tCol.b + 50, 200);
    ellipse(0, 0, goal.r * 1.5 * pulse, goal.r * 1.5 * pulse);
    fill(tCol.r + 50, tCol.g + 100, tCol.b + 100, 150);
    ellipse(0, 0, goal.r * 1.0 * pulse, goal.r * 1.0 * pulse);
    fill(tCol.r + 100, tCol.g + 150, tCol.b + 150, 100);
    ellipse(0, 0, goal.r * 0.5 * pulse, goal.r * 0.5 * pulse);

    // 4. 회전 입자들
    for (let i = 0; i < 8; i++) {
        let angle = (frameCount * 0.03) + (i * TWO_PI / 8);
        let px = cos(angle) * goal.r * 2;
        let py = sin(angle) * goal.r * 2;
        fill(tCol.r, tCol.g + 50, tCol.b + 50, 200);
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

    let tCol = getThemeColor();

    // 1. 외곽 글로우
    noStroke();
    for (let i = 3; i > 0; i--) {
        fill(tCol.r, tCol.g, tCol.b, (4 - i) * 15);
        ellipse(0, 0, (ballSize + i * 12) * scale);
    }

    // 2. 회전하는 육각형 링 (작은 버전)
    noFill();
    push();
    rotate(frameCount * 0.03);
    stroke(tCol.r, tCol.g + 20, tCol.b + 20, 150);
    strokeWeight(1.5);
    drawHexagon(0, 0, ballSize * 0.6 * scale);
    pop();

    // 3. 구슬 본체
    let s = ballSize * scale;
    noStroke();
    fill(20, 25, 35); // 어두운 코어
    ellipse(0, 0, s, s);
    fill(tCol.r, tCol.g - 20, tCol.b - 20, 100); // 바디 컬러
    ellipse(0, 0, s * 0.85, s * 0.85);

    // 4. 중앙 빛나는 코어
    fill(tCol.r, tCol.g + 50, tCol.b + 50, 200);
    ellipse(0, 0, s * 0.4, s * 0.4);
    fill(200, 255, 255);
    ellipse(0, 0, s * 0.2, s * 0.2);

    pop();
}

function winGame() {
    if (isWon) return;
    isWon = true;

    if (currentDepth > bestDepth) {
        bestDepth = currentDepth;
        saveRecords();
    }

    if ("vibrate" in navigator) navigator.vibrate([100, 50, 200]);
    setTimeout(() => { currentDepth++; initGame(currentDepth); }, 2000);
}

function drawWinScreen() {
    textAlign(CENTER, CENTER); fill(255); textSize(35); text("DESCENDING...", width / 2, height / 2);
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

// [New] 기록 시스템 함수들
function loadRecords() {
    try {
        let saved = localStorage.getItem('fingerMaze_records');
        if (saved) {
            let data = JSON.parse(saved);
            bestDepth = data.bestDepth || 0;
        }
    } catch (e) { console.error("Failed to load records:", e); }
}

function saveRecords() {
    try {
        localStorage.setItem('fingerMaze_records', JSON.stringify({
            bestDepth: bestDepth
        }));
    } catch (e) { console.error("Failed to save records:", e); }
}

function updateHUDOnly() {
    const hud = document.getElementById('hud');
    if (!hud || !isStarted) return;

    hud.innerHTML = `
        <div class="hud-item">${t('depth').toUpperCase()} <span id="level-val">${currentDepth * 10}m</span> ${bestDepth > 0 ? `<span class="record">⭐${bestDepth * 10}m</span>` : ''}</div>
        <div class="hud-item-btn-group">
            <button id="mini-restart" class="hud-btn">${t('restart').toUpperCase()}</button>
            <button id="theme-btn" class="hud-btn">${t('color').toUpperCase()}</button>
        </div>
    `;

    // 버튼 이벤트 다시 연결
    const restartBtn = document.getElementById('mini-restart');
    if (restartBtn) {
        restartBtn.onclick = (e) => {
            e.stopPropagation();
            if ("vibrate" in navigator) navigator.vibrate(30);
            currentDepth = 1;
            initGame(1);
        };
    }

    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        themeBtn.onclick = (e) => {
            e.stopPropagation();
            cycleTheme();
        };
    }
}

// [New] 테마 시스템 함수들
function getThemeColor() {
    if (currentTheme === 'auto') {
        const depth = currentDepth;
        if (depth < 5) return themes['cyan'];
        if (depth < 10) return { r: 50, g: 200, b: 200 };
        if (depth < 20) return { r: 100, g: 150, b: 255 };
        if (depth < 30) return themes['purple'];
        if (depth < 50) return { r: 255, g: 100, b: 200 };
        return themes['red'];
    }
    return themes[currentTheme] || themes['cyan'];
}

function cycleTheme() {
    const themeKeys = ['auto', 'cyan', 'purple', 'green', 'red'];
    let idx = themeKeys.indexOf(currentTheme);
    idx = (idx + 1) % themeKeys.length;
    currentTheme = themeKeys[idx];
    saveTheme();
    if ("vibrate" in navigator) navigator.vibrate(20);
}

function loadTheme() {
    try {
        let saved = localStorage.getItem('fingerMaze_theme');
        if (saved) currentTheme = saved;
    } catch (e) { }
}

function saveTheme() {
    try {
        localStorage.setItem('fingerMaze_theme', currentTheme);
    } catch (e) { }
}

// [New] HUD CSS 변수 업데이트 함수
function updateHUDCSS(col) {
    const root = document.documentElement;
    const r = col.r, g = col.g, b = col.b;
    root.style.setProperty('--theme-color', `rgb(${r}, ${g}, ${b})`);
    root.style.setProperty('--theme-glow', `rgba(${r}, ${g}, ${b}, 0.5)`);
    root.style.setProperty('--theme-bg-glow', `rgba(${r}, ${g}, ${b}, 0.1)`);
}

// [New] 언어 관련 함수들
function setLanguage(lang) {
    currentLanguage = lang;
    saveLanguage();

    // 버튼 UI 업데이트
    document.getElementById('lang-ko').classList.toggle('active', lang === 'ko');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');

    updateStartScreen();
    if (isStarted) updateHUDOnly();
    if ("vibrate" in navigator) navigator.vibrate(20);
}

function updateStartScreen() {
    const title = document.getElementById('title');
    const instr = document.getElementById('instruction');
    const startBtn = document.getElementById('start-button');

    if (title) title.innerText = t('title');
    if (instr) instr.innerText = t('instruction');
    if (startBtn) startBtn.innerText = t('start');
}

function loadLanguage() {
    try {
        let saved = localStorage.getItem('fingerMaze_lang');
        if (saved) {
            currentLanguage = saved;
            setLanguage(saved);
        }
    } catch (e) { }
}

function saveLanguage() {
    try {
        localStorage.setItem('fingerMaze_lang', currentLanguage);
    } catch (e) { }
}
