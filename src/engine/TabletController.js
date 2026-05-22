// src/engine/TabletController.js
import { gsap } from 'gsap'; 

export function setupTablet(app) {
  const container = new window.PIXI.Container();
  app.stage.addChild(container);

  const rippleTextures = {};
  Promise.all([
    fetch('/textImg/textImgLone.json').then(res => res.json()), 
    window.PIXI.Assets.load('/textImg/textImgLone.png')         
  ])
  .then(([jsonData, baseTexture]) => {
    jsonData.forEach(data => {
      const rect = new window.PIXI.Rectangle(data.x, data.y, data.width, data.height);
      rippleTextures[data.name] = new window.PIXI.Texture(baseTexture, rect);
    });
  }).catch(e => console.error(e));

  const waterLayer = new window.PIXI.Container();
  container.addChild(waterLayer);

  let gemSpriteBottom = new window.PIXI.AnimatedSprite([window.PIXI.Texture.EMPTY]);
  let gemSpriteTop = new window.PIXI.AnimatedSprite([window.PIXI.Texture.EMPTY]);

  const initGemSprite = (sprite, parent) => {
    sprite.anchor.set(0.5); 
    // 🌟 初始化寶石位置到全螢幕的正中央
    sprite.x = app.screen.width / 2; 
    sprite.y = app.screen.height / 2; 
    sprite.alpha = 0; 
    sprite.scale.set(0.04); // 為了大螢幕稍微放大寶石
    sprite.animationSpeed = 0.5; 
    parent.addChild(sprite);
  };

  initGemSprite(gemSpriteBottom, waterLayer); 
  initGemSprite(gemSpriteTop, container);     

  const splashContainer = new window.PIXI.Container();
  container.addChild(splashContainer);
  let activeSplashes = []; 

  let isRevealingGem = false;
  let gemAnimTime = 0; 
  const GEM_REVEAL_DURATION = 12000; 
  const sheetCache = {};

  const revealGem = async (gemType) => {
    isRevealingGem = false; 
    if (!sheetCache[gemType]) {
      const sheet = await window.PIXI.Assets.load(`/gems/${gemType}.json`);
      sheetCache[gemType] = sheet;
    }
    const frames = sheetCache[gemType].animations[gemType] || Object.values(sheetCache[gemType].textures);

    gemSpriteBottom.textures = frames; gemSpriteTop.textures = frames;
    gemSpriteBottom.play(); gemSpriteTop.play();
    
    gemSpriteBottom.alpha = 0; gemSpriteTop.alpha = 0;
    gemSpriteBottom.scale.set(0.04); gemSpriteTop.scale.set(0.04);
    isRevealingGem = true; gemAnimTime = 0;
  };

  // 🌟 判斷是否砸中寶石 (使用全螢幕正中央坐標)
  const isHittingGem = (x, y) => {
    if (!isRevealingGem || gemAnimTime < 10000 || gemAnimTime > 18000) return false;
    let dist = Math.hypot(x - (app.screen.width / 2), y - (app.screen.height / 2));
    return dist < 80; // 響應大螢幕，擴大判定範圍
  };

  const FPS = 30; 
  const RIPPLE_KEYFRAMES = [
    { id: 1, start: 0,  peak: 7,  end: 13 }, { id: 2, start: 3,  peak: 12, end: 22 },
    { id: 3, start: 6,  peak: 17, end: 29 }, { id: 4, start: 10, peak: 22, end: 34 },
    { id: 5, start: 14, peak: 26, end: 42 }, { id: 6, start: 19, peak: 32, end: 49 },
    { id: 7, start: 24, peak: 37, end: 55 }, { id: 8, start: 27, peak: 43, end: 74 }
  ];

  const addRipple = (x, y) => {
    if (isHittingGem(x, y)) {
      const numSplashes = Math.floor(Math.random() * 4) + 5; 
      for (let i = 0; i < numSplashes; i++) {
        const dot = new window.PIXI.Graphics();
        dot.beginFill(0xFFFFFF, 0.7 + Math.random() * 0.3); 
        dot.drawCircle(0, 0, Math.random() * 1.5 + 1.0); 
        dot.endFill();
        dot.x = x; dot.y = y;
        splashContainer.addChild(dot);
        activeSplashes.push({ sprite: dot, vx: (Math.random() - 0.5) * 8, vy: -(Math.random() * 5 + 3), life: 1.0 });
      }
      return; 
    }
    
    const dropContainer = new window.PIXI.Container();
    dropContainer.x = x; dropContainer.y = y;
    waterLayer.addChild(dropContainer);

    let maxDurationSeconds = 0;
    const randomScale = 0.1 + Math.random() * 0.15; // 為了大螢幕稍微放大水波

    RIPPLE_KEYFRAMES.forEach(data => {
      const textureName = `textImgLone_${data.id}`;
      const texture = rippleTextures[textureName];
      if (!texture) return; 

      const sprite = new window.PIXI.Sprite(texture);
      sprite.anchor.set(0.5); sprite.alpha = 0; sprite.scale.set(randomScale); 
      dropContainer.addChild(sprite);

      const startTime = data.start / FPS;
      const fadeInDur = (data.peak - data.start) / FPS;
      const fadeOutDur = (data.end - data.peak) / FPS;
      if (data.end / FPS > maxDurationSeconds) maxDurationSeconds = data.end / FPS;

      gsap.timeline({ delay: startTime })
        .to(sprite, { alpha: 1, duration: fadeInDur, ease: "none" })
        .to(sprite, { alpha: 0, duration: fadeOutDur, ease: "none" });
    });

    gsap.delayedCall(maxDurationSeconds + 0.1, () => {
      if (!dropContainer.destroyed) dropContainer.destroy({ children: true });
    });
  };

  return { 
    addRipple, revealGem, 
    updateWater: (delta, time) => {
      // 更新水花與寶石動畫 (邏輯不變，僅微調動畫基數以適應放大版)
      for (let i = activeSplashes.length - 1; i >= 0; i--) {
        let p = activeSplashes[i];
        p.vy += 0.4 * delta; p.sprite.x += p.vx * delta; p.sprite.y += p.vy * delta; 
        p.life -= (delta * 16.66) / 500.0; p.sprite.alpha = Math.max(0, p.life); 
        if (p.life <= 0) { splashContainer.removeChild(p.sprite); p.sprite.destroy(); activeSplashes.splice(i, 1); }
      }

      if (isRevealingGem) {
        gemAnimTime += delta * 16.66; 
        if (gemAnimTime <= 15000) {
            let progress = Math.min(gemAnimTime / GEM_REVEAL_DURATION, 1.0); 
            let easeP = progress * progress; 
            let currentScale = 0.04 + (easeP * 0.04);
            let crossfadeP = gemAnimTime > 10000 ? Math.min((gemAnimTime - 10000) / 1000.0, 1.0) : 0;
            gemSpriteBottom.scale.set(currentScale); gemSpriteTop.scale.set(currentScale);
            gemSpriteBottom.alpha = easeP * (1.0 - crossfadeP); gemSpriteTop.alpha = easeP * crossfadeP;            
        } else {
            let fadeP = (gemAnimTime - 15000) / 3000.0; 
            gemSpriteTop.alpha = Math.max(1.0 - fadeP, 0); gemSpriteBottom.alpha = 0; 
            if (fadeP >= 1.0) { isRevealingGem = false; gemSpriteBottom.stop(); gemSpriteTop.stop(); }
        }
      }
    }
  };
}