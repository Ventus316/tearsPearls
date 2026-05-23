// src/engine/TabletController.js
import { gsap } from 'gsap'; 
import { WORDS } from '../config/constants'; // 🌟 引入 20 個詞庫

export function setupTablet(app, onSettlement) {
  const container = new window.PIXI.Container();
  app.stage.addChild(container);

  // 🌟 將 rippleTextures 改為兩層的字典結構
  const rippleTextures = { fallback: {} };

  // ==========================================
  // 1. 載入通用的「預設水波紋」(Fallback)
  // ==========================================
  fetch('/textImg/textImgLone.json').then(res => res.json()).then(async jsonData => {
    const baseTexture = await window.PIXI.Assets.load('/textImg/textImgLone.png');
    rippleTextures['fallback'] = {};
    jsonData.forEach(data => {
      const rect = new window.PIXI.Rectangle(data.x, data.y, data.width, data.height);
      
      // 🌟 神奇魔法：從 "textImgLone_1" 裡面自動切出 "1"
      // 就算設計師只寫 "1"，或是寫 "孤單_1"，這個寫法都能精準抓到數字！
      const frameId = data.name.split('_').pop(); 
      
      rippleTextures['fallback'][frameId] = new window.PIXI.Texture(baseTexture, rect);
    });
  }).catch(e => console.warn("Fallback ripple missing:", e));


  // ==========================================
  // 2. 動態背景載入 20 個詞彙的專屬水波紋
  // ==========================================
  WORDS.forEach(word => {
    fetch(`/textImg/${word}.json`).then(res => {
      if (!res.ok) throw new Error(`Missing ${word}.json`);
      return res.json();
    }).then(async jsonData => {
      const baseTexture = await window.PIXI.Assets.load(`/textImg/${word}.png`);
      rippleTextures[word] = {};
      jsonData.forEach(data => {
        const rect = new window.PIXI.Rectangle(data.x, data.y, data.width, data.height);
        
        // 🌟 神奇魔法：不管 JSON 裡面叫什麼，都切出最後的數字 (例如 "孤單_1" -> "1")
        const frameId = data.name.split('_').pop();
        
        rippleTextures[word][frameId] = new window.PIXI.Texture(baseTexture, rect);
      });
    }).catch(() => { /* 靜默忽略，因為素材還沒齊全很正常 */ });
  });


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
    activeRipplesList = []; 
  };

  const isHittingGem = (x, y) => {
    if (phase === 'IDLE' || phase === 'DELAY' || phase === 'FADE_OUT') return false;
    if (phase === 'FADE_IN' && timer < 3000) return false; 
    let dist = Math.hypot(x - (app.screen.width / 2), y - (app.screen.height / 2));
    return dist < 180; 
  };

  const FPS = 30; 
  const RIPPLE_KEYFRAMES = [
    { id: 1, start: 0,  peak: 7,  end: 13 }, { id: 2, start: 3,  peak: 12, end: 22 },
    { id: 3, start: 6,  peak: 17, end: 29 }, { id: 4, start: 10, peak: 22, end: 34 },
    { id: 5, start: 14, peak: 26, end: 42 }, { id: 6, start: 19, peak: 32, end: 49 },
    { id: 7, start: 24, peak: 37, end: 55 }, { id: 8, start: 27, peak: 43, end: 74 }
  ];

  const addRipple = (x, y, char) => {
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
    
    activeRipplesList.push({ timer: 2460 }); 
    
    const dropContainer = new window.PIXI.Container();
    dropContainer.x = x; dropContainer.y = y;
    waterLayer.addChild(dropContainer);

    let maxDurationSeconds = 0;
    const randomScale = 0.1 + Math.random() * 0.15; 

    RIPPLE_KEYFRAMES.forEach(data => {
      // 🌟 現在這裡非常乾淨，只需要直接用 1, 2, 3 來呼叫
      const frameId = String(data.id); 
      
      let texture = rippleTextures[char]?.[frameId];

      if (!texture) {
        texture = rippleTextures['fallback']?.[frameId];
      }

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
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height / 2;
      
      gemSpriteBottom.x = centerX;
      gemSpriteBottom.y = centerY;
      gemSpriteTop.x = centerX;
      gemSpriteTop.y = centerY;

      for (let i = activeSplashes.length - 1; i >= 0; i--) {
        let p = activeSplashes[i];
        p.vy += 0.4 * delta; p.sprite.x += p.vx * delta; p.sprite.y += p.vy * delta; 
        p.life -= (delta * 16.66) / 500.0; p.sprite.alpha = Math.max(0, p.life); 
        if (p.life <= 0) { splashContainer.removeChild(p.sprite); p.sprite.destroy(); activeSplashes.splice(i, 1); }
      }

      for (let i = activeRipplesList.length - 1; i >= 0; i--) {
        activeRipplesList[i].timer -= delta * 16.66;
        if (activeRipplesList[i].timer <= 0) activeRipplesList.splice(i, 1);
      }

      if (phase !== 'IDLE') {
        timer += delta * 16.66; 
        
        if (phase === 'DELAY') {
          if (timer >= 5000) { phase = 'FADE_IN'; timer = 0; }
        } 
        else if (phase === 'FADE_IN') {
          let progress = Math.min(timer / 10000, 1.0); 
          let easeP = progress * progress; 
          let currentScale = 0.04 + (easeP * 0.04);
          let crossfadeP = timer > 5000 ? Math.min((timer - 5000) / 5000.0, 1.0) : 0;
          
          gemSpriteBottom.scale.set(currentScale); gemSpriteTop.scale.set(currentScale);
          gemSpriteBottom.alpha = easeP * (1.0 - crossfadeP); gemSpriteTop.alpha = easeP * crossfadeP;            
          
          if (progress >= 1.0) { phase = 'WAIT_MONITOR'; }
        }
        else if (phase === 'WAIT_MONITOR') {
          if (isMonitorDone) { phase = 'WAIT_RIPPLES'; }
        }
        else if (phase === 'WAIT_RIPPLES') {
          if (activeSplashes.length === 0 && activeRipplesList.length === 0) {
            phase = 'SETTLEMENT_DELAY';
            timer = 0;
          }
        }
        else if (phase === 'SETTLEMENT_DELAY') {
          if (activeSplashes.length > 0 || activeRipplesList.length > 0) {
            phase = 'WAIT_RIPPLES';
          } 
          else if (timer >= 1500) { 
            phase = 'FADE_OUT'; 
            timer = 0; 
          }
        }
        else if (phase === 'FADE_OUT') {
          let fadeP = Math.min(timer / 1500.0, 1.0); 
          gemSpriteTop.alpha = Math.max(1.0 - fadeP, 0); 
          gemSpriteBottom.alpha = 0; 
          
          if (fadeP >= 1.0) { 
            phase = 'IDLE'; 
            gemSpriteBottom.stop(); gemSpriteTop.stop(); 
            if (onSettlement) onSettlement(); 
          }
        }
      }
    }
  };
}