// src/engine/MonitorEngine.js
import { WORDS, FONT_FAMILY, FONT_SIZE_BASE, TEXT_STROKE_WIDTH, TEXT_FILL_COLOR, TEXT_STROKE_COLOR, TEXT_STROKE_ALPHA, EYE_OFFSET, WORD_SPAWN_INTERVAL, BASE_VELOCITY_X, CRYING_DURATION } from '../config/constants';
import { setupMonitor } from './MonitorController';

export function createMonitorEngine(containerElement, getEyeData, videoElement, socket) {
  const app = new window.PIXI.Application({
    resizeTo: window, 
    backgroundColor: 0x0a0a0c,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  containerElement.appendChild(app.view);

  const uniqueChars = new Set(WORDS.join('').split(''));
  const charTextures = {};
  uniqueChars.forEach(char => {
    const textGraphic = new window.PIXI.Text(char, { fontFamily: FONT_FAMILY, fontSize: FONT_SIZE_BASE, fontWeight: 'bold', fill: TEXT_FILL_COLOR, stroke: TEXT_STROKE_COLOR, strokeThickness: TEXT_STROKE_WIDTH, lineJoin: 'round' });
    textGraphic.style.strokeAlpha = TEXT_STROKE_ALPHA; 
    charTextures[char] = app.renderer.generateTexture(textGraphic); textGraphic.destroy();
  });

  const textContainer = new window.PIXI.Container(); 
  app.stage.addChild(textContainer);
  const monitorCtrl = setupMonitor(app, videoElement);

  const drops = []; const dropQueue = [];
  let frameCounter = 0; let isCrying = false; let cryingTime = 0; let wordSpawnTimer = 0; let wasActive = false; let currentWordPool = WORDS;

  const spawnWordFlow = (userWords, isInner = Math.random() > 0.5, sizeScale = 1.0) => {
    const pool = userWords && userWords.length > 0 ? userWords : WORDS;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const chars = word.split('');
    const isLeftEye = Math.random() > 0.5; 
    const eyeData = getEyeData(); 
    let eyeX, eyeY;
    
    if (eyeData && eyeData.leftLowerEdge && eyeData.rightLowerEdge) {
      const edgePoints = isLeftEye ? eyeData.leftLowerEdge : eyeData.rightLowerEdge;
      const randomPoint = edgePoints[Math.floor(Math.random() * edgePoints.length)];
      eyeX = randomPoint.x; eyeY = randomPoint.y;
    } else {
      eyeX = app.screen.width * (isLeftEye ? 0.3 : 0.7) + (isInner ? EYE_OFFSET : -EYE_OFFSET); 
      eyeY = app.screen.height * 0.3; 
    }
    chars.forEach((char, index) => { dropQueue.push({ char, x: eyeX, y: eyeY, triggerFrame: frameCounter + (index * WORD_SPAWN_INTERVAL), scale: sizeScale }); });
  };

  const spawnSingleChar = (char, startX, startY, scale) => {
    const dropSprite = new window.PIXI.Sprite(charTextures[char]);
    dropSprite.anchor.set(0.5); dropSprite.position.set(startX, startY);
    const z = Math.random() * 3.0; 
    const depthScale = scale * (1.0 - (z / 3.0) * 0.5); 
    dropSprite.baseScale = depthScale; dropSprite.scale.set(depthScale);
    textContainer.addChild(dropSprite);
    const f = Math.random();
    drops.push({ sprite: dropSprite, char, baseScale: depthScale, vx: (Math.random() - 0.5) * BASE_VELOCITY_X, vy: (Math.random() * 0.1 + 1) * (0.8 + depthScale * 0.2), z: z, f: f, si: Math.sign(Math.sin(f * 175.0)) || 1, rotOffset: Math.sin(f * 175.0) * 1854.0 });
  };

  app.ticker.add((delta) => {
    frameCounter += delta; const iTime = frameCounter * 0.015;
    monitorCtrl.updateVideoScale();

    const isAnimating = isCrying || dropQueue.length > 0 || drops.length > 0;
    if (wasActive && !isAnimating) socket.emit('monitor-animation-finished');
    wasActive = isAnimating;

    if (isCrying) {
      cryingTime += delta * 16.66; const p = Math.min(cryingTime / CRYING_DURATION, 1);
      const framesPerWord = (1000 - Math.sin(p * Math.PI) * 800) / 16.66;
      wordSpawnTimer += delta;
      if (wordSpawnTimer >= framesPerWord) { wordSpawnTimer = 0; spawnWordFlow(currentWordPool, Math.random() < (1 - p), 0.4 + Math.sin(p * Math.PI) * 0.6); }
      if (p === 1) isCrying = false; 
    }

    for (let i = dropQueue.length - 1; i >= 0; i--) { if (frameCounter >= dropQueue[i].triggerFrame) { const item = dropQueue[i]; spawnSingleChar(item.char, item.x, item.y, item.scale); dropQueue.splice(i, 1); } }
    
    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      drop.sprite.y += drop.vy * (Math.sin(drop.f + 0.1) * 0.5 + 1.0) * delta; 
      const rotAngle = drop.si * iTime + drop.rotOffset;
      drop.sprite.rotation = rotAngle; drop.sprite.x += drop.vx * delta + Math.cos(rotAngle) * (drop.f * 0.2);
      const flipFactor = Math.abs(Math.sin(rotAngle)); 
      drop.sprite.scale.set(drop.baseScale * (0.9 + drop.f * 0.5), drop.baseScale * (0.9 + drop.f * 0.5) * (0.4 + flipFactor * 0.6));

      if (drop.sprite.y > app.screen.height) { 
        socket.emit('monitor-tear-overflow', {
          nx: drop.sprite.x / app.screen.width, 
          z: drop.z,
          char: drop.char // 🌟 核心新增：把這滴眼淚是什麼字一起送過去
        });
        textContainer.removeChild(drop.sprite); drop.sprite.destroy(); drops.splice(i, 1); 
      }
    }
  });

  return { triggerCrying: (userWords) => { currentWordPool = userWords; isCrying = true; cryingTime = 0; wordSpawnTimer = 0; spawnWordFlow(userWords, Math.random() > 0.5, 0.8); }, destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true }) };
}