// ==================== 1. 资产路径配置 ====================
let imgStartBg;   // 初始背景.png
let imgTitle;     // 大闹天宫标题.svg
let imgStartBtn;  // 开始游戏.svg
let imgStartIcon; // icon1.svg（按钮底图）
let imgSky, imgPalace, imgClouds, imgSilhouette, imgFog; // 背景资源
let imgWukong, imgPeach;          // 角色与道具
let imgBlackCloud1, imgBlackCloud2; // 障碍物乌云变体
let imgHpPeach;                    // 血量槽图标（peach1.svg）
let fusionFont;                    // 像素字体（fusion.otf）
let sfxPick;                       // 吃桃音效（pickupCoin (5).wav）
let sfxHit;                        // 撞乌云音效（程序化合成）
let audioCtx;                      // Web Audio API 上下文（懒加载）
let bgmStart;                      // 初始界面 BGM（begin1.mp3）
let bgmGame;                       // 游戏内 BGM（bgm.mp3）
let bgmStarted = false;            // BGM 是否已启动（避免重复启动）
let currentBgm = null;             // 当前正在播放的 BGM 实例
let currentBgmTargetVol = 0;       // 目标音量（用于淡入淡出）
let currentBgmFadeSpeed = 0;       // 当前淡入淡出速度
let pendingBgm = null;             // 待切换的 BGM（淡出完成后自动启动）

// ==================== 2. 游戏核心变量 ====================
let gameState = "START";
let titleYOffset = 0;
let btnAlpha = 255;
let transitionTimer = 0;
let maxTransitionFrames = 45;
let titleTransY = 0;
let startBtnScale = 1.0;

// BGM 音量控制常量（提到顶部供 preload 使用）
const BGM_VOL = 0.12;        // BGM 目标音量（足够小，不盖过音效）
const BGM_FADE_SPEED = 0.012; // 淡入淡出速度（每帧）
let screenFlash = 0;

let wukong;
let bgSkyLayer, bgPalaceLayer, bgSilhouetteLayer, bgFogLayer, bgCloudsLayer;
let obstacles = [];
let fruits = [];
let score = 0;
let hp = 3;
let maxHp = 3;
let gameOver = false;
let isPaused = false;
let keys = { up: false, down: false };
let eatPeachGif;

function updateGifVisibility() {
  if (!eatPeachGif) return;
  if (gameState === "START") {
    eatPeachGif.classList.remove("hidden");
  } else {
    eatPeachGif.classList.add("hidden");
  }
}

function preload() {
  // 全部用 ./ 显式相对路径，确保 GitHub Pages 子路径下也能正确加载
  imgStartBg = loadImage('./assets/svg/bg/初始背景.png');
  imgTitle = loadImage('./assets/svg/ui/大闹天宫标题.svg');
  imgStartBtn = loadImage('./assets/svg/ui/开始游戏.svg');
  imgStartIcon = loadImage('./assets/svg/ui/icon1.svg');
  imgSky = loadImage('./assets/svg/bg/背景天空.png');
  imgPalace = loadImage('./assets/svg/bg/天宫.png');
  imgClouds = loadImage('./assets/svg/bg/背景云层.png');
  imgSilhouette = loadImage('./assets/svg/bg/剪影.png');
  imgFog = loadImage('./assets/svg/bg/雾.png');
  imgWukong = loadImage('./assets/svg/character/悟空.svg');
  imgPeach = loadImage('./assets/svg/items/peach.svg');
  imgBlackCloud1 = loadImage('./assets/svg/character/blackcloud1.svg');
  imgBlackCloud2 = loadImage('./assets/svg/character/blackcloud2.svg');
  imgHpPeach = loadImage('./assets/svg/ui/peach1.svg');
  // 加载 fusion 像素字体
  fusionFont = loadFont('./assets/fonts/fusion.otf');

  // 加载吃桃音效（用浏览器原生 Audio，无需 p5.sound 库）
  sfxPick = new Audio('./assets/sfx/ui/pickupCoin%20(5).wav');
  sfxPick.preload = 'auto';
  sfxPick.volume = 0.15;

  // 加载背景音乐
  bgmStart = new Audio('./assets/sfx/music/begin1.mp3');
  bgmStart.loop = true;
  bgmStart.volume = BGM_VOL;

  bgmGame = new Audio('./assets/sfx/music/bgm.mp3');
  bgmGame.loop = true;
  bgmGame.volume = BGM_VOL;
}

