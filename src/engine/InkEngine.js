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
  CONVERGE_SPEED_MOVE, CONVERGE_SPEED_ALPHA, CONVERGE_SPEED_SCALE, CONVERGE_BOTTOM_OFFSET, CONVERGE_FADE_HEIGHT
} from '../config/constants';

export function createInkEngine(containerElement, getEyeData, videoElement, onComplete) {
  const app = new window.PIXI.Application({
    width: 400,
    height: TOTAL_H, 
    backgroundColor: BG_COLOR,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  
  containerElement.appendChild(app.view);

  const uniqueChars = new Set(WORDS.join('').split(''));
  const charTextures = {};
  uniqueChars.forEach(char => {
    const textGraphic = new window.PIXI.Text(char, {
      fontFamily: FONT_FAMILY, fontSize: FONT_SIZE_BASE, fill: TEXT_COLOR, fontWeight: 'bold',
      stroke: 0xFFFFFF, strokeThickness: TEXT_STROKE_WIDTH
    });
    charTextures[char] = app.renderer.generateTexture(textGraphic);
    textGraphic.destroy();
  });

  const videoBaseTexture = new window.PIXI.BaseTexture(videoElement);
  const videoTexture = new window.PIXI.Texture(videoBaseTexture);
  const videoSprite = new window.PIXI.Sprite(videoTexture);
  const videoContainer = new window.PIXI.Container();
  videoSprite.anchor.set(0.5);
  videoContainer.addChild(videoSprite);

  const monitorMask = new window.PIXI.Graphics();
  monitorMask.beginFill(0xFFFFFF);
  monitorMask.drawRect(0, 0, 400, MONITOR_H);
  monitorMask.endFill();
  videoContainer.mask = monitorMask;
  app.stage.addChildAt(videoContainer, 0); 
  app.stage.addChildAt(monitorMask, 0);

  const tabletBg = new window.PIXI.Graphics();
  tabletBg.beginFill(BG_COLOR);
  tabletBg.drawRect(0, TABLET_START_Y, 400, TABLET_H);
  tabletBg.endFill();
  app.stage.addChildAt(tabletBg, 1); 

  const svgNs = "http://" + "www.w3.org/2000/svg";
  const svgNoiseUrl = 'data:image/svg+xml;base64,' + window.btoa(`
    <svg viewBox="0 0 512 512" xmlns="${svgNs}">
      <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" stitchTiles="stitch" /></filter>
      <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
  `);
  const noiseTexture = window.PIXI.Texture.from(svgNoiseUrl);
  const waterSprite = new window.PIXI.TilingSprite(noiseTexture, app.screen.width, app.screen.height);
  waterSprite.alpha = 0.15; 
  app.stage.addChild(waterSprite);

  const masterContainer = new window.PIXI.Container();
  const displacementFilter = new window.PIXI.DisplacementFilter(waterSprite);
  displacementFilter.scale.set(DISPLACEMENT_STRENGTH); 
  masterContainer.filters = [displacementFilter];
  app.stage.addChild(masterContainer);

  const trailContainer = new window.PIXI.Container();
  masterContainer.addChild(trailContainer);
  const textContainer = new window.PIXI.Container();
  masterContainer.addChild(textContainer);

  // --- 視覺與物理座標定義 ---
  // 1. 寶石的視覺位置 (可自由調整，不影響文字匯聚軌跡)
  const GEM_CENTER_Y = TABLET_START_Y + (TABLET_H * 0.7); 
  
  // 2. 文字匯聚的物理引力點 (依賴常數設定)
  const GRAVITY_Y = TABLET_START_Y + TABLET_H - CONVERGE_BOTTOM_OFFSET;
  
  // 3. 透明化與縮小的觸發水平線 (依賴常數設定)
  const FADE_START_Y = TABLET_START_Y + TABLET_H - CONVERGE_FADE_HEIGHT;

  let currentGemScale = 0;
  let targetGemScale = 0;
  let showGem = false; 

  let gemReadyTimer = 0;
  let hasTriggeredComplete = false;

  const gemContainer = new window.PIXI.Container();
  gemContainer.position.set(200, GEM_CENTER_Y);
  gemContainer.scale.set(0); 
  gemContainer.visible = false;

  const gemGlow = new window.PIXI.Graphics();
  gemGlow.beginFill(0xF59E0B, 0.4); 
  gemGlow.drawCircle(0, 0, 55);
  gemGlow.endFill();
  const glowBlur = new window.PIXI.BlurFilter(); glowBlur.blur = 25;
  gemGlow.filters = [glowBlur];
  gemContainer.addChild(gemGlow);

  const gemCore = new window.PIXI.Graphics();
  gemCore.lineStyle(2, 0xFDE68A, 0.9);
  gemCore.beginFill(0xD97706, 1.0);
  gemCore.moveTo(0, -40); gemCore.lineTo(28, 0); gemCore.lineTo(0, 50); gemCore.lineTo(-28, 0);
  gemCore.closePath(); gemCore.endFill();
  gemContainer.addChild(gemCore);

  masterContainer.addChildAt(gemContainer, 1); 

  const bezelContainer = new window.PIXI.Container();
  app.stage.addChild(bezelContainer);
  const bezel = new window.PIXI.Graphics();
  bezel.beginFill(BEZEL_COLOR); bezel.drawRect(0, MONITOR_H, 400, GAP_H); bezel.endFill();
  bezelContainer.addChild(bezel);

  const drops = [];
  const inkTrails = [];
  const dropQueue = [];
  const tabletQueue = []; 
  let frameCounter = 0; 
  let isCrying = false;
  let cryingTime = 0;
  let wordSpawnTimer = 0;
  let wasActive = false; 

  const spawnWordFlow = (isInner = Math.random() > 0.5, sizeScale = 1.0) => {
    showGem = false; 
    hasTriggeredComplete = false;
    gemReadyTimer = 0;

    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const chars = word.split('');
    const isLeftEye = Math.random() > 0.5; 
    const eyeData = getEyeData(); 
    let eyeX, eyeY;
    if (eyeData) {
      if (isLeftEye) {
         eyeX = isInner ? eyeData.leftInner.x : eyeData.leftOuter.x;
         eyeY = isInner ? eyeData.leftInner.y : eyeData.leftOuter.y;
      } else {
         eyeX = isInner ? eyeData.rightInner.x : eyeData.rightOuter.x;
         eyeY = isInner ? eyeData.rightInner.y : eyeData.rightOuter.y;
      }
    } else {
      const baseEyeX = app.screen.width * (isLeftEye ? 0.3 : 0.7);
      eyeX = baseEyeX + (isInner ? EYE_OFFSET : -EYE_OFFSET);
      eyeY = 150; 
    }
    chars.forEach((char, index) => {
      dropQueue.push({
        char: char, x: eyeX, y: eyeY, 
        triggerFrame: frameCounter + (index * WORD_SPAWN_INTERVAL), scale: sizeScale 
      });
    });
  };

  const spawnSingleChar = (char, startX, startY, scale, screen = 1, prevVx = null, prevVy = null) => {
    const dropSprite = new window.PIXI.Sprite(charTextures[char]);
    dropSprite.anchor.set(0.5); dropSprite.position.set(startX, startY);
    dropSprite.alpha = 1; dropSprite.baseScale = scale; dropSprite.scale.set(scale);
    const blurFilter = new window.PIXI.BlurFilter(); blurFilter.blur = 0; dropSprite.filters = [blurFilter];
    textContainer.addChild(dropSprite);

    drops.push({
      sprite: dropSprite, char: char, blur: blurFilter, baseScale: scale, 
      vx: prevVx !== null ? prevVx : (Math.random() - 0.5) * BASE_VELOCITY_X, 
      vy: prevVy !== null ? prevVy : (Math.random() * 0.1 + 2.0) * (0.8 + scale * 0.2), 
      life: 0, lastTrailY: startY, screen: screen,
      isConverging: screen === 2 // 在平板生成時立刻進入匯聚狀態
    });
  };

  app.ticker.add((delta) => {
    frameCounter += delta;

    if (videoElement.videoWidth > 0) {
       const scale = Math.max(400 / videoElement.videoWidth, MONITOR_H / videoElement.videoHeight);
       videoSprite.scale.set(scale); videoSprite.scale.x *= -1; 
       videoSprite.position.set(200, MONITOR_H / 2); 
    }

    if (isCrying) {
      cryingTime += delta * 16.66; 
      const p = Math.min(cryingTime / CRYING_DURATION, 1); 
      const framesPerWord = (1200 - Math.sin(p * Math.PI) * 800) / 16.66;
      wordSpawnTimer += delta;
      if (wordSpawnTimer >= framesPerWord) {
        wordSpawnTimer = 0;
        spawnWordFlow(Math.random() < (1 - p), 0.4 + Math.sin(p * Math.PI) * 0.6);
      }
      if (p === 1) isCrying = false; 
    }

    for (let i = dropQueue.length - 1; i >= 0; i--) {
      if (frameCounter >= dropQueue[i].triggerFrame) {
        const item = dropQueue[i]; spawnSingleChar(item.char, item.x, item.y, item.scale, 1); dropQueue.splice(i, 1); 
      }
    }

    for (let i = tabletQueue.length - 1; i >= 0; i--) {
      if (frameCounter >= tabletQueue[i].triggerFrame) {
        const item = tabletQueue[i]; spawnSingleChar(item.char, item.x, TABLET_START_Y, item.scale, 2, item.vx, item.vy); tabletQueue.splice(i, 1);
      }
    }

    waterSprite.tilePosition.y -= WATER_SPEED_Y * delta; 
    waterSprite.tilePosition.x -= WATER_SPEED_X * delta;

    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i]; drop.life += delta;

      if (drop.isConverging) {
        // --- 解耦的匯聚物理學：往平板底部引力點飛 ---
        const dx = 200 - drop.sprite.x;
        const dy = GRAVITY_Y - drop.sprite.y;

        // 1. 移動：永遠套用位移，確保文字能抵達底部中心
        drop.sprite.x += dx * CONVERGE_SPEED_MOVE * delta;
        drop.sprite.y += dy * CONVERGE_SPEED_MOVE * delta;

        // 2. 消失與縮小：只有當文字掉落超過觸發線時，才開始透明化
        if (drop.sprite.y > FADE_START_Y) {
            drop.sprite.alpha *= CONVERGE_SPEED_ALPHA;
            drop.sprite.scale.set(drop.sprite.scale.x * CONVERGE_SPEED_SCALE);
        }

        // 3. 吸收：當距離引力點極近，或已經完全透明時觸發寶石能量
        const distToGravity = Math.hypot(dx, dy);
        if (distToGravity < 15 || drop.sprite.alpha < 0.05) {
            targetGemScale = Math.min(targetGemScale + 0.15, 1.2); 
            textContainer.removeChild(drop.sprite); drop.sprite.destroy(); drops.splice(i, 1);
        }
        continue;
      }

      drop.sprite.y += drop.vy * delta; drop.sprite.x += drop.vx * delta + Math.sin(drop.life * SWAY_FREQUENCY) * SWAY_AMPLITUDE; 
      const virtualY = drop.screen === 1 ? drop.sprite.y : drop.sprite.y - GAP_H;
      const depthRatio = virtualY / VIRTUAL_H; 
      drop.blur.blur = Math.max(0, (Math.min(depthRatio, FADE_END_RATIO) - BLUR_START_RATIO) * BLUR_MULTIPLIER);

      if (depthRatio > FADE_START_RATIO) {
          const fadeProgress = Math.min((depthRatio - FADE_START_RATIO) / (FADE_END_RATIO - FADE_START_RATIO), 1);
          drop.sprite.alpha += ((1 - ((1 - MIN_ALPHA) * fadeProgress)) - drop.sprite.alpha) * ALPHA_EASE;
      }

      if ((drop.sprite.y - drop.lastTrailY) >= Math.max(3, TRAIL_SPAWN_DENSITY * drop.baseScale) && depthRatio > TRAIL_START_DEPTH) {
        drop.lastTrailY = drop.sprite.y;
        const trail = new window.PIXI.Sprite(charTextures[drop.char]);
        trail.anchor.set(0.5); trail.position.set(drop.sprite.x, drop.sprite.y); trail.rotation = Math.random() * 0.2 - 0.1; 
        trail.scale.set((TRAIL_SCALE_X_BASE + (depthRatio * TRAIL_SCALE_X_DEPTH_MULTIPLIER)) * drop.baseScale, TRAIL_SCALE_Y * drop.baseScale); 
        const trailBlur = new window.PIXI.BlurFilter(); trailBlur.blur = depthRatio * TRAIL_INITIAL_BLUR_MULTIPLIER; 
        trail.filters = [trailBlur]; trail.alpha = TRAIL_BASE_ALPHA + (depthRatio * TRAIL_DEPTH_ALPHA_MULTIPLIER); 
        trailContainer.addChildAt(trail, 0);
        inkTrails.push({ sprite: trail, blurFilter: trailBlur, scaleSpeedX: 0.008 + (Math.random() * 0.005), scaleSpeedY: TRAIL_EXPAND_SPEED_Y, alphaSpeed: (0.015 + (Math.random() * 0.01)) / Math.max(0.6, drop.baseScale), vy: drop.vy * TRAIL_GRAVITY_MULTIPLIER, screen: drop.screen });
      }

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

    for (let i = inkTrails.length - 1; i >= 0; i--) {
      const trail = inkTrails[i];
      trail.sprite.scale.x += trail.scaleSpeedX * delta; trail.sprite.scale.y += trail.scaleSpeedY * delta;
      trail.sprite.alpha -= trail.alphaSpeed * delta; trail.sprite.y += trail.vy * delta;
      if (trail.blurFilter) trail.blurFilter.blur += TRAIL_BLUR_INCREASE_RATE * delta;
      if (trail.sprite.alpha <= 0.01 || trail.sprite.y > (trail.screen === 1 ? MONITOR_H : TOTAL_H)) {
        trailContainer.removeChild(trail.sprite); trail.sprite.destroy(); inkTrails.splice(i, 1);
      }
    }

    const isAnimating = isCrying || dropQueue.length > 0 || tabletQueue.length > 0 || drops.length > 0 || inkTrails.length > 0;
    
    if (wasActive && !isAnimating) {
      showGem = true;
    }
    wasActive = isAnimating; 

    if (showGem) {
      gemContainer.visible = true;
      targetGemScale = Math.max(0, targetGemScale - 0.0005 * delta); 
      currentGemScale += (Math.max(1.0, targetGemScale) - currentGemScale) * 0.05 * delta;
      gemContainer.y = GEM_CENTER_Y + Math.sin(frameCounter * 0.04) * 5;
      gemGlow.alpha = 0.4 + Math.sin(frameCounter * 0.1) * 0.2;

      if (currentGemScale > 0.95 && !hasTriggeredComplete) {
        gemReadyTimer += delta * 16.66; 
        if (gemReadyTimer >= 2000) { 
          if (typeof onComplete === 'function') onComplete();
          hasTriggeredComplete = true; 
        }
      }
    } else {
      currentGemScale += (0 - currentGemScale) * 0.1 * delta;
      if (currentGemScale < 0.01) gemContainer.visible = false;
    }
    
    gemContainer.scale.set(currentGemScale); 
  });

  return {
    spawnWord: () => { showGem = false; hasTriggeredComplete = false; gemReadyTimer = 0; targetGemScale = 0; spawnWordFlow(Math.random() > 0.5, 0.8); },
    triggerCryingSequence: () => { if(!isCrying) { showGem = false; hasTriggeredComplete = false; gemReadyTimer = 0; targetGemScale = 0; isCrying = true; cryingTime = 0; wordSpawnTimer = 0; } },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}