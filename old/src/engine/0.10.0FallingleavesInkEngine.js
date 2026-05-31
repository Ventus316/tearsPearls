// src/engine/style/0.10.0FallingleavesInkEngine.js

import { 
  WORDS, TOTAL_H, MONITOR_H, GAP_H, TABLET_START_Y, TABLET_H, 
  CRYING_DURATION, FONT_FAMILY, FONT_SIZE_BASE, TEXT_STROKE_WIDTH,
  EYE_OFFSET, WORD_SPAWN_INTERVAL
} from '../config/constants';

// 落葉水平初速稍微調大，增加隨風飄散感
export const BASE_VELOCITY_X = 0.01;     
const NETWORK_DELAY_FRAMES = 18; // 0.3 秒延遲

import { setupMonitor } from './MonitorController';
import { setupTablet } from './0.10.0TabletController'; // 引入新版平板控制器

export function createInkEngine(containerElement, getEyeData, videoElement, onComplete) {
  const app = new window.PIXI.Application({
    width: 400, height: TOTAL_H, backgroundColor: 0x0a0a0c, resolution: window.devicePixelRatio || 1, autoDensity: true,
  });
  containerElement.appendChild(app.view);

  // 配合水波紋淺色背景，將字體改為深色
  const uniqueChars = new Set(WORDS.join('').split(''));
  const charTextures = {};
  uniqueChars.forEach(char => {
    const textGraphic = new window.PIXI.Text(char, {
      fontFamily: FONT_FAMILY, fontSize: FONT_SIZE_BASE, fill: 0x111315, 
      fontWeight: 'bold', stroke: 0xFFFFFF, strokeThickness: TEXT_STROKE_WIDTH
    });
    charTextures[char] = app.renderer.generateTexture(textGraphic);
    textGraphic.destroy();
  });

  const masterContainer = new window.PIXI.Container();
  app.stage.addChild(masterContainer);
  const textContainer = new window.PIXI.Container(); 
  masterContainer.addChild(textContainer);

  const monitorCtrl = setupMonitor(app, videoElement);
  const tabletCtrl = setupTablet(app); // 初始化新版控制器

  const drops = []; const dropQueue = []; const tabletQueue = []; 
  let frameCounter = 0; let isCrying = false; let cryingTime = 0; let wordSpawnTimer = 0; let wasActive = false; 
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
    dropSprite.anchor.set(0.5); dropSprite.position.set(startX, startY); dropSprite.alpha = 1; 
    
    // === 注入 Z 軸深度 (用於平板映射) ===
    const z = Math.random() * 3.0; // 統一深度標準為 0.0 ~ 3.0
    const depthScale = scale * (1.0 - (z / 3.0) * 0.5); 
    dropSprite.baseScale = depthScale;
    dropSprite.scale.set(depthScale);
    
    textContainer.addChild(dropSprite);
    
    // === 注入 Fallingleaves 數學種子 ===
    const seed = Math.random(); 
    
    drops.push({ 
      sprite: dropSprite, char, baseScale: depthScale, 
      vx: (Math.random() - 0.5) * BASE_VELOCITY_X, 
      vy: (Math.random() * 0.4 + 0.8) * (0.8 + depthScale * 0.2), // 落葉垂直掉落速度較慢、輕盈
      z: z, // 存入深度供後續映射
      seed: seed * 53.34, 
      swayFreq: 0.015 + Math.random() * 0.015, // 搖擺頻率
      // 轉換舊版 z(0~10) 為新版 z(0~3) 的視覺係數：將 z 乘回 3.33 維持原有翻滾感
      tumbleSpeed: 1.0 + Math.log(1.0 + z * 3.33) * 0.5 
    });
  };

  app.ticker.add((delta) => {
    frameCounter += delta;
    const iTime = frameCounter * 0.015; 
    
    monitorCtrl.updateVideoScale();
    tabletCtrl.updateWater(delta, iTime); // 驅動背景與水波

    const isAnimating = isCrying || dropQueue.length > 0 || tabletQueue.length > 0 || drops.length > 0;
    tabletCtrl.setShaderVisible(isAnimating);

    if (wasActive && !isAnimating) {
        if (typeof onComplete === 'function') onComplete();
    }
    wasActive = isAnimating; 

    if (isCrying) {
      cryingTime += delta * 16.66; const p = Math.min(cryingTime / CRYING_DURATION, 1); 
      const framesPerWord = (1000 - Math.sin(p * Math.PI) * 800) / 16.66;
      wordSpawnTimer += delta;
      if (wordSpawnTimer >= framesPerWord) { wordSpawnTimer = 0; spawnWordFlow(currentWordPool, Math.random() < (1 - p), 0.4 + Math.sin(p * Math.PI) * 0.6); }
      if (p === 1) isCrying = false; 
    }

    for (let i = dropQueue.length - 1; i >= 0; i--) { if (frameCounter >= dropQueue[i].triggerFrame) { const item = dropQueue[i]; spawnSingleChar(item.char, item.x, item.y, item.scale); dropQueue.splice(i, 1); } }
    
    // 觸發水波紋
    for (let i = tabletQueue.length - 1; i >= 0; i--) { 
        if (frameCounter >= tabletQueue[i].triggerFrame) { 
            const item = tabletQueue[i]; 
            tabletCtrl.addRipple(item.x, item.y); 
            tabletQueue.splice(i, 1); 
        } 
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      
      // === Fallingleaves 物理動態 (保留原版落葉飄散邏輯) ===
      
      // 1. 垂直位移: 加入些微的空氣阻力/漂浮感 (flutter)
      const flutter = Math.sin(iTime * drop.swayFreq * 2.0 + drop.seed) * 0.3;
      drop.sprite.y += (drop.vy + flutter) * delta; 
      
      // 2. 水平飄移: 落葉的 S 型搖擺，將新版 z 等比例放大維持飄移幅度
      drop.sprite.x += (drop.vx + Math.sin(iTime * drop.swayFreq + drop.seed) * (0.0005 + (drop.z * 3.33) * 0.001)) * delta;
      
      // 3. 旋轉與 3D 翻轉 
      const angle = iTime * drop.tumbleSpeed + drop.seed;
      drop.sprite.rotation = angle * 0.5; // Z 軸平面旋轉
      
      // 模擬翻轉視覺壓縮
      const flipFactor = Math.cos(angle * 1.7); 
      drop.sprite.scale.set(
        drop.baseScale * (0.5 + 0.5 * Math.abs(flipFactor)), // X 軸隨翻轉壓縮
        drop.baseScale // Y 軸保持不變，產生立體翻面錯覺
      );
      // ==============================

      // === 跨螢幕映射邏輯 ===
      if (drop.sprite.y > MONITOR_H) { 
        const targetX = drop.sprite.x;
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