// src/engine/InkEngine.js
import { 
  WORDS, TOTAL_H, MONITOR_H, GAP_H, TABLET_START_Y, VIRTUAL_H, 
  CRYING_DURATION, BG_COLOR, TEXT_COLOR, BEZEL_COLOR, FONT_FAMILY, FONT_SIZE_BASE,
  NETWORK_DELAY_FRAMES, DISPLACEMENT_STRENGTH, WATER_SPEED_Y, WATER_SPEED_X,
  EYE_OFFSET, WORD_SPAWN_INTERVAL, BASE_VELOCITY_X, SWAY_FREQUENCY, SWAY_AMPLITUDE,
  FADE_START_RATIO, FADE_END_RATIO, MIN_ALPHA, ALPHA_EASE, BLUR_START_RATIO, BLUR_MULTIPLIER,
  TRAIL_SPAWN_DENSITY, TRAIL_START_DEPTH, TRAIL_SCALE_Y, TRAIL_SCALE_X_BASE, 
  TRAIL_SCALE_X_DEPTH_MULTIPLIER, TRAIL_INITIAL_BLUR_MULTIPLIER, TRAIL_BASE_ALPHA, 
  TRAIL_DEPTH_ALPHA_MULTIPLIER, TRAIL_EXPAND_SPEED_Y, TRAIL_BLUR_INCREASE_RATE, TRAIL_GRAVITY_MULTIPLIER
} from '../config/constants';