function setup() {
  let canvas = createCanvas(320, 180);
  // 显式把 canvas 挂到 body，避免 GitHub Pages 子路径下父节点异常
  canvas.parent(document.body);
  noSmooth();
  // 全局应用 fusion 字体
  if (fusionFont) textFont(fusionFont);
  textSize(12);

  // 安全获取 DOM 元素，找不到不抛错
  try {
    eatPeachGif = document.getElementById('eatPeachGif');
    positionGifOverCanvas();
    updateGifVisibility();
  } catch (e) {
    console.warn('GIF 元素初始化失败（不影响游戏）:', e);
  }

  let canvasElement = document.getElementById('defaultCanvas0');
  if (canvasElement) {
    canvasElement.addEventListener('click', function() {
      canvasElement.focus();
    });
    canvasElement.setAttribute('tabindex', '0');
    canvasElement.style.outline = 'none';
    setTimeout(function() {
      canvasElement.focus();
    }, 100);
  }

  window.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
    }
    if (e.key === ' ') {
      e.preventDefault();
    }
  });

  window.addEventListener('resize', positionGifOverCanvas);

  // 启动初始 BGM
  if (bgmStart) {
    currentBgm = bgmStart;
    currentBgmTargetVol = BGM_VOL;
    currentBgmFadeSpeed = 0;
    // 尝试自动播放
    bgmStart.play().catch(err => {
      console.warn('自动播放失败，等待用户交互:', err);
    });
  }

  // 用户首次任意交互时，确保 BGM 在播放
  // 关键：只设置一次 bgmStart.volume = BGM_VOL，不要在后续点击中重置
  // 否则会覆盖 updateBgm 正在进行的淡出
  function ensureBgmPlay() {
    if (bgmStart && bgmStart.paused) {
      bgmStart.currentTime = 0;
      // 不要重置 volume！保留 updateBgm 设置的当前音量
      bgmStart.play().catch(err => console.warn('BGM 播放失败:', err));
    }
  }
  document.addEventListener('pointerdown', ensureBgmPlay, { once: true });
  document.addEventListener('keydown', ensureBgmPlay, { once: true });
  document.addEventListener('touchstart', ensureBgmPlay, { once: true });

  wukong = new Wukong();
  // === 16:9 画布 5 层视差背景（从远到近） ===
  bgSkyLayer = new BackgroundLayer(imgSky, 0.2, 255, true, 1.0);              // 天空（最远，慢速）
  bgSilhouetteLayer = new BackgroundLayer(imgSilhouette, 0.4, 255, true, 0.8, -10); // 剪影（上移 10）
  bgFogLayer = new BackgroundLayer(imgFog, 0.55, 200, true, 1.0, 5);           // 雾
  bgPalaceLayer = new BackgroundLayer(imgPalace, 0.7, 255, true, 1.0);         // 天宫（放大至 1.0 cover）
  bgCloudsLayer = new BackgroundLayer(imgClouds, 1.2, 242, true, 1.0);         // 云层（最近，透明度 95%）
}

