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
    // 退回舊版：完全死守平板螢幕的正中央，不加偏移量
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
  
  let activeRipplesList = []; 
  const sheetCache = {};

  let phase = 'IDLE';
  let timer = 0;
  let isMonitorDone = false;

  const monitorFinished = () => { isMonitorDone = true; };

  const revealGem = async (gemType) => {
    if (!sheetCache[gemType]) {
      const sheet = await window.PIXI.Assets.load(`/gems/${gemType}.json`);
      sheetCache[gemType] = sheet;
    }
    const frames = sheetCache[gemType].animations[gemType] || Object.values(sheetCache[gemType].textures);

    gemSpriteBottom.textures = frames; gemSpriteTop.textures = frames;
    gemSpriteBottom.anchor.set(0.5); gemSpriteTop.anchor.set(0.5);
    gemSpriteBottom.play(); gemSpriteTop.play();
    
    gemSpriteBottom.alpha = 0; gemSpriteTop.alpha = 0;
    gemSpriteBottom.scale.set(0.04); gemSpriteTop.scale.set(0.04);
    
    phase = 'DELAY';
    timer = 0;
    isMonitorDone = false;
    activeRipplesList = []; // 重置水波計數
  };

  // 🌟 碰撞判定範圍與寶石圖片中心完全一致
  const isHittingGem = (x, y) => {
    if (phase === 'IDLE' || phase === 'DELAY' || phase === 'FADE_OUT') return false;
    if (phase === 'FADE_IN' && timer < 3000) return false; 
    
    // 依據螢幕正中央進行距離判定
    let dist = Math.hypot(x - (app.screen.width / 2), y - (app.screen.height / 2));
    
    // 將碰撞半徑放大至 180，確保高解析度螢幕也能準確砸出水花
    return dist < 180; 
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
    
    // 在引擎層面紀錄這個水波紋的精確壽命 (最大影格 74 / 30fps = 2460ms)
    activeRipplesList.push({ timer: 2460 }); 
    
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
    });
  };

  return { 
    addRipple, revealGem, monitorFinished,
    updateWater: (delta, time) => {
      // 每一幀死守螢幕正中央
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height / 2;
      
      gemSpriteBottom.x = centerX;
      gemSpriteBottom.y = centerY;
      gemSpriteTop.x = centerX;
      gemSpriteTop.y = centerY;

      // 1. 更新小水花物理
      for (let i = activeSplashes.length - 1; i >= 0; i--) {
        let p = activeSplashes[i];
        p.vy += 0.4 * delta; p.sprite.x += p.vx * delta; p.sprite.y += p.vy * delta; 
        p.life -= (delta * 16.66) / 500.0; p.sprite.alpha = Math.max(0, p.life); 
        if (p.life <= 0) { splashContainer.removeChild(p.sprite); p.sprite.destroy(); activeSplashes.splice(i, 1); }
      }

      // 2. 更新圈狀水波紋的生命倒數
      for (let i = activeRipplesList.length - 1; i >= 0; i--) {
        activeRipplesList[i].timer -= delta * 16.66;
        if (activeRipplesList[i].timer <= 0) activeRipplesList.splice(i, 1);
      }

      // 3. 全新防彈級時間軸狀態機
      if (phase !== 'IDLE') {
        timer += delta * 16.66; 
        
        if (phase === 'DELAY') {
          // (1) 等待 5 秒 (流淚 1/3)
          if (timer >= 5000) { phase = 'FADE_IN'; timer = 0; }
        } 
        else if (phase === 'FADE_IN') {
          // (2) 寶石淡入浮現
          let progress = Math.min(timer / 10000, 1.0); 
          let easeP = progress * progress; 
          let currentScale = 0.04 + (easeP * 0.04);
          let crossfadeP = timer > 5000 ? Math.min((timer - 5000) / 5000.0, 1.0) : 0;
          
          gemSpriteBottom.scale.set(currentScale); gemSpriteTop.scale.set(currentScale);
          gemSpriteBottom.alpha = easeP * (1.0 - crossfadeP); gemSpriteTop.alpha = easeP * crossfadeP;            
          
          if (progress >= 1.0) { phase = 'WAIT_MONITOR'; }
        }
        else if (phase === 'WAIT_MONITOR') {
          // (3) 確認顯示器「流淚完畢」且畫面上 0 個眼淚
          if (isMonitorDone) { phase = 'WAIT_RIPPLES'; }
        }
        else if (phase === 'WAIT_RIPPLES') {
          // (4) 確認平板上「沒有任何水波紋或水花」
          if (activeSplashes.length === 0 && activeRipplesList.length === 0) {
            phase = 'SETTLEMENT_DELAY';
            timer = 0;
          }
        }
        else if (phase === 'SETTLEMENT_DELAY') {
          // ⚠️ 防呆攔截：如果這 1.5 秒內網路延遲又噴出水花或水波，立刻退回上一步重新等待清空！
          if (activeSplashes.length > 0 || activeRipplesList.length > 0) {
            phase = 'WAIT_RIPPLES';
          } 
          // (5) 畫面淨空停留 1.5 秒
          else if (timer >= 1500) { 
            phase = 'FADE_OUT'; 
            timer = 0; 
          }
        }
        else if (phase === 'FADE_OUT') {
          // (6) 寶石開始淡出，耗時 1.5 秒
          let fadeP = Math.min(timer / 1500.0, 1.0); 
          gemSpriteTop.alpha = Math.max(1.0 - fadeP, 0); 
          gemSpriteBottom.alpha = 0; 
          
          if (fadeP >= 1.0) { 
            phase = 'IDLE'; 
            gemSpriteBottom.stop(); gemSpriteTop.stop(); 
            // (7) 叫出結算畫面
            if (onSettlement) onSettlement(); 
          }
        }
      }
    }
  };
}