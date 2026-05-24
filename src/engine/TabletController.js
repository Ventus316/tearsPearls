// src/engine/TabletController.js
import { gsap } from 'gsap'; 
import { WORDS } from '../config/constants';

/**
 * 平板視覺控制器 (Tablet Controller)
 * 負責：動態載入水波紋素材、GSAP 水波紋動畫生成、粒子水花物理、以及結算動畫狀態機。
 */
export function setupTablet(app, onSettlement) {
  const container = new window.PIXI.Container();
  app.stage.addChild(container);

  // 紋理字典，結構為 { fallback: { "1": Texture, ... }, "孤單": { "1": Texture, ... } }
  const rippleTextures = { fallback: {} };

  // ==========================================
  // 1. 載入通用的「預設水波紋」(Fallback Textures)
  // 確保若缺少特定詞彙素材時，系統能自動降級渲染而不崩潰。
  // ==========================================
  fetch('/textImg/textImgLone.json').then(res => res.json()).then(async jsonData => {
    const baseTexture = await window.PIXI.Assets.load('/textImg/textImgLone.png');
    rippleTextures['fallback'] = {};
    jsonData.forEach(data => {
      const rect = new window.PIXI.Rectangle(data.x, data.y, data.width, data.height);
      // 自動擷取檔名尾部的數字作為 Frame ID (例如 "textImgLone_1" -> "1")
      const frameId = data.name.split('_').pop(); 
      rippleTextures['fallback'][frameId] = new window.PIXI.Texture(baseTexture, rect);
    });
  }).catch(e => console.warn("Fallback ripple missing:", e));

  // ==========================================
  // 2. 動態載入 20 個詞彙的專屬水波紋
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
        const frameId = data.name.split('_').pop();
        rippleTextures[word][frameId] = new window.PIXI.Texture(baseTexture, rect);
      });
    }).catch(() => { /* 若素材尚未補齊則靜默忽略，交由 Fallback 處理 */ });
  });

  const waterLayer = new window.PIXI.Container();
  container.addChild(waterLayer);

  // 寶石圖層 (分底層與頂層，以利處理淡入淡出的交疊特效)
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

  // 動畫狀態機變數
  let phase = 'IDLE';
  let timer = 0;
  let isMonitorDone = false;

  const monitorFinished = () => { isMonitorDone = true; };

  /**
   * 載入並啟動寶石顯影程序
   */
  const revealGem = async (gemType) => {
    if (!sheetCache[gemType]) {
      const sheet = await window.PIXI.Assets.load(`/gems/${gemType}.json`);
      sheetCache[gemType] = sheet;
    }
    const frames = sheetCache[gemType].animations[gemType] || Object.values(sheetCache[gemType].textures);

    gemSpriteBottom.textures = frames; 
    gemSpriteTop.textures = frames;
    gemSpriteBottom.anchor.set(0.5); 
    gemSpriteTop.anchor.set(0.5);

    // ==========================================
    // 🌟 寶石旋轉速度控制核心
    // ==========================================
    // 參數設定：你希望寶石「轉完整整一圈」需要花幾秒？
    const secondsPerRotation = 2.0; // 假設設定轉一圈 2 秒 (數字越大轉越慢)
    
    // 計算公式：瀏覽器預設每秒跑 60 幀。
    // (圖片總張數) / (60幀 * 你要的秒數) = PIXI 需要的 animationSpeed
    const calculatedSpeed = frames.length / (60 * secondsPerRotation);
    
    // 套用計算出來的播放速度
    gemSpriteBottom.animationSpeed = calculatedSpeed;
    gemSpriteTop.animationSpeed = calculatedSpeed;
    // ==========================================

    gemSpriteBottom.play(); 
    gemSpriteTop.play();
    
    gemSpriteBottom.alpha = 0; 
    gemSpriteTop.alpha = 0;
    gemSpriteBottom.scale.set(0.04); 
    gemSpriteTop.scale.set(0.04);
    
    phase = 'DELAY';
    timer = 0;
    isMonitorDone = false;
    activeRipplesList = []; 
  };

  /**
   * 檢查掉落物是否擊中顯影中的寶石範圍
   */
  const isHittingGem = (x, y) => {
    if (phase === 'IDLE' || phase === 'DELAY' || phase === 'FADE_OUT') return false;
    if (phase === 'FADE_IN' && timer < 3000) return false; 
    let dist = Math.hypot(x - (app.screen.width / 2), y - (app.screen.height / 2));
    return dist < 30; 
  };

  const FPS = 30; 
  // 水波紋 8 幀關鍵影格時間軸 (start, peak, end)
  const RIPPLE_KEYFRAMES = [
    { id: 1, start: 0,  peak: 7,  end: 13 }, { id: 2, start: 3,  peak: 12, end: 22 },
    { id: 3, start: 6,  peak: 17, end: 29 }, { id: 4, start: 10, peak: 22, end: 34 },
    { id: 5, start: 14, peak: 26, end: 42 }, { id: 6, start: 19, peak: 32, end: 49 },
    { id: 7, start: 24, peak: 37, end: 55 }, { id: 8, start: 27, peak: 43, end: 74 }
  ];

  /**
   * 在指定座標生成水波紋或水花碰撞特效
   */
  const addRipple = (x, y, char) => {
    // 若擊中寶石，則改為生成飛濺水花粒子
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
    
    // 記錄水波存活時間 (用於狀態機判斷水面是否平靜)
    activeRipplesList.push({ timer: 2460 }); 
    
    const dropContainer = new window.PIXI.Container();
    dropContainer.x = x; dropContainer.y = y;
    waterLayer.addChild(dropContainer);

    let maxDurationSeconds = 0;
    const randomScale = 0.1 + Math.random() * 0.15; 

    // 使用 GSAP 依序播放 8 張序列圖，製造水波擴散感
    RIPPLE_KEYFRAMES.forEach(data => {
      const frameId = String(data.id); 
      let texture = rippleTextures[char]?.[frameId];
      if (!texture) texture = rippleTextures['fallback']?.[frameId]; // 容錯降級機制
      if (!texture) return; 

      const sprite = new window.PIXI.Sprite(texture);
      sprite.anchor.set(0.5); 
      sprite.alpha = 0; 
      sprite.scale.set(randomScale); 
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
    addRipple, 
    revealGem, 
    monitorFinished,
    updateWater: (delta, time) => {
      // 確保寶石永遠置中
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height / 2;
      gemSpriteBottom.position.set(centerX, centerY);
      gemSpriteTop.position.set(centerX, centerY);

      // 更新飛濺水花的重力與透明度
      for (let i = activeSplashes.length - 1; i >= 0; i--) {
        let p = activeSplashes[i];
        p.vy += 0.4 * delta; 
        p.sprite.x += p.vx * delta; 
        p.sprite.y += p.vy * delta; 
        p.life -= (delta * 16.66) / 500.0; 
        p.sprite.alpha = Math.max(0, p.life); 
        if (p.life <= 0) { 
          splashContainer.removeChild(p.sprite); 
          p.sprite.destroy(); 
          activeSplashes.splice(i, 1); 
        }
      }

      // 更新水波紋的存活計時器
      for (let i = activeRipplesList.length - 1; i >= 0; i--) {
        activeRipplesList[i].timer -= delta * 16.66;
        if (activeRipplesList[i].timer <= 0) activeRipplesList.splice(i, 1);
      }

      // ==========================================
      // 動畫狀態機 (Animation State Machine)
      // 控制寶石從顯影、變大、等待水面平靜、到最終淡出的完整生命週期
      // ==========================================
      if (phase !== 'IDLE') {
        timer += delta * 16.66; 
        
        if (phase === 'DELAY') {
          if (timer >= 5000) { phase = 'FADE_IN'; timer = 0; }
        } 
        else if (phase === 'FADE_IN') {
          let progress = Math.min(timer / 10000, 1.0); 
          let easeP = progress * progress; 
          let currentScale = 0.04 + (easeP * 0.2);
          let crossfadeP = timer > 5000 ? Math.min((timer - 5000) / 5000.0, 1.0) : 0;
          
          gemSpriteBottom.scale.set(currentScale); 
          gemSpriteTop.scale.set(currentScale);
          gemSpriteBottom.alpha = easeP * (1.0 - crossfadeP); 
          gemSpriteTop.alpha = easeP * crossfadeP;            
          
          if (progress >= 1.0) phase = 'WAIT_MONITOR'; 
        }
        else if (phase === 'WAIT_MONITOR') {
          if (isMonitorDone) phase = 'WAIT_RIPPLES'; 
        }
        else if (phase === 'WAIT_RIPPLES') {
          // 確保畫面淨空：所有水波紋與水花皆已消散
          if (activeSplashes.length === 0 && activeRipplesList.length === 0) {
            phase = 'SETTLEMENT_DELAY';
            timer = 0;
          }
        }
        else if (phase === 'SETTLEMENT_DELAY') {
          // 防呆機制：若倒數期間因網路延遲又產生水波，則退回上一步等待
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
            gemSpriteBottom.stop(); 
            gemSpriteTop.stop(); 
            if (onSettlement) onSettlement(); // 觸發 React 切換結算 UI
          }
        }
      }
    }
  };
}