// ==================== 像素字体逐字绘制工具 ====================
// 字符宽度跟随当前 textSize 动态计算；数字自动使用 0.6 倍步进（更紧凑）
function drawPixelText(str, startX, baseY, charGap = 0) {
  let cursorX = startX;
  let charW = textSize();
  textAlign(LEFT, TOP);
  for (let i = 0; i < str.length; i++) {
    let ch = str[i];
    text(ch, cursorX, baseY);
    // 数字字符步进 = 字号 × 0.6（紧凑），其他字符 = 字号
    let step = (ch >= '0' && ch <= '9') ? charW * 0.6 : charW;
    cursorX += step + charGap;
  }
}

// 居中绘制（先算总宽，再回退起点）
function drawPixelTextCentered(str, centerX, baseY, charGap = 0) {
  let charW = textSize();
  // 居中时按实际总宽计算（数字部分用 0.6 倍）
  let totalW = 0;
  for (let i = 0; i < str.length; i++) {
    let step = (str[i] >= '0' && str[i] <= '9') ? charW * 0.6 : charW;
    totalW += step;
    if (i < str.length - 1) totalW += charGap;
  }
  let startX = centerX - totalW / 2;
  drawPixelText(str, startX, baseY, charGap);
}

function positionGifOverCanvas() {
  if (!eatPeachGif) return;
  let canvasElement = document.getElementById('defaultCanvas0');
  if (!canvasElement) return;
  let rect = canvasElement.getBoundingClientRect();
  // 计算 canvas 的真实屏幕中心点（向下偏移 20%）
  let centerX = rect.left + rect.width / 2;
  let centerY = rect.top + rect.height * 0.6;

  // === GIF 大小随 canvas 实际显示尺寸等比例缩放 ===
  // 基础参考：设计画布 320×180，基础 GIF 48×48（占画布高度约 27%）
  const BASE_H = 180;
  const GIF_BASE_SIZE = 54;  // 72 → 48（缩小约 33%）
  let scaleRatio = rect.height / BASE_H;
  let gifSize = Math.round(GIF_BASE_SIZE * scaleRatio);
  // 防止极小或极大（窗口异常时）
  gifSize = Math.max(16, Math.min(gifSize, 720));

  // 强制覆盖 CSS（用 setProperty 确保优先级）
  eatPeachGif.style.setProperty('position', 'fixed', 'important');
  eatPeachGif.style.setProperty('left', centerX + 'px', 'important');
  eatPeachGif.style.setProperty('top', centerY + 'px', 'important');
  eatPeachGif.style.setProperty('width', gifSize + 'px', 'important');
  eatPeachGif.style.setProperty('height', gifSize + 'px', 'important');
  eatPeachGif.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
  // 同步显隐
  updateGifVisibility();
}

