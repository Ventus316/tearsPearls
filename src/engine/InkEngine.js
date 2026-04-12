// src/engine/InkEngine.js
import { 
  WORDS, TOTAL_H, MONITOR_H, GAP_H, TABLET_START_Y, TABLET_H, VIRTUAL_H, 
  CRYING_DURATION, BG_COLOR, TEXT_COLOR, BEZEL_COLOR, FONT_FAMILY, FONT_SIZE_BASE, TEXT_STROKE_WIDTH,
  NETWORK_DELAY_FRAMES, DISPLACEMENT_STRENGTH, WATER_SPEED_Y, WATER_SPEED_X,
  EYE_OFFSET, WORD_SPAWN_INTERVAL, BASE_VELOCITY_X, SWAY_FREQUENCY, SWAY_AMPLITUDE,
  FADE_START_RATIO, FADE_END_RATIO, MIN_ALPHA, ALPHA_EASE, BLUR_START_RATIO, BLUR_MULTIPLIER,
  TRAIL_SPAWN_DENSITY, TRAIL_START_DEPTH, TRAIL_SCALE_Y, TRAIL_SCALE_X_BASE, 
  TRAIL_SCALE_X_DEPTH_MULTIPLIER, TRAIL_INITIAL_BLUR_MULTIPLIER, TRAIL_BASE_ALPHA, 
  TRAIL_DEPTH_ALPHA_MULTIPLIER, TRAIL_EXPAND_SPEED_Y, TRAIL_BLUR_INCREASE_RATE, TRAIL_GRAVITY_MULTIPLIER,
  CONVERGE_SPEED_MOVE, CONVERGE_SPEED_ALPHA, CONVERGE_SPEED_SCALE, CONVERGE_BOTTOM_OFFSET, CONVERGE_FADE_HEIGHT,
  GEM_MAPPING // 引入寶石字典
} from '../config/constants';

