// src/engine/InkEngine.js
import { 
  WORDS, TOTAL_H, MONITOR_H, GAP_H, TABLET_START_Y, TABLET_H, VIRTUAL_H, 
  CRYING_DURATION, FONT_FAMILY, FONT_SIZE_BASE, TEXT_STROKE_WIDTH,
  NETWORK_DELAY_FRAMES, WATER_SPEED_Y, WATER_SPEED_X,
  EYE_OFFSET, WORD_SPAWN_INTERVAL, BASE_VELOCITY_X, SWAY_FREQUENCY, SWAY_AMPLITUDE,
  FADE_START_RATIO, FADE_END_RATIO, MIN_ALPHA, ALPHA_EASE, BLUR_START_RATIO, BLUR_MULTIPLIER,
  TRAIL_SPAWN_DENSITY, TRAIL_START_DEPTH, TRAIL_SCALE_Y, TRAIL_SCALE_X_BASE, 
  TRAIL_SCALE_X_DEPTH_MULTIPLIER, TRAIL_INITIAL_BLUR_MULTIPLIER, TRAIL_BASE_ALPHA, 
  TRAIL_DEPTH_ALPHA_MULTIPLIER, TRAIL_EXPAND_SPEED_Y, TRAIL_BLUR_INCREASE_RATE, TRAIL_GRAVITY_MULTIPLIER,
  CONVERGE_SPEED_MOVE, CONVERGE_SPEED_ALPHA, CONVERGE_SPEED_SCALE, CONVERGE_BOTTOM_OFFSET, CONVERGE_FADE_HEIGHT
} from '../config/constants';

import { setupMonitor } from './MonitorController';
import { setupTablet } from './TabletController';

export function createInkEngine(containerElement, getEyeData, videoElement, onComplete) {
  const app = new window.PIXI.Application({
    width: 400, height: TOTAL_H, backgroundColor: 0x0a0a0c, resolution: window.devicePixelRatio || 1, autoDensity: true,
  });
  containerElement.appendChild(app.view);

  const uniqueChars = new Set(WORDS.join('').split(''));
  const charTextures = {};
  uniqueChars.forEach(char => {
    const textGraphic = new window.PIXI.Text(char, {
      fontFamily: FONT_FAMILY, fontSize: FONT_SIZE_BASE, fill: 0xFFFFFF, fontWeight: 'bold', stroke: 0x888888, strokeThickness: TEXT_STROKE_WIDTH
    });
    charTextures[char] = app.renderer.generateTexture(textGraphic);
    textGraphic.destroy();
  });

  const masterContainer = new window.PIXI.Container();
  app.stage.addChild(masterContainer);

  const trailContainer = new window.PIXI.Container(); masterContainer.addChild(trailContainer);
  const textContainer = new window.PIXI.Container(); masterContainer.addChild(textContainer);

  // 載入分離的控制器
  const monitorCtrl = setupMonitor(app, videoElement);
  const tabletCtrl = setupTablet(app, masterContainer);

  const GRAVITY_Y = TABLET_START_Y + TABLET_H - CONVERGE_BOTTOM_OFFSET;
  const FADE_START_Y = TABLET_START_Y + TABLET_H - CONVERGE_FADE_HEIGHT;

  let currentGemScale = 0; let targetGemScale = 0; let showGem = false; 
  let gemReadyTimer = 0; let hasTriggeredComplete = false;

  let currentGemGlow = null; 
  let currentGemShine = null;

  const drops = []; const inkTrails = []; const dropQueue = []; const tabletQueue = []; 
  let frameCounter = 0; let isCrying = false; let cryingTime = 0; let wordSpawnTimer = 0; let wasActive = false; 
  let currentWordPool = WORDS; 

  const spawnWordFlow = (userWords, isInner = Math.random() > 0.5, sizeScale = 1.0) => {
    showGem = false; hasTriggeredComplete = false; gemReadyTimer = 0; targetGemScale = 0;
    
    // 使用平板控制器判定與繪製寶石
    const targetGemType = tabletCtrl.determineGem(userWords);
    const gemVisuals = tabletCtrl.drawGem(targetGemType, tabletCtrl.gemContainer);
    currentGemGlow = gemVisuals.glow;
    currentGemShine = gemVisuals.shine;

    const pool = userWords && userWords.length > 0 ? userWords : WORDS;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const chars = word.split('');
    const isLeftEye = Math.random() > 0.5; const eyeData = getEyeData(); let eyeX, eyeY;
    
    // 維持舊版 4 點座標發射
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
    
    // 更新分離的控制器
    monitorCtrl.updateVideoScale();
    tabletCtrl.updateWater(delta);

    if (isCrying) {
      cryingTime += delta * 16.66; const p = Math.min(cryingTime / CRYING_DURATION, 1); 
      const framesPerWord = (1200 - Math.sin(p * Math.PI) * 800) / 16.66;
      wordSpawnTimer += delta;
      if (wordSpawnTimer >= framesPerWord) { wordSpawnTimer = 0; spawnWordFlow(currentWordPool, Math.random() < (1 - p), 0.4 + Math.sin(p * Math.PI) * 0.6); }
      if (p === 1) isCrying = false; 
    }

    for (let i = dropQueue.length - 1; i >= 0; i--) { if (frameCounter >= dropQueue[i].triggerFrame) { const item = dropQueue[i]; spawnSingleChar(item.char, item.x, item.y, item.scale, 1); dropQueue.splice(i, 1); } }
    for (let i = tabletQueue.length - 1; i >= 0; i--) { if (frameCounter >= tabletQueue[i].triggerFrame) { const item = tabletQueue[i]; spawnSingleChar(item.char, item.x, TABLET_START_Y, item.scale, 2, item.vx, item.vy); tabletQueue.splice(i, 1); } }

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
      tabletCtrl.gemContainer.visible = true; targetGemScale = Math.max(0, targetGemScale - 0.0005 * delta); 
      currentGemScale += (Math.max(1.0, targetGemScale) - currentGemScale) * 0.05 * delta;
      tabletCtrl.gemContainer.y = tabletCtrl.GEM_CENTER_Y + Math.sin(frameCounter * 0.04) * 5;
      
      if (currentGemGlow) currentGemGlow.alpha = 0.6 + Math.sin(frameCounter * 0.1) * 0.3; 
      if (currentGemShine) currentGemShine.x = Math.sin(frameCounter * 0.02) * 20;

      if (currentGemScale > 0.95 && !hasTriggeredComplete) { gemReadyTimer += delta * 16.66; if (gemReadyTimer >= 2000) { if (typeof onComplete === 'function') onComplete(); hasTriggeredComplete = true; } }
    } else {
      currentGemScale += (0 - currentGemScale) * 0.1 * delta; if (currentGemScale < 0.01) tabletCtrl.gemContainer.visible = false;
    }
    tabletCtrl.gemContainer.scale.set(currentGemScale); 
  });

  return {
    spawnWord: (userWords) => { currentWordPool = userWords; spawnWordFlow(userWords, Math.random() > 0.5, 0.8); },
    triggerCryingSequence: (userWords) => { if(!isCrying) { currentWordPool = userWords; isCrying = true; cryingTime = 0; wordSpawnTimer = 0; spawnWordFlow(userWords, Math.random() > 0.5, 0.8); } },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}