function draw() {
  // 始终更新 BGM 淡入淡出
  updateBgm();

  if (gameState === "START") {
    if (imgStartBg) image(imgStartBg, 0, 0, width, height);
    else background(20, 30, 50);

    titleYOffset = sin(frameCount * 0.05) * 1.5;
    positionGifOverCanvas();
    push();
    translate(width / 2, 45 + titleYOffset);
    imageMode(CENTER);
    if (imgTitle) {
      let titleMaxW = 270;
      let titleMaxH = 54;
      let titleRatio = imgTitle.width / imgTitle.height;
      let titleW, titleH;
      if (titleRatio >= titleMaxW / titleMaxH) {
        titleW = titleMaxW;
        titleH = titleW / titleRatio;
      } else {
        titleH = titleMaxH;
        titleW = titleH * titleRatio;
      }
      image(imgTitle, 0, 0, titleW, titleH);
    }
    pop();

    btnAlpha = map(sin(frameCount * 0.08), -1, 1, 100, 255);

    // === 按钮：icon 和"开始游戏"文字同一中心点（icon 在下，文字在上）===
    push();
    translate(width / 2, height * 0.85);
    imageMode(CENTER);

    // 图层 1：icon（先绘制 = 底层，与文字同位置）
    if (imgStartIcon) {
      let iconMaxW = 50;
      let iconMaxH = 20;
      let iconRatio = imgStartIcon.width / imgStartIcon.height;
      let iconW, iconH;
      if (iconRatio >= iconMaxW / iconMaxH) {
        iconW = iconMaxW;
        iconH = iconW / iconRatio;
      } else {
        iconH = iconMaxH;
        iconW = iconH * iconRatio;
      }
      tint(255, btnAlpha);
      image(imgStartIcon, 0, 0, iconW, iconH);
    }

    // 图层 2："开始游戏"文字（后绘制 = 在 icon 之上，同一中心点）
    noTint();
    if (fusionFont) textFont(fusionFont);
    fill(0, 0, 0, btnAlpha);
    textSize(8);
    textAlign(LEFT, TOP);
    let btnText = "开始游戏";
    let btnTextW = btnText.length * 8;
    let cursorX = -btnTextW / 2;
    for (let i = 0; i < btnText.length; i++) {
      text(btnText[i], cursorX, -4);
      cursorX += 8;
    }
    pop();
  }

  else if (gameState === "TRANSITION") {
    if (imgSky) image(imgSky, 0, 0, width, height);
    else background(135, 206, 235);

    let progress = transitionTimer / maxTransitionFrames;

    let bgAlpha = map(transitionTimer, 0, maxTransitionFrames, 255, 0);
    push();
    tint(255, bgAlpha);
    if (imgStartBg) image(imgStartBg, 0, 0, width, height);
    pop();

    titleTransY = -pow(progress, 3) * 150;
    push();
    translate(width / 2, 45 + titleYOffset + titleTransY);
    imageMode(CENTER);
    tint(255, bgAlpha);
    if (imgTitle) {
      let titleMaxW = 270;
      let titleMaxH = 54;
      let titleRatio = imgTitle.width / imgTitle.height;
      let titleW, titleH;
      if (titleRatio >= titleMaxW / titleMaxH) {
        titleW = titleMaxW;
        titleH = titleW / titleRatio;
      } else {
        titleH = titleMaxH;
        titleW = titleH * titleRatio;
      }
      image(imgTitle, 0, 0, titleW, titleH);
    }
    pop();

    let btnFade = map(transitionTimer, 0, maxTransitionFrames * 0.4, 255, 0);
    if (btnFade > 0) {
      push();
      translate(width / 2, height * 0.82);
      imageMode(CENTER);
      // 不再 scale 放大（已去除点击放大效果）
      tint(255, btnFade);
      let btnMaxW = 60;
      let btnMaxH = 20;
      let btnRatio = imgStartIcon ? imgStartIcon.width / imgStartIcon.height : (100 / 25);
      let btnW, btnH;
      if (btnRatio >= btnMaxW / btnMaxH) {
        btnW = btnMaxW;
        btnH = btnW / btnRatio;
      } else {
        btnH = btnMaxH;
        btnW = btnH * btnRatio;
      }
      if (imgStartIcon) image(imgStartIcon, 0, 0, btnW, btnH);

      // "开始游戏" 文字
      noTint();
      tint(255, btnFade);
      if (fusionFont) textFont(fusionFont);
      fill(0, 0, 0, btnFade);
      textSize(8);
      textAlign(LEFT, TOP);
      let btnText = "开始游戏";
      let btnTextW = btnText.length * 8;
      let cursorX = -btnTextW / 2;
      for (let i = 0; i < btnText.length; i++) {
        text(btnText[i], cursorX, -4);
        cursorX += 8;
      }
      pop();
    }
    noTint();

    if (screenFlash > 0) {
      fill(255, 255, 255, screenFlash);
      rect(0, 0, width, height);
      screenFlash -= 25;
    }

    transitionTimer++;
    if (transitionTimer >= maxTransitionFrames) {
      gameState = "PLAY";
      // 切换到游戏 BGM
      switchBgm(bgmGame);
      updateGifVisibility();
    }
  }

  else if (gameState === "PLAY") {
    enterFormalGame();
  }
}

