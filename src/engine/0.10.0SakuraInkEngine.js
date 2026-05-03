// src/engine/style/0.10.0SakuraInkEngine.js

import { 
  WORDS, TOTAL_H, MONITOR_H, GAP_H, TABLET_START_Y, TABLET_H, 
  CRYING_DURATION, FONT_FAMILY, FONT_SIZE_BASE, TEXT_STROKE_WIDTH,
  EYE_OFFSET, WORD_SPAWN_INTERVAL, 
  GEM_MAPPING 
} from '../config/constants';

export const BASE_VELOCITY_X = 0.05;     
const NETWORK_DELAY_FRAMES = 18; 

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
  const tabletCtrl = setupTablet(app); 

  const drops = []; const dropQueue = []; const tabletQueue = []; 
  let frameCounter = 0; let isCrying = false; let cryingTime = 0; let wordSpawnTimer = 0; let wasActive = false; 
  let currentWordPool = WORDS; 

  const determineGemType = (userWords) => {
    if (!userWords || userWords.length === 0) return 'diamond'; 
    const counts = { pearl: 0, diamond: 0, quartz: 0, opal: 0, lapis: 0 };
    userWords.forEach(word => {
      for (const [gem, wordsList] of Object.entries(GEM_MAPPING)) {
        if (wordsList.includes(word)) counts[gem]++;
      }
    });
    let maxCount = -1; 
    let selectedGem = 'diamond';
    for (const [gem, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; selectedGem = gem; }
    }
    return selectedGem;
  };
  
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
    const z = Math.random() * 3.0; 
    const depthScale = scale * (1.0 - (z / 3.0) * 0.5); 
    dropSprite.baseScale = depthScale;
    dropSprite.scale.set(depthScale);
    textContainer.addChild(dropSprite);
    const f = Math.random(); 
    drops.push({ 
      sprite: dropSprite, char, baseScale: depthScale, 
      vx: (Math.random() - 0.5) * BASE_VELOCITY_X, 
      vy: (Math.random() * 0.1 + 1) * (0.8 + depthScale * 0.2), 
      z: z, f: f, si: Math.sign(Math.sin(f * 175.0)) || 1, rotOffset: Math.sin(f * 175.0) * 1854.0 
    });
  };

  app.ticker.add((delta) => {
    frameCounter += delta;
    const iTime = frameCounter * 0.015; 
    
    monitorCtrl.updateVideoScale();
    tabletCtrl.updateWater(delta, iTime); 

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
      if (wordSpawnTimer >= framesPerWord) { 
        wordSpawnTimer = 0; 
        spawnWordFlow(currentWordPool, Math.random() < (1 - p), 0.4 + Math.sin(p * Math.PI) * 0.6); 
      }
      if (p === 1) isCrying = false; 
    }

    for (let i = dropQueue.length - 1; i >= 0; i--) { if (frameCounter >= dropQueue[i].triggerFrame) { const item = dropQueue[i]; spawnSingleChar(item.char, item.x, item.y, item.scale); dropQueue.splice(i, 1); } }
    
    for (let i = tabletQueue.length - 1; i >= 0; i--) { 
        if (frameCounter >= tabletQueue[i].triggerFrame) { 
            const item = tabletQueue[i]; 
            tabletCtrl.addRipple(item.x, item.y); 
            tabletQueue.splice(i, 1); 
        } 
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      const speedFactor = (Math.sin(drop.f + 0.1) * 0.5 + 1.0);
      drop.sprite.y += drop.vy * speedFactor * delta; 
      const rotAngle = drop.si * iTime + drop.rotOffset;
      drop.sprite.rotation = rotAngle;
      drop.sprite.x += drop.vx * delta + Math.cos(rotAngle) * (drop.f * 0.2);
      const shaderScale = 0.9 + (drop.f * 0.5);
      const flipFactor = Math.abs(Math.sin(rotAngle)); 
      drop.sprite.scale.set(drop.baseScale * shaderScale, drop.baseScale * shaderScale * (0.4 + flipFactor * 0.6));

      if (drop.sprite.y > MONITOR_H) { 
        const targetX = drop.sprite.x;
        const normZ = 1.0 - (drop.z / 3.0); 
        const targetY = TABLET_START_Y + (normZ * TABLET_H);
        tabletQueue.push({ x: targetX, y: targetY, triggerFrame: frameCounter + NETWORK_DELAY_FRAMES }); 
        textContainer.removeChild(drop.sprite); 
        drop.sprite.destroy(); 
        drops.splice(i, 1); 
      }
    }
  });

  return {
    spawnWord: (userWords) => { currentWordPool = userWords; spawnWordFlow(userWords, Math.random() > 0.5, 0.8); },
    triggerCryingSequence: (userWords) => { 
      if(!isCrying) { 
        currentWordPool = userWords; 
        isCrying = true; 
        cryingTime = 0; 
        wordSpawnTimer = 0; 
        spawnWordFlow(userWords, Math.random() > 0.5, 0.8); 
        const targetGem = determineGemType(userWords);
        tabletCtrl.revealGem(targetGem);
      } 
    },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}