export function createInkEngine(containerElement, getEyeData, videoElement, onComplete) {
  const app = new window.PIXI.Application({
    width: 400, height: TOTAL_H, backgroundColor: BG_COLOR, resolution: window.devicePixelRatio || 1, autoDensity: true,
  });
  containerElement.appendChild(app.view);

  const uniqueChars = new Set(WORDS.join('').split(''));
  const charTextures = {};
  uniqueChars.forEach(char => {
    const textGraphic = new window.PIXI.Text(char, {
      fontFamily: FONT_FAMILY, fontSize: FONT_SIZE_BASE, fill: TEXT_COLOR, fontWeight: 'bold', stroke: 0xFFFFFF, strokeThickness: TEXT_STROKE_WIDTH
    });
    charTextures[char] = app.renderer.generateTexture(textGraphic);
    textGraphic.destroy();
  });

  const videoBaseTexture = new window.PIXI.BaseTexture(videoElement);
  const videoTexture = new window.PIXI.Texture(videoBaseTexture);
  const videoSprite = new window.PIXI.Sprite(videoTexture);
  const videoContainer = new window.PIXI.Container();
  videoSprite.anchor.set(0.5); videoContainer.addChild(videoSprite);

  const monitorMask = new window.PIXI.Graphics();
  monitorMask.beginFill(0xFFFFFF); monitorMask.drawRect(0, 0, 400, MONITOR_H); monitorMask.endFill();
  videoContainer.mask = monitorMask;
  app.stage.addChildAt(videoContainer, 0); app.stage.addChildAt(monitorMask, 0);

  const tabletBg = new window.PIXI.Graphics();
  tabletBg.beginFill(BG_COLOR); tabletBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); tabletBg.endFill();
  app.stage.addChildAt(tabletBg, 1); 

  const svgNs = "http://" + "www.w3.org/2000/svg";
  const svgNoiseUrl = 'data:image/svg+xml;base64,' + window.btoa(`<svg viewBox="0 0 512 512" xmlns="${svgNs}"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(#noise)" /></svg>`);
  const noiseTexture = window.PIXI.Texture.from(svgNoiseUrl);
  const waterSprite = new window.PIXI.TilingSprite(noiseTexture, app.screen.width, app.screen.height);
  waterSprite.alpha = 0.15; app.stage.addChild(waterSprite);

  const masterContainer = new window.PIXI.Container();
  const displacementFilter = new window.PIXI.DisplacementFilter(waterSprite);
  displacementFilter.scale.set(DISPLACEMENT_STRENGTH); masterContainer.filters = [displacementFilter];
  app.stage.addChild(masterContainer);

  const trailContainer = new window.PIXI.Container(); masterContainer.addChild(trailContainer);
  const textContainer = new window.PIXI.Container(); masterContainer.addChild(textContainer);

  const GEM_CENTER_Y = TABLET_START_Y + (TABLET_H * 0.7); 
  const GRAVITY_Y = TABLET_START_Y + TABLET_H - CONVERGE_BOTTOM_OFFSET;
  const FADE_START_Y = TABLET_START_Y + TABLET_H - CONVERGE_FADE_HEIGHT;

  let currentGemScale = 0; let targetGemScale = 0; let showGem = false; 
  let gemReadyTimer = 0; let hasTriggeredComplete = false;

  const gemContainer = new window.PIXI.Container();
  gemContainer.position.set(200, GEM_CENTER_Y);
  gemContainer.scale.set(0); gemContainer.visible = false;
  masterContainer.addChildAt(gemContainer, 1); 

  let currentGemGlow = null; // 紀錄當前的發光層，用於呼吸動畫

  // --- 🎨 繪製 5 種不同寶石的函式 ---
  const drawGem = (type, container) => {
    container.removeChildren(); // 清空前一次的寶石
    const glow = new window.PIXI.Graphics();
    const core = new window.PIXI.Container();

    switch(type) {
      case 'pearl': // ⚪ 珍珠
        glow.beginFill(0xFFE4E1, 0.5); glow.drawCircle(0, 0, 50); glow.endFill();
        const p = new window.PIXI.Graphics();
        p.beginFill(0xFFFAF0); p.drawCircle(0, 0, 35); p.endFill();
        p.beginFill(0xFFFFFF, 0.8); p.drawCircle(-10, -10, 10); p.endFill(); // 內陰影/亮點
        const pb = new window.PIXI.BlurFilter(); pb.blur = 4; p.filters = [pb];
        core.addChild(p); break;
      case 'diamond': // 💎 鑽石
        glow.beginFill(0xE0FFFF, 0.5); glow.drawCircle(0, 0, 60); glow.endFill();
        const d = new window.PIXI.Graphics();
        d.lineStyle(2, 0xFFFFFF, 0.9); d.beginFill(0xF0FFFF, 0.8);
        d.moveTo(-30, -20); d.lineTo(30, -20); d.lineTo(45, 0); d.lineTo(0, 50); d.lineTo(-45, 0); d.closePath(); d.endFill();
        d.lineStyle(1.5, 0xFFFFFF, 0.6); // 切割線
        d.moveTo(-30, -20); d.lineTo(0, 0); d.lineTo(30, -20);
        d.moveTo(-45, 0); d.lineTo(0, 0); d.lineTo(45, 0); d.moveTo(0, 0); d.lineTo(0, 50);
        core.addChild(d); break;
      case 'quartz': // 🧊 白水晶
        glow.beginFill(0xF8F8FF, 0.5); glow.drawCircle(0, 0, 60); glow.endFill();
        const q = new window.PIXI.Graphics();
        q.lineStyle(2, 0xFFFFFF, 0.8);
        q.beginFill(0xF5F5F5, 0.85); q.moveTo(-15, 20); q.lineTo(-15, -30); q.lineTo(0, -50); q.lineTo(15, -30); q.lineTo(15, 20); q.closePath(); q.endFill();
        q.beginFill(0xE8E8E8, 0.85); q.moveTo(-25, 20); q.lineTo(-25, -10); q.lineTo(-15, -25); q.lineTo(-5, -10); q.lineTo(-5, 20); q.closePath(); q.endFill();
        q.beginFill(0xE8E8E8, 0.85); q.moveTo(5, 20); q.lineTo(5, -5); q.lineTo(15, -20); q.lineTo(25, -5); q.lineTo(25, 20); q.closePath(); q.endFill();
        core.addChild(q); break;
      case 'opal': // 🌈 蛋白石
        glow.beginFill(0xFFFFFF, 0.4); glow.drawCircle(0, 0, 55); glow.endFill();
        const o = new window.PIXI.Graphics(); o.beginFill(0xF0F8FF); o.drawEllipse(0, 0, 35, 45); o.endFill();
        const spots = new window.PIXI.Graphics(); // 迷幻光暈
        spots.beginFill(0xFFB6C1, 0.7); spots.drawCircle(-10, -15, 20); spots.endFill();
        spots.beginFill(0x87CEFA, 0.7); spots.drawCircle(15, 5, 22); spots.endFill();
        spots.beginFill(0x98FB98, 0.7); spots.drawCircle(-5, 20, 18); spots.endFill();
        const sb = new window.PIXI.BlurFilter(); sb.blur = 12; spots.filters = [sb];
        const mask = new window.PIXI.Graphics(); mask.beginFill(0xFFFFFF); mask.drawEllipse(0, 0, 35, 45); mask.endFill();
        spots.mask = mask; // 遮罩確保光暈不出界
        core.addChild(o); core.addChild(spots); core.addChild(mask); break;
      case 'lapis': // 🌌 青金石
        glow.beginFill(0x4169E1, 0.5); glow.drawCircle(0, 0, 55); glow.endFill();
        const l = new window.PIXI.Graphics();
        l.beginFill(0x191970); l.moveTo(-20, -35); l.lineTo(15, -40); l.lineTo(35, -10); l.lineTo(25, 30); l.lineTo(-10, 40); l.lineTo(-35, 10); l.closePath(); l.endFill();
        l.beginFill(0xFFD700); // 黃鐵礦金箔
        l.drawCircle(-10, -20, 2.5); l.drawCircle(15, -15, 2); l.drawCircle(5, 10, 3); l.drawCircle(20, 15, 1.5); l.drawCircle(-15, 20, 2.5); l.drawCircle(-5, -5, 2); l.endFill();
        l.lineStyle(1.5, 0xA9A9A9, 0.7); // 方解石灰紋
        l.moveTo(-15, 10); l.lineTo(10, 25); l.moveTo(10, -25); l.lineTo(25, -5); l.moveTo(-25, -15); l.lineTo(-5, 0);
        core.addChild(l); break;
    }
    const glowBlur = new window.PIXI.BlurFilter(); glowBlur.blur = 25; glow.filters = [glowBlur];
    container.addChild(glow); container.addChild(core);
    return glow; // 回傳光暈層以供呼吸動畫使用
  };

  // --- 🧠 計算最高分寶石的函式 ---
  const determineGem = (userWords) => {
    if (!userWords || userWords.length === 0) return 'diamond'; 
    const counts = { pearl: 0, diamond: 0, quartz: 0, opal: 0, lapis: 0 };
    userWords.forEach(word => {
      for (const [gem, wordsList] of Object.entries(GEM_MAPPING)) {
        if (wordsList.includes(word)) counts[gem]++;
      }
    });
    let maxCount = -1; let maxGems = [];
    for (const [gem, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; maxGems = [gem]; } 
      else if (count === maxCount) { maxGems.push(gem); }
    }
    // 若同分，隨機選出一顆
    return maxGems[Math.floor(Math.random() * maxGems.length)];
  };

  const bezelContainer = new window.PIXI.Container();
  app.stage.addChild(bezelContainer);
  const bezel = new window.PIXI.Graphics(); bezel.beginFill(BEZEL_COLOR); bezel.drawRect(0, MONITOR_H, 400, GAP_H); bezel.endFill();
  bezelContainer.addChild(bezel);

  const drops = []; const inkTrails = []; const dropQueue = []; const tabletQueue = []; 
  let frameCounter = 0; let isCrying = false; let cryingTime = 0; let wordSpawnTimer = 0; let wasActive = false; 
  let currentWordPool = WORDS; 

  const spawnWordFlow = (userWords, isInner = Math.random() > 0.5, sizeScale = 1.0) => {
    showGem = false; hasTriggeredComplete = false; gemReadyTimer = 0; targetGemScale = 0;
    
    // 【關鍵】：生成動畫前，先算出這次要長什麼寶石，並畫出來 (先隱藏)
    const targetGemType = determineGem(userWords);
    currentGemGlow = drawGem(targetGemType, gemContainer);

    const pool = userWords && userWords.length > 0 ? userWords : WORDS;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const chars = word.split('');
    const isLeftEye = Math.random() > 0.5; const eyeData = getEyeData(); let eyeX, eyeY;
    if (eyeData) {
      if (isLeftEye) { eyeX = isInner ? eyeData.leftInner.x : eyeData.leftOuter.x; eyeY = isInner ? eyeData.leftInner.y : eyeData.leftOuter.y; } 
      else { eyeX = isInner ? eyeData.rightInner.x : eyeData.rightOuter.x; eyeY = isInner ? eyeData.rightInner.y : eyeData.rightOuter.y; }
    } else {
      eyeX = app.screen.width * (isLeftEye ? 0.3 : 0.7) + (isInner ? EYE_OFFSET : -EYE_OFFSET); eyeY = 150; 
    }
    chars.forEach((char, index) => { dropQueue.push({ char, x: eyeX, y: eyeY, triggerFrame: frameCounter + (index * WORD_SPAWN_INTERVAL), scale: sizeScale }); });
  };

  const spawnSingleChar = (char, startX, startY, scale, screen = 1, prevVx = null, prevVy = null) => {
    const dropSprite = new window.PIXI.Sprite(charTextures[char]);
    dropSprite.anchor.set(0.5); dropSprite.position.set(startX, startY); dropSprite.alpha = 1; dropSprite.baseScale = scale; dropSprite.scale.set(scale);
    const blurFilter = new window.PIXI.BlurFilter(); blurFilter.blur = 0; dropSprite.filters = [blurFilter]; textContainer.addChild(dropSprite);
    drops.push({ sprite: dropSprite, char, blur: blurFilter, baseScale: scale, vx: prevVx !== null ? prevVx : (Math.random() - 0.5) * BASE_VELOCITY_X, vy: prevVy !== null ? prevVy : (Math.random() * 0.1 + 2.0) * (0.8 + scale * 0.2), life: 0, lastTrailY: startY, screen, isConverging: screen === 2 });
  };

  app.ticker.add((delta) => {
    frameCounter += delta;
    if (videoElement.videoWidth > 0) {
       const scale = Math.max(400 / videoElement.videoWidth, MONITOR_H / videoElement.videoHeight);
       videoSprite.scale.set(scale); videoSprite.scale.x *= -1; videoSprite.position.set(200, MONITOR_H / 2); 
    }

    if (isCrying) {
      cryingTime += delta * 16.66; const p = Math.min(cryingTime / CRYING_DURATION, 1); 
      const framesPerWord = (1200 - Math.sin(p * Math.PI) * 800) / 16.66;
      wordSpawnTimer += delta;
      if (wordSpawnTimer >= framesPerWord) { wordSpawnTimer = 0; spawnWordFlow(currentWordPool, Math.random() < (1 - p), 0.4 + Math.sin(p * Math.PI) * 0.6); }
      if (p === 1) isCrying = false; 
    }

    for (let i = dropQueue.length - 1; i >= 0; i--) { if (frameCounter >= dropQueue[i].triggerFrame) { const item = dropQueue[i]; spawnSingleChar(item.char, item.x, item.y, item.scale, 1); dropQueue.splice(i, 1); } }
    for (let i = tabletQueue.length - 1; i >= 0; i--) { if (frameCounter >= tabletQueue[i].triggerFrame) { const item = tabletQueue[i]; spawnSingleChar(item.char, item.x, TABLET_START_Y, item.scale, 2, item.vx, item.vy); tabletQueue.splice(i, 1); } }

    waterSprite.tilePosition.y -= WATER_SPEED_Y * delta; waterSprite.tilePosition.x -= WATER_SPEED_X * delta;

    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i]; drop.life += delta;
      if (drop.isConverging) {
        const dx = 200 - drop.sprite.x; const dy = GRAVITY_Y - drop.sprite.y;
        drop.sprite.x += dx * CONVERGE_SPEED_MOVE * delta; drop.sprite.y += dy * CONVERGE_SPEED_MOVE * delta;
        if (drop.sprite.y > FADE_START_Y) { drop.sprite.alpha *= CONVERGE_SPEED_ALPHA; drop.sprite.scale.set(drop.sprite.scale.x * CONVERGE_SPEED_SCALE); }
        if (Math.hypot(dx, dy) < 15 || drop.sprite.alpha < 0.05) { targetGemScale = Math.min(targetGemScale + 0.15, 1.2); textContainer.removeChild(drop.sprite); drop.sprite.destroy(); drops.splice(i, 1); }
        continue;
      }
      drop.sprite.y += drop.vy * delta; drop.sprite.x += drop.vx * delta + Math.sin(drop.life * SWAY_FREQUENCY) * SWAY_AMPLITUDE; 
      const virtualY = drop.screen === 1 ? drop.sprite.y : drop.sprite.y - GAP_H; const depthRatio = virtualY / VIRTUAL_H; 
      drop.blur.blur = Math.max(0, (Math.min(depthRatio, FADE_END_RATIO) - BLUR_START_RATIO) * BLUR_MULTIPLIER);
      if (depthRatio > FADE_START_RATIO) { const fadeProgress = Math.min((depthRatio - FADE_START_RATIO) / (FADE_END_RATIO - FADE_START_RATIO), 1); drop.sprite.alpha += ((1 - ((1 - MIN_ALPHA) * fadeProgress)) - drop.sprite.alpha) * ALPHA_EASE; }
      if ((drop.sprite.y - drop.lastTrailY) >= Math.max(3, TRAIL_SPAWN_DENSITY * drop.baseScale) && depthRatio > TRAIL_START_DEPTH) {
        drop.lastTrailY = drop.sprite.y; const trail = new window.PIXI.Sprite(charTextures[drop.char]); trail.anchor.set(0.5); trail.position.set(drop.sprite.x, drop.sprite.y); trail.rotation = Math.random() * 0.2 - 0.1; trail.scale.set((TRAIL_SCALE_X_BASE + (depthRatio * TRAIL_SCALE_X_DEPTH_MULTIPLIER)) * drop.baseScale, TRAIL_SCALE_Y * drop.baseScale); const trailBlur = new window.PIXI.BlurFilter(); trailBlur.blur = depthRatio * TRAIL_INITIAL_BLUR_MULTIPLIER; trail.filters = [trailBlur]; trail.alpha = TRAIL_BASE_ALPHA + (depthRatio * TRAIL_DEPTH_ALPHA_MULTIPLIER); trailContainer.addChildAt(trail, 0);
        inkTrails.push({ sprite: trail, blurFilter: trailBlur, scaleSpeedX: 0.008 + (Math.random() * 0.005), scaleSpeedY: TRAIL_EXPAND_SPEED_Y, alphaSpeed: (0.015 + (Math.random() * 0.01)) / Math.max(0.6, drop.baseScale), vy: drop.vy * TRAIL_GRAVITY_MULTIPLIER, screen: drop.screen });
      }
      const screenBottom = drop.screen === 1 ? MONITOR_H : TOTAL_H;
      if (drop.sprite.y > screenBottom) { if (drop.screen === 1) { tabletQueue.push({ char: drop.char, x: drop.sprite.x, scale: drop.baseScale, vx: drop.vx, vy: drop.vy, triggerFrame: frameCounter + NETWORK_DELAY_FRAMES }); textContainer.removeChild(drop.sprite); drop.sprite.destroy(); drops.splice(i, 1); } else { drop.isConverging = true; } }
    }

    for (let i = inkTrails.length - 1; i >= 0; i--) {
      const trail = inkTrails[i]; trail.sprite.scale.x += trail.scaleSpeedX * delta; trail.sprite.scale.y += trail.scaleSpeedY * delta; trail.sprite.alpha -= trail.alphaSpeed * delta; trail.sprite.y += trail.vy * delta;
      if (trail.blurFilter) trail.blurFilter.blur += TRAIL_BLUR_INCREASE_RATE * delta;
      if (trail.sprite.alpha <= 0.01 || trail.sprite.y > (trail.screen === 1 ? MONITOR_H : TOTAL_H)) { trailContainer.removeChild(trail.sprite); trail.sprite.destroy(); inkTrails.splice(i, 1); }
    }

    const isAnimating = isCrying || dropQueue.length > 0 || tabletQueue.length > 0 || drops.length > 0 || inkTrails.length > 0;
    if (wasActive && !isAnimating) { showGem = true; }
    wasActive = isAnimating; 

    if (showGem) {
      gemContainer.visible = true; targetGemScale = Math.max(0, targetGemScale - 0.0005 * delta); 
      currentGemScale += (Math.max(1.0, targetGemScale) - currentGemScale) * 0.05 * delta;
      gemContainer.y = GEM_CENTER_Y + Math.sin(frameCounter * 0.04) * 5;
      if (currentGemGlow) currentGemGlow.alpha = 0.5 + Math.sin(frameCounter * 0.1) * 0.2; // 呼吸燈特效

      if (currentGemScale > 0.95 && !hasTriggeredComplete) { gemReadyTimer += delta * 16.66; if (gemReadyTimer >= 2000) { if (typeof onComplete === 'function') onComplete(); hasTriggeredComplete = true; } }
    } else {
      currentGemScale += (0 - currentGemScale) * 0.1 * delta; if (currentGemScale < 0.01) gemContainer.visible = false;
    }
    gemContainer.scale.set(currentGemScale); 
  });

  return {
    spawnWord: (userWords) => { currentWordPool = userWords; spawnWordFlow(userWords, Math.random() > 0.5, 0.8); },
    triggerCryingSequence: (userWords) => { if(!isCrying) { currentWordPool = userWords; isCrying = true; cryingTime = 0; wordSpawnTimer = 0; spawnWordFlow(userWords, Math.random() > 0.5, 0.8); } },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}