function enterFormalGame() {
  // 16:9 画布 5 层视差背景渲染
  if (!isPaused) {
    bgSkyLayer.update();
    bgSilhouetteLayer.update();
    bgFogLayer.update();
    bgPalaceLayer.update();
    bgCloudsLayer.update();
  }
  bgSkyLayer.display();         // 天空（最远，speed 0.2）
  bgSilhouetteLayer.display();  // 剪影（speed 0.4）
  bgFogLayer.display();         // 雾（speed 0.55）
  bgPalaceLayer.display();      // 天宫（speed 0.7）
  bgCloudsLayer.display();      // 云层（最近，speed 1.2，透明度 95%）

  if (gameOver) {
    showGameOverScreen();
    return;
  }

  if (isPaused) {
    fill(0, 0, 0, 100);
    rect(0, 0, width, height);
    fill(255);
    // 24px = 12 的整数倍，逐字居中绘制
    textSize(24);
    drawPixelTextCentered("已暂停", width / 2, height / 2 - 18, 0);
    textSize(12);
    drawPixelTextCentered("按空格键继续", width / 2, height / 2 + 10, 0);
    return;
  }

  wukong.control();
  wukong.update();
  wukong.display();

  if (frameCount % 80 === 0) {
    obstacles.push(new ObstacleCloud());
  }
  if (frameCount % 100 === 0 && random(1) < 0.7) {
    fruits.push(new ItemPeach());
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    obstacles[i].display();

    if (obstacles[i].hits(wukong)) {
      if (!wukong.isInvincible) {
        hp--;
        wukong.triggerInvincible();
        // 播放撞击音效
        playHitSound();
        if (hp <= 0) gameOver = true;
      }
      obstacles.splice(i, 1);
      continue;
    }

    if (obstacles[i].offscreen()) {
      obstacles.splice(i, 1);
      score += 10;
    }
  }

  for (let i = fruits.length - 1; i >= 0; i--) {
    fruits[i].update();
    fruits[i].display();

    if (fruits[i].hits(wukong)) {
      if (hp < maxHp) {
        hp++;
      }
      score += 50;
      // 播放吃桃音效
      if (sfxPick) {
        sfxPick.currentTime = 0;
        sfxPick.play().catch(err => console.warn('音效播放失败:', err));
      }
      fruits.splice(i, 1);
      continue;
    }

    if (fruits[i].offscreen()) {
      fruits.splice(i, 1);
    }
  }

  drawUI();
}

function keyPressed() {
  if (keyCode === UP_ARROW) {
    keys.up = true;
  }
  if (keyCode === DOWN_ARROW) {
    keys.down = true;
  }
  if (keyCode === 32) {
    if (gameState === "START") {
      gameState = "TRANSITION";
      transitionTimer = 0;
      startBtnScale = 1.0;
      screenFlash = 220;
      updateGifVisibility();
    } else if (gameState === "PLAY" && !gameOver) {
      isPaused = !isPaused;
    }
  }
}

function keyReleased() {
  if (keyCode === UP_ARROW) {
    keys.up = false;
  }
  if (keyCode === DOWN_ARROW) {
    keys.down = false;
  }
}

function mousePressed() {
  if (gameState === "START") {
    gameState = "TRANSITION";
    transitionTimer = 0;
    startBtnScale = 1.0;
    screenFlash = 220;
    updateGifVisibility();
    // BGM 启动由 document 级别事件监听处理（mousePressed 触发的 pointerdown 会启动它）
  }
  if (gameOver) {
    resetGame();
  }
}

// ==================== 3. 核心功能类定义 ====================

// --- 悟空类（升级版：具有受力反馈） ---
class Wukong {
  constructor() {
    this.w = 50;
    this.h = 42;
    this.x = 20;
    this.y = height / 2 - this.h / 2;

    this.vy = 0;
    this.accel = 0.4;
    this.friction = 0.85;
    this.maxSpeed = 4;

    this.angle = 0;
    this.particles = [];

    this.isInvincible = false;
    this.invincibleTimer = 0;
    this.flashInterval = 6;
  }

