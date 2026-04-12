// src/engine/InkEngine.js
import { 
  WORDS, TOTAL_H, MONITOR_H, GAP_H, TABLET_H, TABLET_START_Y, VIRTUAL_H, 
  CRYING_DURATION, BG_COLOR, TEXT_COLOR, BEZEL_COLOR, FONT_FAMILY, FONT_SIZE_BASE,
  NETWORK_DELAY_FRAMES, DISPLACEMENT_STRENGTH, WATER_SPEED_Y, WATER_SPEED_X,
  EYE_OFFSET, WORD_SPAWN_INTERVAL, BASE_VELOCITY_X, SWAY_FREQUENCY, SWAY_AMPLITUDE,
  FADE_START_RATIO, FADE_END_RATIO, MIN_ALPHA, ALPHA_EASE, BLUR_START_RATIO, BLUR_MULTIPLIER,
  TRAIL_SPAWN_DENSITY, TRAIL_START_DEPTH, TRAIL_SCALE_Y, TRAIL_SCALE_X_BASE, 
  TRAIL_SCALE_X_DEPTH_MULTIPLIER, TRAIL_INITIAL_BLUR_MULTIPLIER, TRAIL_BASE_ALPHA, 
  TRAIL_DEPTH_ALPHA_MULTIPLIER, TRAIL_EXPAND_SPEED_Y, TRAIL_BLUR_INCREASE_RATE, TRAIL_GRAVITY_MULTIPLIER
} from '../config/constants';


