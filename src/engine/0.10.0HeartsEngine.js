// src/engine/0.10.0HeartsEngine.js
import { 
  WORDS, TOTAL_H, MONITOR_H, GAP_H, TABLET_START_Y, TABLET_H, 
  CRYING_DURATION, FONT_FAMILY, FONT_SIZE_BASE, TEXT_STROKE_WIDTH,
  EYE_OFFSET, WORD_SPAWN_INTERVAL
} from '../config/constants';

export const BASE_VELOCITY_X = 0.05;     
const NETWORK_DELAY_FRAMES = 18; // 覆蓋延遲：18 影格約等於 0.3 秒 (60FPS)

import { setupMonitor } from './MonitorController';
import { setupTablet } from './0.10.0TabletController';

export function createInkEngine(containerElement, getEyeData, videoElement, onComplete) {
  const app = new window.PIXI.Application({
    width: 400, height: TOTAL_H, backgroundColor: 0x0a0a0c, resolution: window.devicePixelRatio || 1, autoDensity: true,
  });
  containerElement.appendChild(app.view);

  const uniqueChars = new Set(WORDS.join('').split(''));
  const charTextures = {};
  uniqueChars.forEach(char => {
    const textGraphic = new window.PIXI.Text(char, {
      fontFamily: FONT_FAMILY, fontSize: FONT_SIZE_BASE, fill: 0x111315, // 文字為深色
      fontWeight: 'bold', stroke: 0xFFFFFF, strokeThickness: TEXT_STROKE_WIDTH
    });
    charTextures[char] = app.renderer.generateTexture(textGraphic);
  });

  const masterContainer = new window.PIXI.Container();
  app.stage.addChild(masterContainer);
  const textContainer = new window.PIXI.Container(); 
  masterContainer.addChild(textContainer);

  const monitorCtrl = setupMonitor(app, videoElement);
  const tabletCtrl = setupTablet(app); // 移除濾鏡綁定所需的 container 傳遞

  const drops = []; const dropQueue = []; const tabletQueue = []; 
  let frameCounter = 0; let isCrying = false; let cryingTime = 0; let wordSpawnTimer = 0; 
  let currentWordPool = WORDS; 

  const spawnWordFlow = (userWords, isInner = Math.random() > 0.5, sizeScale = 1.0) => {
    const pool = userWords && userWords.length > 0 ? userWords : WORDS;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const chars = word.split('');
    const isLeftEye = Math.random() > 0.5; const eyeData = getEyeData(); let eyeX, eyeY;
    
    if (eyeData) {
      if (eyeData.leftLowerEdge && eyeData.rightLowerEdge) {
        const edgePoints = isLeftEye ? eyeData.leftLowerEdge : eyeData.rightLowerEdge;
        const randomPoint = edgePoints[Math.floor(Math.random() * edgePoints.length)];
        eyeX = randomPoint.x; eyeY = randomPoint.y;
      } else {
        if (isLeftEye) { eyeX = isInner ? eyeData.leftInner.x : eyeData.leftOuter.x; eyeY = isInner ? eyeData.leftInner.y : eyeData.leftOuter.y; } 
        else { eyeX = isInner ? eyeData.rightInner.x : eyeData.rightOuter.x; eyeY = isInner ? eyeData.rightInner.y : eyeData.rightOuter.y; }
      }
    } else {
      eyeX = app.screen.width * (isLeftEye ? 0.3 : 0.7) + (isInner ? EYE_OFFSET : -EYE_OFFSET); eyeY = 150; 
    }
    
    chars.forEach((char, index) => { dropQueue.push({ char, x: eyeX, y: eyeY, triggerFrame: frameCounter + (index * WORD_SPAWN_INTERVAL), scale: sizeScale }); });
  };

  const spawnSingleChar = (char, startX, startY, scale) => {
    const dropSprite = new window.PIXI.Sprite(charTextures[char]);
    dropSprite.anchor.set(0.5); dropSprite.position.set(startX, startY); 
    
    const seed = Math.random() * 985.989; 
    const z = Math.random() * 3.0; 
    const depthScale = scale * (1.0 - (z / 3.0) * 0.5); 
    dropSprite.baseScale = depthScale;
    dropSprite.scale.set(depthScale);
    
    textContainer.addChild(dropSprite);
    
    drops.push({ 
      sprite: dropSprite, 
      char, 
      baseScale: depthScale, 
      vx: (Math.random() - 0.5) * BASE_VELOCITY_X, 
      vy: (Math.random() * 0.2 + 1.2) * (0.8 + depthScale * 0.2), 
      seed: seed,
      z: z  // 把 z 存起來給下面作映射判斷
    });
  };

  app.ticker.add((delta) => {
    frameCounter += delta;
    monitorCtrl.updateVideoScale();
    tabletCtrl.updateWater(delta);

    if (isCrying) {
      cryingTime += delta * 16.66; const p = Math.min(cryingTime / CRYING_DURATION, 1); 
      const framesPerWord = (800 - Math.sin(p * Math.PI) * 800) / 16.66;
      wordSpawnTimer += delta;
      if (wordSpawnTimer >= framesPerWord) { wordSpawnTimer = 0; spawnWordFlow(currentWordPool, Math.random() < (1 - p), 0.4 + Math.sin(p * Math.PI) * 0.6); }
      if (p === 1) { isCrying = false; if (typeof onComplete === 'function') onComplete(); } 
    }

    for (let i = dropQueue.length - 1; i >= 0; i--) { if (frameCounter >= dropQueue[i].triggerFrame) { const item = dropQueue[i]; spawnSingleChar(item.char, item.x, item.y, item.scale); dropQueue.splice(i, 1); } }
    
    // 觸發偵錯小白點
    for (let i = tabletQueue.length - 1; i >= 0; i--) { 
        if (frameCounter >= tabletQueue[i].triggerFrame) { 
            const item = tabletQueue[i]; 
            tabletCtrl.drawDebugDot(item.x, item.y); 
            tabletQueue.splice(i, 1); 
        } 
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      const iTime = frameCounter * 0.015; 
      
      drop.sprite.y += drop.vy * delta; 
      drop.sprite.x += drop.vx * delta + Math.sin(iTime + drop.seed) * 0.2 * delta; 
      
      const angle = iTime + drop.seed;
      drop.sprite.scale.set(drop.baseScale * (0.4 + 0.6 * Math.abs(Math.cos(angle))), drop.baseScale * (0.4 + 0.6 * Math.abs(Math.cos(angle * 0.765))));
      drop.sprite.rotation = Math.sin(iTime * 1.5 + drop.seed) * 0.25;

      // === 核心：跨界座標映射 ===
      if (drop.sprite.y > MONITOR_H) { 
        const targetX = drop.sprite.x;
        
        // 映射 Y 軸 (z 數值為 0.0 ~ 3.0)
        // normZ: z=3(最遠) -> 0.0, z=0(最近) -> 1.0
        const normZ = 1.0 - (drop.z / 3.0); 
        const targetY = TABLET_START_Y + (normZ * TABLET_H);
        
        tabletQueue.push({ 
            x: targetX, 
            y: targetY, 
            triggerFrame: frameCounter + NETWORK_DELAY_FRAMES 
        }); 
        
        textContainer.removeChild(drop.sprite); 
        drop.sprite.destroy(); 
        drops.splice(i, 1); 
      }
    }
  });

  return {
    spawnWord: (userWords) => { currentWordPool = userWords; spawnWordFlow(userWords, Math.random() > 0.5, 0.8); },
    triggerCryingSequence: (userWords) => { if(!isCrying) { currentWordPool = userWords; isCrying = true; cryingTime = 0; wordSpawnTimer = 0; spawnWordFlow(userWords, Math.random() > 0.5, 0.8); } },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}