  control() {
    if (keys.up) {
      this.vy -= this.accel;
    }
    if (keys.down) {
      this.vy += this.accel;
    }
  }

  update() {
    this.vy *= this.friction;
    this.vy = constrain(this.vy, -this.maxSpeed, this.maxSpeed);
    this.y += this.vy;

    if (this.y < 0) {
      this.y = 0;
      this.vy *= -0.3;
    }
    if (this.y > height - this.h) {
      this.y = height - this.h;
      this.vy *= -0.3;
    }

    let targetAngle = map(this.vy, -this.maxSpeed, this.maxSpeed, -0.15, 0.15);
    this.angle = lerp(this.angle, targetAngle, 0.2);

    if (frameCount % 2 === 0) {
      this.particles.push(new JetParticle(this.x + this.w * 0.25, this.y + this.h - this.h * 0.24, this.vy));
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].isDead()) {
        this.particles.splice(i, 1);
      }
    }

    if (this.isInvincible) {
      this.invincibleTimer--;
      if (this.invincibleTimer <= 0) this.isInvincible = false;
    }
  }

  display() {
    for (let p of this.particles) {
      p.display();
    }

    if (this.isInvincible && Math.floor(frameCount / this.flashInterval) % 2 === 0) {
      return;
    }

    push();
    translate(this.x + this.w / 2, this.y + this.h / 2);
    rotate(this.angle);

    let stretchX = 1 + abs(this.vy) * 0.015;
    let stretchY = 1 - abs(this.vy) * 0.015;
    scale(stretchX, stretchY);

    if (imgWukong) {
      image(imgWukong, -this.w / 2, -this.h / 2, this.w, this.h);
    } else {
      fill(255, 204, 0);
      rect(-this.w / 2, -this.h / 2, this.w, this.h);
    }
    pop();
  }

  triggerInvincible() {
    this.isInvincible = true;
    this.invincibleTimer = 60;
  }
}

// --- 筋斗云像素尾迹粒子类 ---
class JetParticle {
  constructor(x, y, playerVy) {
    this.x = x;
    this.y = y + random(-3, 3);
    this.vx = random(-2, -0.5);
    this.vy = playerVy * 0.2 + random(-0.2, 0.2);
    this.size = random(2, 5);
    this.alpha = 200;
    this.fadeSpeed = random(4, 7);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.fadeSpeed;
  }

  display() {
    noStroke();
    fill(255, 255, 255, this.alpha);
    rect(this.x, this.y, Math.floor(this.size), Math.floor(this.size));
  }

  isDead() {
    return this.alpha <= 0;
  }
}

// --- 视差背景滚动类 ---
class BackgroundLayer {
  constructor(img, speed, alpha = 255, keepRatio = false, scaleFactor = 1.0, yOffset = 0) {
    this.img = img;
    this.speed = speed;
    this.alpha = alpha;
    this.keepRatio = keepRatio;
    this.scaleFactor = scaleFactor;
    this.yOffset = yOffset;  // 垂直偏移（负值上移）

    if (this.keepRatio && this.img) {
      let imgRatio = this.img.width / this.img.height;
      let canvasRatio = width / height;
      // 先按 cover 模式计算填满尺寸，再乘以缩放系数
      let baseW, baseH;
      if (imgRatio > canvasRatio) {
        baseH = height;
        baseW = baseH * imgRatio;
      } else {
        baseW = width;
        baseH = baseW / imgRatio;
      }
      this.drawW = baseW * this.scaleFactor;
      this.drawH = baseH * this.scaleFactor;
      this.x1 = 0;
      this.x2 = this.drawW;
    } else {
      this.drawW = width;
      this.drawH = height;
      this.x1 = 0;
      this.x2 = width;
    }
  }