// =========================================================================
// 📂 檔案二：本機端的 src/engine/InkEngine.js
// =========================================================================
export function createInkEngine(containerElement, getEyeData, videoElement) {
    const app = new window.PIXI.Application({
    width: 400,
    height: TOTAL_H, 
    backgroundColor: BG_COLOR,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  
  containerElement.appendChild(app.view);

  // --- 1. 預渲染文字 ---
  const uniqueChars = new Set(WORDS.join('').split(''));
  const charTextures = {};
  uniqueChars.forEach(char => {
    const textGraphic = new window.PIXI.Text(char, {
      fontFamily: FONT_FAMILY, fontSize: FONT_SIZE_BASE, fill: TEXT_COLOR, fontWeight: 'bold',
    });
    charTextures[char] = app.renderer.generateTexture(textGraphic);
    textGraphic.destroy();
  });

  // --- 2. 攝影機背景圖層 (僅限顯示器區域) ---
  const videoBaseTexture = new window.PIXI.BaseTexture(videoElement);
  const videoTexture = new window.PIXI.Texture(videoBaseTexture);
  const videoSprite = new window.PIXI.Sprite(videoTexture);
  
  const videoContainer = new window.PIXI.Container();
  videoSprite.anchor.set(0.5);
  videoContainer.addChild(videoSprite);

  // 加上遮罩，確保攝影機畫面「絕對不會」流到平板區
  const monitorMask = new window.PIXI.Graphics();
  monitorMask.beginFill(0xFFFFFF);
  monitorMask.drawRect(0, 0, 400, MONITOR_H);
  monitorMask.endFill();
  videoContainer.mask = monitorMask;

  app.stage.addChildAt(videoContainer, 0); 
  app.stage.addChildAt(monitorMask, 0);

  // --- 3. 平板區專屬底色 ---
  const tabletBg = new window.PIXI.Graphics();
  tabletBg.beginFill(BG_COLOR);
  tabletBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); // 這裡就不會報錯了！
  tabletBg.endFill();
  app.stage.addChildAt(tabletBg, 1); 

  // --- 4. 水波紋理與扭曲 ---
  const svgNoise = `
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" stitchTiles="stitch" /></filter>
      <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
  `;
  const noiseUrl = `data:image/svg+xml;base64,${btoa(svgNoise)}`;
  const noiseTexture = window.PIXI.Texture.from(noiseUrl);
  const waterSprite = new window.PIXI.TilingSprite(noiseTexture, app.screen.width, app.screen.height);
  
  waterSprite.alpha = 0.15; // 透明度讓底下的攝影機可見
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

  // --- 5. 實體縫隙遮罩 ---
  const bezelContainer = new window.PIXI.Container();
  app.stage.addChild(bezelContainer);

  const bezel = new window.PIXI.Graphics();
  bezel.beginFill(BEZEL_COLOR); 
  bezel.drawRect(0, MONITOR_H, 400, GAP_H); 
  bezel.endFill();
  bezelContainer.addChild(bezel);

  const delayText = new window.PIXI.Text("網路傳輸延遲中 (2 秒)...", {
      fontFamily: 'sans-serif', fontSize: 12, fill: 0x666666, align: 'center', letterSpacing: 2
  });
  delayText.anchor.set(0.5);
  delayText.position.set(200, MONITOR_H + (GAP_H / 2));
  bezelContainer.addChild(delayText);

  // --- 6. 變數與狀態 ---
  const drops = [];
  const inkTrails = [];
  const dropQueue = [];
  const tabletQueue = []; 
  let frameCounter = 0; 
  let isCrying = false;
  let cryingTime = 0;
  let wordSpawnTimer = 0;

  const spawnWordFlow = (isInner = Math.random() > 0.5, sizeScale = 1.0) => {
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
        char: char,
        x: eyeX + (Math.random() - 0.5) * (8 * sizeScale), 
        y: eyeY, 
        triggerFrame: frameCounter + (index * WORD_SPAWN_INTERVAL), 
        scale: sizeScale 
      });
    });
  };

  const spawnSingleChar = (char, startX, startY, scale, screen = 1, prevVx = null, prevVy = null) => {
    const drop = new window.PIXI.Sprite(charTextures[char]);
    drop.anchor.set(0.5);
    drop.position.set(startX, startY);
    drop.alpha = 1;
    drop.baseScale = scale;
    drop.scale.set(scale);
    
    const blurFilter = new window.PIXI.BlurFilter();
    blurFilter.blur = 0; 
    drop.filters = [blurFilter];

    textContainer.addChild(drop);

    drops.push({
      sprite: drop, char: char, blur: blurFilter, baseScale: scale, 
      vx: prevVx !== null ? prevVx : (Math.random() - 0.5) * BASE_VELOCITY_X, 
      vy: prevVy !== null ? prevVy : (Math.random() * 0.1 + 2.0) * (0.8 + scale * 0.2), 
      life: 0, lastTrailY: startY, screen: screen 
    });
  };

  app.ticker.add((delta) => {
    frameCounter += delta;

    // 動態計算攝影機比例，只填滿上半部 MONITOR_H
    if (videoElement.videoWidth > 0) {
       const vw = videoElement.videoWidth;
       const vh = videoElement.videoHeight;
       const scale = Math.max(400 / vw, MONITOR_H / vh);
       videoSprite.scale.set(scale);
       videoSprite.scale.x *= -1; // 鏡像
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
        const item = dropQueue[i];
        spawnSingleChar(item.char, item.x, item.y, item.scale, 1);
        dropQueue.splice(i, 1); 
      }
    }

    for (let i = tabletQueue.length - 1; i >= 0; i--) {
      if (frameCounter >= tabletQueue[i].triggerFrame) {
        const item = tabletQueue[i];
        spawnSingleChar(item.char, item.x, TABLET_START_Y, item.scale, 2, item.vx, item.vy);
        tabletQueue.splice(i, 1);
      }
    }

    waterSprite.tilePosition.y -= WATER_SPEED_Y * delta; 
    waterSprite.tilePosition.x -= WATER_SPEED_X * delta;

    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      drop.life += delta;
      drop.sprite.y += drop.vy * delta;
      drop.sprite.x += drop.vx * delta + Math.sin(drop.life * SWAY_FREQUENCY) * SWAY_AMPLITUDE; 

      const virtualY = drop.screen === 1 ? drop.sprite.y : drop.sprite.y - GAP_H;
      const depthRatio = virtualY / VIRTUAL_H; 
      
      const blurDepth = Math.min(depthRatio, FADE_END_RATIO);
      drop.blur.blur = Math.max(0, (blurDepth - BLUR_START_RATIO) * BLUR_MULTIPLIER);

      if (depthRatio > FADE_START_RATIO) {
          const fadeProgress = Math.min((depthRatio - FADE_START_RATIO) / (FADE_END_RATIO - FADE_START_RATIO), 1);
          drop.sprite.alpha += ((1 - ((1 - MIN_ALPHA) * fadeProgress)) - drop.sprite.alpha) * ALPHA_EASE;
      }

      if ((drop.sprite.y - drop.lastTrailY) >= Math.max(3, TRAIL_SPAWN_DENSITY * drop.baseScale) && depthRatio > TRAIL_START_DEPTH) {
        drop.lastTrailY = drop.sprite.y;
        const trail = new window.PIXI.Sprite(charTextures[drop.char]);
        trail.anchor.set(0.5);
        trail.position.set(drop.sprite.x, drop.sprite.y);
        trail.rotation = Math.random() * 0.2 - 0.1; 
        trail.scale.set((TRAIL_SCALE_X_BASE + (depthRatio * TRAIL_SCALE_X_DEPTH_MULTIPLIER)) * drop.baseScale, TRAIL_SCALE_Y * drop.baseScale); 
        
        const trailBlur = new window.PIXI.BlurFilter();
        trailBlur.blur = depthRatio * TRAIL_INITIAL_BLUR_MULTIPLIER; 
        trail.filters = [trailBlur];
        trail.alpha = TRAIL_BASE_ALPHA + (depthRatio * TRAIL_DEPTH_ALPHA_MULTIPLIER); 
        trailContainer.addChildAt(trail, 0);

        inkTrails.push({
          sprite: trail, blurFilter: trailBlur, 
          scaleSpeedX: 0.008 + (Math.random() * 0.005), scaleSpeedY: TRAIL_EXPAND_SPEED_Y,                           
          alphaSpeed: (0.015 + (Math.random() * 0.01)) / Math.max(0.6, drop.baseScale),  
          vy: drop.vy * TRAIL_GRAVITY_MULTIPLIER, screen: drop.screen
        });
      }

      const screenBottom = drop.screen === 1 ? MONITOR_H : TOTAL_H;
      if (drop.sprite.y > screenBottom) {
          if (drop.screen === 1) {
              tabletQueue.push({
                  char: drop.char, x: drop.sprite.x, scale: drop.baseScale, 
                  vx: drop.vx, vy: drop.vy, triggerFrame: frameCounter + NETWORK_DELAY_FRAMES 
              });
          }
          textContainer.removeChild(drop.sprite);
          drop.sprite.destroy();
          drops.splice(i, 1);
      }
    }

    for (let i = inkTrails.length - 1; i >= 0; i--) {
      const trail = inkTrails[i];
      trail.sprite.scale.x += trail.scaleSpeedX * delta;
      trail.sprite.scale.y += trail.scaleSpeedY * delta;
      trail.sprite.alpha -= trail.alphaSpeed * delta;
      trail.sprite.y += trail.vy * delta;
      if (trail.blurFilter) trail.blurFilter.blur += TRAIL_BLUR_INCREASE_RATE * delta;

      const trailBottom = trail.screen === 1 ? MONITOR_H : TOTAL_H;
      if (trail.sprite.alpha <= 0.01 || trail.sprite.y > trailBottom) {
        trailContainer.removeChild(trail.sprite);
        trail.sprite.destroy();
        inkTrails.splice(i, 1);
      }
    }
  });

  return {
    spawnWord: () => spawnWordFlow(Math.random() > 0.5, 0.8),
    triggerCryingSequence: () => { if(!isCrying) { isCrying = true; cryingTime = 0; wordSpawnTimer = 0; } },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}