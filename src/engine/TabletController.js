// src/engine/TabletController.js
import { gsap } from 'gsap'; 

export function setupTablet(app, onSettlement) {
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
    sprite.x = app.screen.width / 2; 
    sprite.y = app.screen.height / 2; 
    sprite.alpha = 0; 
    sprite.scale.set(0.04); 
    parent.addChild(sprite);
  };

  initGemSprite(gemSpriteBottom, waterLayer); 
  initGemSprite(gemSpriteTop, container);     

  const splashContainer = new window.PIXI.Container();
  container.addChild(splashContainer);
  let activeSplashes = []; 
  const sheetCache = {};

  // 🌟 新增：寶石狀態機與計時器
  let phase = 'IDLE';
  let timer = 0;
  let isMonitorDone = false;
  let activeRipples = 0; // 追蹤畫面上還有沒有水波

  const monitorFinished = () => { isMonitorDone = true; };

  const revealGem = async (gemType) => {
    if (!sheetCache[gemType]) {
      const sheet = await window.PIXI.Assets.load(`/gems/${gemType}.json`);
      sheetCache[gemType] = sheet;
    }
    const frames = sheetCache[gemType].animations[gemType] || Object.values(sheetCache[gemType].textures);

    gemSpriteBottom.textures = frames; gemSpriteTop.textures = frames;
    gemSpriteBottom.play(); gemSpriteTop.play();
    
    gemSpriteBottom.alpha = 0; gemSpriteTop.alpha = 0;
    gemSpriteBottom.scale.set(0.04); gemSpriteTop.scale.set(0.04);
    
    // 初始化狀態機
    phase = 'DELAY';
    timer = 0;
    isMonitorDone = false;
  };

  // 🌟 修正：碰撞判定邏輯配合狀態機
  const isHittingGem = (x, y) => {
    if (phase === 'IDLE' || phase === 'DELAY' || phase === 'FADE_OUT') return false;
    if (phase === 'FADE_IN' && timer < 3000) return false; // 剛開始淡入時還太小不能砸
    let dist = Math.hypot(x - (app.screen.width / 2), y - (app.screen.height / 2));
    return dist < 80; 
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
    
    activeRipples++; // 🌟 產生一個水波，計數器 +1
    
    const dropContainer = new window.PIXI.Container();
    dropContainer.x = x; dropContainer.y = y;
    waterLayer.addChild(dropContainer);

    let maxDurationSeconds = 0;
    const randomScale = 0.1 + Math.random() * 0.15; 

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
      activeRipples--; // 🌟 水波結束，計數器 -1
    });
  };

  return { 
    addRipple, revealGem, monitorFinished,
    updateWater: (delta, time) => {
      // 🌟 核心修正：每一幀強制把視覺寶石鎖死在螢幕正中央 (無論螢幕怎麼縮放)
      gemSpriteBottom.x = app.screen.width / 2;
      gemSpriteBottom.y = app.screen.height / 2;
      gemSpriteTop.x = app.screen.width / 2;
      gemSpriteTop.y = app.screen.height / 2;

      for (let i = activeSplashes.length - 1; i >= 0; i--) {
        let p = activeSplashes[i];
        p.vy += 0.4 * delta; p.sprite.x += p.vx * delta; p.sprite.y += p.vy * delta; 
        p.life -= (delta * 16.66) / 500.0; p.sprite.alpha = Math.max(0, p.life); 
        if (p.life <= 0) { splashContainer.removeChild(p.sprite); p.sprite.destroy(); activeSplashes.splice(i, 1); }
      }

      // 🌟 嚴謹的寶石生命週期狀態機
      if (phase !== 'IDLE') {
        timer += delta * 16.66; 
        
        if (phase === 'DELAY') {
          // 1. 等待 5 秒 (15秒流淚時間的 1/3)
          if (timer >= 5000) { phase = 'FADE_IN'; timer = 0; }
        } 
        else if (phase === 'FADE_IN') {
          // 2. 寶石浮出水面，過程持續 10 秒
          let progress = Math.min(timer / 10000, 1.0); 
          let easeP = progress * progress; 
          let currentScale = 0.04 + (easeP * 0.04);
          let crossfadeP = timer > 5000 ? Math.min((timer - 5000) / 5000.0, 1.0) : 0;
          
          gemSpriteBottom.scale.set(currentScale); gemSpriteTop.scale.set(currentScale);
          gemSpriteBottom.alpha = easeP * (1.0 - crossfadeP); gemSpriteTop.alpha = easeP * crossfadeP;            
          
          if (progress >= 1.0) { phase = 'WAIT_MONITOR'; }
        }
        else if (phase === 'WAIT_MONITOR') {
          // 3. 確保大螢幕已經發送了掉落完畢的訊號
          if (isMonitorDone) { phase = 'WAIT_RIPPLES'; }
        }
        else if (phase === 'WAIT_RIPPLES') {
          // 4. 等待平板畫面上最後一滴水波跟水花都消失乾淨
          if (activeSplashes.length === 0 && activeRipples === 0) {
            phase = 'SETTLEMENT_DELAY';
            timer = 0;
          }
        }
        else if (phase === 'SETTLEMENT_DELAY') {
          // 5. 畫面淨空後，讓寶石完美閃耀停留 1.5 秒
          if (timer >= 1500) { phase = 'FADE_OUT'; timer = 0; }
        }
        else if (phase === 'FADE_OUT') {
          // 6. 寶石花 1.5 秒漸隱淡出
          let fadeP = Math.min(timer / 1500.0, 1.0); 
          gemSpriteTop.alpha = Math.max(1.0 - fadeP, 0); 
          gemSpriteBottom.alpha = 0; 
          if (fadeP >= 1.0) { 
            // 7. 動畫徹底結束，通知 React 叫出結算介面
            phase = 'IDLE'; 
            gemSpriteBottom.stop(); gemSpriteTop.stop(); 
            if (onSettlement) onSettlement(); 
          }
        }
      }
    }
  };
}