  update() {
    this.x1 -= this.speed;
    this.x2 -= this.speed;

    if (this.x1 <= -this.drawW) this.x1 = this.x2 + this.drawW;
    if (this.x2 <= -this.drawW) this.x2 = this.x1 + this.drawW;
  }

  display() {
    if (this.img) {
      tint(255, 255, 255, this.alpha);
      // 居中显示
      let drawX1 = this.x1 + (width - this.drawW) / 2;
      let drawX2 = this.x2 + (width - this.drawW) / 2;
      let drawY = (height - this.drawH) / 2 + this.yOffset;
      image(this.img, drawX1, drawY, this.drawW, this.drawH);
      image(this.img, drawX2, drawY, this.drawW, this.drawH);
      noTint();
    }
  }
}

// --- 障碍物（乌云）类 ---
class ObstacleCloud {
  constructor() {
    this.w = 40;
    this.h = 25;
    this.x = width;
    this.y = random(10, height - this.h - 10);
    this.speed = random(2, 4);
    // 随机选择乌云变体 1 或 2
    this.img = random() < 0.5 ? imgBlackCloud1 : imgBlackCloud2;
  }

  update() {
    this.x -= this.speed;
  }

  display() {
    if (this.img) {
      image(this.img, this.x, this.y, this.w, this.h);
    } else {
      // 资源缺失时的占位
      fill(60, 64, 67);
      noStroke();
      ellipse(this.x + 15, this.y + 10, 25, 20);
      ellipse(this.x + 28, this.y + 12, 18, 15);
      ellipse(this.x + 8, this.y + 14, 15, 12);
    }
  }

  // 矩形碰撞检测算法
  hits(player) {
    return (this.x < player.x + player.w &&
            this.x + this.w > player.x &&
            this.y < player.y + player.h &&
            this.y + this.h > player.y);
  }

  offscreen() {
    return this.x < -this.w;
  }
}

// --- 道具（桃子）类 ---
class ItemPeach {
  constructor() {
    this.w = 20;
    this.h = 20;
    this.x = width;
    this.y = random(20, height - this.h - 20);
    this.speed = 1.5;
  }

  update() {
    this.x -= this.speed;
  }

  display() {
    if (imgPeach) {
      image(imgPeach, this.x, this.y, this.w, this.h);
    } else {
      // 占位粉色小圆
      fill(255, 182, 193);
      ellipse(this.x + this.w/2, this.y + this.h/2, this.w);
    }
  }

  hits(player) {
    return (this.x < player.x + player.w &&
            this.x + this.w > player.x &&
            this.y < player.y + player.h &&
            this.y + this.h > player.y);
  }

  offscreen() {
    return this.x < -this.w;
  }
}

// ==================== 4. UI 与辅助函数 ====================

function drawUI() {
  // 分数显示（10px 像素字体，与血量桃子高度一致，横向对齐 Y=5）
  fill(255);
  textSize(10);
  drawPixelText("得分 " + score, 6, 5, 0);

  // 血量槽：3 个 peach1.svg 图标（10x10 像素，位置与原方块一致）
  if (imgHpPeach) {
    imageMode(CORNER);
    for (let i = 0; i < maxHp; i++) {
      if (i < hp) {
        // 有血：原色
        noTint();
      } else {
        // 扣血：灰度低透明
        tint(80, 150);
      }
      image(imgHpPeach, width - 48 + i * 14, 5, 10, 10);
    }
    noTint();
  } else {
    // 兜底：图片未加载完时显示方块
    for (let i = 0; i < maxHp; i++) {
      if (i < hp) fill(255, 50, 50);
      else fill(80);
      rect(width - 30 + i * 9, 6, 7, 7);
    }
  }
}

