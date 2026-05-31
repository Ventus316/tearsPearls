// src/engine/style/Fallingleaves.js

import { 
  WORDS, TOTAL_H, MONITOR_H, GAP_H, TABLET_START_Y, TABLET_H, 
  CRYING_DURATION, FONT_FAMILY, FONT_SIZE_BASE, TEXT_STROKE_WIDTH,
  NETWORK_DELAY_FRAMES, EYE_OFFSET, WORD_SPAWN_INTERVAL,
  CONVERGE_SPEED_MOVE, CONVERGE_SPEED_ALPHA, CONVERGE_SPEED_SCALE, CONVERGE_BOTTOM_OFFSET, CONVERGE_FADE_HEIGHT
} from '../../config/constants';

// 落葉水平初速稍微調大，增加隨風飄散感
export const BASE_VELOCITY_X = 0.01;     

import { setupMonitor } from '../MonitorController';
import { setupTablet } from '../TabletController';

export function createInkEngine(containerElement, getEyeData, videoElement, onComplete) {
  const app = new window.PIXI.Application({
    width: 400, height: TOTAL_H, backgroundColor: 0x0a0a0c, resolution: window.devicePixelRatio || 1, autoDensity: true,
  });
  containerElement.appendChild(app.view);

  // 預先將文字渲染成紋理快取
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

  const textContainer = new window.PIXI.Container(); 
  masterContainer.addChild(textContainer);

  // 載入分離的控制器 (正確傳入 masterContainer 避免 filters 報錯)
  const monitorCtrl = setupMonitor(app, videoElement);
  const tabletCtrl = setupTablet(app, masterContainer);

  const GRAVITY_Y = TABLET_START_Y + TABLET_H - CONVERGE_BOTTOM_OFFSET;
  const FADE_START_Y = TABLET_START_Y + TABLET_H - CONVERGE_FADE_HEIGHT;

  let currentGemScale = 0; let targetGemScale = 0; let showGem = false; 
  let gemReadyTimer = 0; let hasTriggeredComplete = false;

  let currentGemGlow = null; 
  let currentGemShine = null;

  const drops = []; const dropQueue = []; const tabletQueue = []; 
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
    
    // 從完整下眼緣中隨機取點
    if (eyeData) {
      if (eyeData.leftLowerEdge && eyeData.rightLowerEdge) {
        const edgePoints = isLeftEye ? eyeData.leftLowerEdge : eyeData.rightLowerEdge;
        const randomPoint = edgePoints[Math.floor(Math.random() * edgePoints.length)];
        eyeX = randomPoint.x;
        eyeY = randomPoint.y;
      } else {
        // 相容舊版防呆機制
        if (isLeftEye) { eyeX = isInner ? eyeData.leftInner.x : eyeData.leftOuter.x; eyeY = isInner ? eyeData.leftInner.y : eyeData.leftOuter.y; } 
        else { eyeX = isInner ? eyeData.rightInner.x : eyeData.rightOuter.x; eyeY = isInner ? eyeData.rightInner.y : eyeData.rightOuter.y; }
      }
    } else {
      eyeX = app.screen.width * (isLeftEye ? 0.3 : 0.7) + (isInner ? EYE_OFFSET : -EYE_OFFSET); eyeY = 150; 
    }
    
    chars.forEach((char, index) => { dropQueue.push({ char, x: eyeX, y: eyeY, triggerFrame: frameCounter + (index * WORD_SPAWN_INTERVAL), scale: sizeScale }); });
  };

  const spawnSingleChar = (char, startX, startY, scale, screen = 1, prevVx = null, prevVy = null) => {
    const dropSprite = new window.PIXI.Sprite(charTextures[char]);
    dropSprite.anchor.set(0.5); dropSprite.position.set(startX, startY); dropSprite.alpha = 1; dropSprite.baseScale = scale; dropSprite.scale.set(scale);
    
    textContainer.addChild(dropSprite);
    
    // === 注入 Fallingleaves 數學種子 ===
    const seed = Math.random(); 
    const z = Math.random() * 10.0; // 模擬 GLSL 中的深度參數 z
    
    drops.push({ 
      sprite: dropSprite, 
      char, 
      baseScale: scale, 
      vx: prevVx !== null ? prevVx : (Math.random() - 0.5) * BASE_VELOCITY_X, 
      vy: prevVy !== null ? prevVy : (Math.random() * 0.4 + 0.8) * (0.8 + scale * 0.2), // 落葉垂直掉落速度較慢、輕盈
      life: 0, 
      screen, 
      isConverging: screen === 2,
      // 落葉動態參數
      z: z, 
      seed: seed * 53.34, // 對應 GLSL: i * 53.34
      swayFreq: 0.015 + Math.random() * 0.015, // 搖擺頻率
      tumbleSpeed: 1.0 + Math.log(1.0 + z) * 0.5 // 對應 GLSL: log(1.0 + z) 的翻滾速度
    });
  };

  app.ticker.add((delta) => {
    frameCounter += delta;
    
    // 更新分離的控制器
    monitorCtrl.updateVideoScale();
    tabletCtrl.updateWater(delta);

    if (isCrying) {
      cryingTime += delta * 16.66; const p = Math.min(cryingTime / CRYING_DURATION, 1); 
      const framesPerWord = (1000 - Math.sin(p * Math.PI) * 800) / 16.66;
      wordSpawnTimer += delta;
      if (wordSpawnTimer >= framesPerWord) { wordSpawnTimer = 0; spawnWordFlow(currentWordPool, Math.random() < (1 - p), 0.4 + Math.sin(p * Math.PI) * 0.6); }
      if (p === 1) isCrying = false; 
    }

    for (let i = dropQueue.length - 1; i >= 0; i--) { if (frameCounter >= dropQueue[i].triggerFrame) { const item = dropQueue[i]; spawnSingleChar(item.char, item.x, item.y, item.scale, 1); dropQueue.splice(i, 1); } }
    for (let i = tabletQueue.length - 1; i >= 0; i--) { if (frameCounter >= tabletQueue[i].triggerFrame) { const item = tabletQueue[i]; spawnSingleChar(item.char, item.x, TABLET_START_Y, item.scale, 2, item.vx, item.vy); tabletQueue.splice(i, 1); } }

    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i]; drop.life += delta;
      
      // 寶石匯聚邏輯
      if (drop.isConverging) {
        const dx = 200 - drop.sprite.x; const dy = GRAVITY_Y - drop.sprite.y;
        drop.sprite.x += dx * CONVERGE_SPEED_MOVE * delta; drop.sprite.y += dy * CONVERGE_SPEED_MOVE * delta;
        if (drop.sprite.y > FADE_START_Y) { drop.sprite.alpha *= CONVERGE_SPEED_ALPHA; drop.sprite.scale.set(drop.sprite.scale.x * CONVERGE_SPEED_SCALE); }
        if (Math.hypot(dx, dy) < 15 || drop.sprite.alpha < 0.05) { targetGemScale = Math.min(targetGemScale + 0.15, 1.2); textContainer.removeChild(drop.sprite); drop.sprite.destroy(); drops.splice(i, 1); }
        continue;
      }
      
      // === Fallingleaves 物理動態 ===
      const iTime = frameCounter * 0.015; 
      
      // 1. 垂直位移: 加入些微的空氣阻力/漂浮感 (flutter)
      const flutter = Math.sin(iTime * drop.swayFreq * 2.0 + drop.seed) * 0.3;
      drop.sprite.y += (drop.vy + flutter) * delta; 
      
      // 2. 水平飄移: 落葉的 S 型搖擺，幅度受深度 (z) 影響
      drop.sprite.x += (drop.vx + Math.sin(iTime * drop.swayFreq + drop.seed) * (0.0005 + drop.z * 0.001)) * delta;
      
      // 3. 旋轉與 3D 翻轉 (模擬 GLSL 的 Transform 矩陣)
      const angle = iTime * drop.tumbleSpeed + drop.seed;
      drop.sprite.rotation = angle * 0.5; // Z 軸平面旋轉
      
      // 模擬 p.xy *= Rot(angle * 1.7) 的翻轉視覺壓縮
      const flipFactor = Math.cos(angle * 1.7); 
      drop.sprite.scale.set(
        drop.baseScale * (0.5 + 0.5 * Math.abs(flipFactor)), // X 軸隨翻轉壓縮
        drop.baseScale // Y 軸保持不變，產生立體翻面錯覺
      );
      // ==============================

      // 邊界判定與跨螢幕邏輯
      const screenBottom = drop.screen === 1 ? MONITOR_H : TOTAL_H;
      if (drop.sprite.y > screenBottom) { 
        if (drop.screen === 1) { 
          tabletQueue.push({ char: drop.char, x: drop.sprite.x, scale: drop.baseScale, vx: drop.vx, vy: drop.vy, triggerFrame: frameCounter + NETWORK_DELAY_FRAMES }); 
          textContainer.removeChild(drop.sprite); drop.sprite.destroy(); drops.splice(i, 1); 
        } else { 
          drop.isConverging = true; 
        } 
      }
    }

    // 動畫狀態判定與寶石顯示邏輯
    const isAnimating = isCrying || dropQueue.length > 0 || tabletQueue.length > 0 || drops.length > 0;
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