export function createInkEngine(containerElement) {
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
      fontFamily: FONT_FAMILY, 
      fontSize: FONT_SIZE_BASE,    
      fill: TEXT_COLOR,  
      fontWeight: 'bold',
    });
    charTextures[char] = app.renderer.generateTexture(textGraphic);
    textGraphic.destroy();
  });

  const svgNoise = `
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
  `;
  const noiseUrl = `data:image/svg+xml;base64,${btoa(svgNoise)}`;
  const noiseTexture = window.PIXI.Texture.from(noiseUrl);
  
  const waterSprite = new window.PIXI.TilingSprite(noiseTexture, app.screen.width, app.screen.height);
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

  const bezelContainer = new window.PIXI.Container();
  app.stage.addChild(bezelContainer);

  const bezel = new window.PIXI.Graphics();
  bezel.beginFill(BEZEL_COLOR); 
  bezel.drawRect(0, MONITOR_H, 400, GAP_H); 
  bezel.endFill();
  bezelContainer.addChild(bezel);

  const delayText = new window.PIXI.Text("網路傳輸延遲中 (2 秒)...", {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fill: 0x666666,
      align: 'center',
      letterSpacing: 2
  });
  delayText.anchor.set(0.5);
  delayText.x = 200;
  delayText.y = MONITOR_H + (GAP_H / 2); 
  bezelContainer.addChild(delayText);

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
    
    const baseEyeX = isLeftEye ? app.screen.width * 0.3 : app.screen.width * 0.7;
    const eyeOffset = EYE_OFFSET; 
    
    let eyeX = baseEyeX;
    if (isLeftEye) {
      eyeX += isInner ? eyeOffset : -eyeOffset;
    } else {
      eyeX += isInner ? -eyeOffset : eyeOffset;
    }
    
    chars.forEach((char, index) => {
      dropQueue.push({
        char: char,
        x: eyeX + (Math.random() - 0.5) * (8 * sizeScale), 
        y: 40, 
        triggerFrame: frameCounter + (index * WORD_SPAWN_INTERVAL), 
        scale: sizeScale 
      });
    });
  };

  const spawnSingleChar = (char, startX, startY, scale, screen = 1, prevVx = null, prevVy = null) => {
    const drop = new window.PIXI.Sprite(charTextures[char]);
    drop.anchor.set(0.5);
    drop.x = startX; 
    drop.y = startY;
    drop.alpha = 1;
    
    drop.baseScale = scale;
    drop.scale.set(scale);
    
    const blurFilter = new window.PIXI.BlurFilter();
    blurFilter.blur = 0; 
    drop.filters = [blurFilter];

    textContainer.addChild(drop);

    drops.push({
      sprite: drop,
      char: char,
      blur: blurFilter,
      baseScale: scale, 
      vx: prevVx !== null ? prevVx : (Math.random() - 0.5) * BASE_VELOCITY_X, 
      vy: prevVy !== null ? prevVy : (Math.random() * 0.1 + 2.0) * (0.8 + scale * 0.2), 
      life: 0,
      lastTrailY: startY,
      screen: screen 
    });
  };

  const spawnWord = () => spawnWordFlow(Math.random() > 0.5, 0.8);

  const triggerCryingSequence = () => {
    if(isCrying) return;
    isCrying = true;
    cryingTime = 0;
    wordSpawnTimer = 0;
  };

  app.ticker.add((delta) => {
    frameCounter += delta;

    if (isCrying) {
      cryingTime += delta * 16.66; 
      const p = Math.min(cryingTime / CRYING_DURATION, 1); 

      const currentInterval = 1200 - Math.sin(p * Math.PI) * 800; 
      const framesPerWord = currentInterval / 16.66;

      wordSpawnTimer += delta;
      if (wordSpawnTimer >= framesPerWord) {
        wordSpawnTimer = 0;
        const isInner = Math.random() < (1 - p);
        const sizeScale = 0.4 + Math.sin(p * Math.PI) * 0.6;
        spawnWordFlow(isInner, sizeScale);
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

      let targetAlpha = 1;
      if (depthRatio > FADE_START_RATIO) {
          const fadeProgress = Math.min((depthRatio - FADE_START_RATIO) / (FADE_END_RATIO - FADE_START_RATIO), 1);
          // 使用常數換算最低透明度，例如 MIN_ALPHA = 0.9，則公式等同 1 - (0.1 * fadeProgress)
          targetAlpha = 1 - ((1 - MIN_ALPHA) * fadeProgress);
      }
      
      drop.sprite.alpha += (targetAlpha - drop.sprite.alpha) * ALPHA_EASE;

      const triggerDist = Math.max(3, TRAIL_SPAWN_DENSITY * drop.baseScale); 
      const distMoved = drop.sprite.y - drop.lastTrailY;
      
      if (distMoved >= triggerDist && depthRatio > TRAIL_START_DEPTH) {
        drop.lastTrailY = drop.sprite.y;
        
        const trail = new window.PIXI.Sprite(charTextures[drop.char]);
        trail.anchor.set(0.5);
        trail.x = drop.sprite.x;
        trail.y = drop.sprite.y;
        trail.rotation = Math.random() * 0.2 - 0.1; 
        
        trail.scale.y = TRAIL_SCALE_Y * drop.baseScale; 
        trail.scale.x = (TRAIL_SCALE_X_BASE + (depthRatio * TRAIL_SCALE_X_DEPTH_MULTIPLIER)) * drop.baseScale; 
        
        const trailBlur = new window.PIXI.BlurFilter();
        trailBlur.blur = depthRatio * TRAIL_INITIAL_BLUR_MULTIPLIER; 
        trail.filters = [trailBlur];
        
        trail.alpha = TRAIL_BASE_ALPHA + (depthRatio * TRAIL_DEPTH_ALPHA_MULTIPLIER); 
        
        trailContainer.addChildAt(trail, 0);

        inkTrails.push({
          sprite: trail,
          blurFilter: trailBlur, 
          scaleSpeedX: 0.008 + (Math.random() * 0.005), 
          scaleSpeedY: TRAIL_EXPAND_SPEED_Y,                           
          alphaSpeed: (0.015 + (Math.random() * 0.01)) / Math.max(0.6, drop.baseScale),  
          vy: drop.vy * TRAIL_GRAVITY_MULTIPLIER,
          screen: drop.screen
        });
      }

      const screenBottom = drop.screen === 1 ? MONITOR_H : TOTAL_H;
      if (drop.sprite.y > screenBottom) {
          if (drop.screen === 1) {
              tabletQueue.push({
                  char: drop.char,
                  x: drop.sprite.x,
                  scale: drop.baseScale, 
                  vx: drop.vx,
                  vy: drop.vy,
                  triggerFrame: frameCounter + NETWORK_DELAY_FRAMES 
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
      
      if (trail.blurFilter) {
        trail.blurFilter.blur += TRAIL_BLUR_INCREASE_RATE * delta;
      }

      const trailBottom = trail.screen === 1 ? MONITOR_H : TOTAL_H;
      
      if (trail.sprite.alpha <= 0.01 || trail.sprite.y > trailBottom) {
        trailContainer.removeChild(trail.sprite);
        trail.sprite.destroy();
        inkTrails.splice(i, 1);
      }
    }
  });

  return {
    spawnWord,
    triggerCryingSequence,
    destroy: () => {
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    }
  };
}