function showGameOverScreen() {
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);

  // 标题 24px（12 的整数倍），逐字居中
  fill(255, 50, 50);
  textSize(24);
  drawPixelTextCentered("游戏结束", width / 2, height / 2 - 32, 0);

  // 副信息 12px，行间距拉大到 20 像素
  fill(255);
  textSize(12);
  drawPixelTextCentered("最终得分 " + score, width / 2, height / 2 + 4, 0);
  drawPixelTextCentered("点击重新开始", width / 2, height / 2 + 40, 0);
}

function resetGame() {
  gameState = "START";
  hp = 3;
  score = 0;
  isPaused = false;
  obstacles = [];
  fruits = [];
  updateGifVisibility();
  gameOver = false;
}

// ==================== BGM 控制系统 ====================
// 切换 BGM 时：先标记旧 BGM 淡出 → 音量降到 0 后自动停止 → 再淡入新 BGM
// 完全在主循环中由 updateBgm 控制，避免 setTimeout 时序问题
// 常量 BGM_VOL / BGM_FADE_SPEED 已在顶部声明

function switchBgm(newBgm) {
  if (currentBgm === newBgm) return;  // 同一首不重复切换

  if (currentBgm) {
    // 有当前 BGM：标记淡出 + 排队等待切换
    currentBgmTargetVol = 0;
    currentBgmFadeSpeed = -BGM_FADE_SPEED;
    pendingBgm = newBgm;
    // 播放"嗖"过渡音效填补淡出间隙
    playBgmTransitionSfx();
  } else if (newBgm) {
    // 无当前 BGM：直接播放
    currentBgm = newBgm;
    newBgm.currentTime = 0;
    newBgm.volume = 0;  // 从静音开始
    newBgm.play().catch(err => console.warn('BGM 播放失败:', err));
    currentBgmTargetVol = BGM_VOL;
    currentBgmFadeSpeed = BGM_FADE_SPEED;
  }
}

function updateBgm() {
  if (!currentBgm) return;
  let v = currentBgm.volume + currentBgmFadeSpeed;

  if (currentBgmFadeSpeed > 0 && v >= currentBgmTargetVol) {
    v = currentBgmTargetVol;
    currentBgm.volume = v;
  } else if (currentBgmFadeSpeed < 0 && v <= 0) {
    // 淡出完成：彻底停止旧 BGM
    v = 0;
    currentBgm.volume = 0;
    currentBgm.pause();
    currentBgm.currentTime = 0;

    // 启动待切换的 BGM（从静音开始渐入，避免突然大声）
    if (pendingBgm) {
      let next = pendingBgm;
      pendingBgm = null;
      currentBgm = next;
      next.currentTime = 0;
      next.volume = 0;  // 强制从 0 开始，无论 preload 设了多少
      next.play().catch(err => console.warn('BGM 播放失败:', err));
      currentBgmTargetVol = BGM_VOL;
      currentBgmFadeSpeed = BGM_FADE_SPEED;
    } else {
      // 无待切换，置空
      currentBgm = null;
    }
  } else {
    currentBgm.volume = Math.max(0, Math.min(1, v));
  }
}

// 过渡音效：上升频率的"嗖"声
function playBgmTransitionSfx() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (err) {
    console.warn('过渡音效合成失败:', err);
  }
}

// ==================== 撞击音效合成 ====================
// 用 Web Audio API 实时合成"撞击"音效：
//  - 低频正弦波（80Hz）模拟重击
//  - 频率快速衰减（thump 效果）
//  - 短促白噪音模拟撞击碎片感
function playHitSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const now = ctx.currentTime;

    // 1. 低频重击音
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    oscGain.gain.setValueAtTime(0.25, now);  // 0.45 → 0.25
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    // 2. 噪音爆破（短促）
    const bufferSize = ctx.sampleRate * 0.1;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = noiseBuffer;
    noiseGain.gain.setValueAtTime(0.15, now);  // 0.25 → 0.15
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(now);
  } catch (err) {
    console.warn('撞击音效合成失败:', err);
  }
}
