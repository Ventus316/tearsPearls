// src/engine/TabletController.js
import { gsap } from 'gsap'; 
import { 
  WORDS, 
  GEM_ROTATION_SPEEDS, 
  GEM_INITIAL_SCALE, 
  GEM_FINAL_SCALE, 
  GEM_HITBOX_RADIUS,
  GEM_MASK_WIDTH, 
  GEM_MASK_HEIGHT,
  GEM_BOTTOM_ALPHA,
  RIPPLE_BASE_SCALE,
  RIPPLE_RANDOM_SCALE,
  REWIND_STAGGER_GAP,
  REWIND_TEXT_SPEED,
  REWIND_PARTICLE_DUR,
  DELAY_BEFORE_GEM_REVEAL,
  GEM_REVEAL_DURATION,
  DELAY_BEFORE_SETTLEMENT,
  GEM_FADE_OUT_DURATION
} from '../config/constants';

/**
 * 平板視覺控制器 (Tablet Controller)
 * 負責：動態載入水波紋素材、GSAP 水波紋動畫生成、粒子水花物理、以及結算動畫狀態機。
 */
export function setupTablet(app, onSettlement, onPlaySound) {
  const container = new window.PIXI.Container();
  app.stage.addChild(container);

  // 紋理字典，結構為 { fallback: { "1": Texture, ... }, "孤單": { "1": Texture, ... } }
  const rippleTextures = { fallback: {} };
  let rippleHistory = [];

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
      const frameId = String(parseInt(data.name.split('_').pop(), 10));
      rippleTextures['fallback'][frameId] = new window.PIXI.Texture(baseTexture, rect);
    });
  }).catch(e => console.warn("Fallback ripple missing:", e));

  // ==========================================
  // 2. 動態載入 20 個詞彙的專屬水波紋
  // ==========================================
  WORDS.forEach(word => {
    // 🌟 加入 URL 安全編碼，防止中文檔名讀取失敗
    const encodedWord = encodeURIComponent(word);

    fetch(`/textImg/${encodedWord}.json`).then(res => {
      if (!res.ok) throw new Error(`Missing ${word}.json`);
      return res.json();
    }).then(async jsonData => {
      const baseTexture = await window.PIXI.Assets.load(`/textImg/${encodedWord}.png`);
      rippleTextures[word] = {};
      jsonData.forEach(data => {
        const rect = new window.PIXI.Rectangle(data.x, data.y, data.width, data.height);
        const frameId = String(parseInt(data.name.split('_').pop(), 10));
        rippleTextures[word][frameId] = new window.PIXI.Texture(baseTexture, rect);
      });
    }).catch((err) => { 
      // 🌟 把錯誤印出來，如果真的讀不到圖，按 F12 就能立刻知道是哪個字漏了
      console.warn(`[水波紋警告] 無法載入 ${word}:`, err); 
    });
  });

  const waterLayer = new window.PIXI.Container();
  container.addChild(waterLayer);

  // 寶石圖層 (分底層與頂層，以利處理淡入淡出的交疊特效)
  let gemSpriteBottom = new window.PIXI.AnimatedSprite([window.PIXI.Texture.EMPTY]);
  let gemSpriteTop = new window.PIXI.AnimatedSprite([window.PIXI.Texture.EMPTY]);

  // 🌟 新增：寶石動態矩形遮罩 (實作由下往上顯影)
  const gemMask = new window.PIXI.Graphics();
  container.addChild(gemMask); // 加入畫布中才能生效

  const initGemSprite = (sprite, parent) => {
    sprite.anchor.set(0.5); 
    sprite.x = app.screen.width / 2; 
    sprite.y = app.screen.height / 2; 
    sprite.alpha = 0;
    sprite.scale.set(GEM_INITIAL_SCALE); 
    parent.addChild(sprite);
  };

  initGemSprite(gemSpriteBottom, waterLayer); 
  initGemSprite(gemSpriteTop, container);     

  // 🌟 新增：將遮罩綁定給頂層寶石
  gemSpriteTop.mask = gemMask;

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
    // 動態從 constants.js 讀取該寶石的專屬旋轉秒數 (若發生異常則 fallback 預設為 2.0 秒)
    const secondsPerRotation = GEM_ROTATION_SPEEDS[gemType] || 2.0; 
    
    // 計算公式：瀏覽器預設每秒跑 60 幀。
    // (圖片總張數) / (60幀 * 專屬秒數) = PIXI 需要的 animationSpeed
    const calculatedSpeed = frames.length / (60 * secondsPerRotation);
    
    // 套用計算出來的播放速度
    gemSpriteBottom.animationSpeed = calculatedSpeed;
    gemSpriteTop.animationSpeed = calculatedSpeed;
    // ==========================================

    gemSpriteBottom.play(); 
    gemSpriteTop.play();
    
    // 初始隱形，靜待時空回溯大集結
    gemSpriteBottom.alpha = 0; 
    gemSpriteTop.alpha = 0;
    
    // 🌟 修改：直接設定為最終完美大小，不需要再慢慢放大了！
    gemSpriteBottom.scale.set(GEM_FINAL_SCALE); 
    gemSpriteTop.scale.set(GEM_FINAL_SCALE);
    
    // 🌟 新增：重置遮罩 (清空矩形，讓寶石完全被隱藏)
    gemMask.clear();

    phase = 'DELAY';
    timer = 0;
    isMonitorDone = false;
    activeRipplesList = []; 
    rippleHistory = [];
  };

  /**
   * 檢查掉落物是否擊中顯影中的寶石範圍
   */
  const isHittingGem = (x, y) => {
    if (phase === 'IDLE' || phase === 'DELAY' || phase === 'FADE_OUT') return false;
    if (phase === 'FADE_IN' && timer < 3000) return false; 
    let dist = Math.hypot(x - (app.screen.width / 2), y - (app.screen.height / 2));
    return dist < GEM_HITBOX_RADIUS; 
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
    
    // ==========================================
    // 🌟 動態判斷水波大小與發送對應音效
    // ==========================================
    // 1. 先計算出這次水波紋的最終大小
    const randomScale = RIPPLE_BASE_SCALE + Math.random() * RIPPLE_RANDOM_SCALE;

    // 🌟 新增：將落點座標與當下算好的縮放比例打包存進歷史陣列
    rippleHistory.push({ x, y, scale: randomScale, word: char });
    console.log(`🧠 [記憶系統] 已記錄落點: (${x}, ${y})，字詞: ${char}，累計: ${rippleHistory.length}`);

    // 2. 利用常數將浮動範圍 (RIPPLE_RANDOM_SCALE) 切成三等分，求出兩個臨界值
    const tierSize = RIPPLE_RANDOM_SCALE / 3;
    const thresholdSmall = RIPPLE_BASE_SCALE + tierSize;       // 小與中的界線
    const thresholdMid = RIPPLE_BASE_SCALE + (tierSize * 2);   // 中與大的界線

    // 3. 判斷落點並發送對應音效名稱給大螢幕
    if (onPlaySound) {
      if (randomScale < thresholdSmall) {
        onPlaySound('drop_small');
      } else if (randomScale < thresholdMid) {
        onPlaySound('drop_mid');
      } else {
        onPlaySound('drop_large');
      }
    }

    // 記錄水波存活時間
    activeRipplesList.push({ timer: 2460 }); 
    
    const dropContainer = new window.PIXI.Container();
    dropContainer.x = x; dropContainer.y = y;
    waterLayer.addChild(dropContainer);

    let maxDurationSeconds = 0;

    // 使用 GSAP 依序播放 8 張序列圖 (原本在這裡算 scale，現在移到上面了)
    RIPPLE_KEYFRAMES.forEach(data => {
      const frameId = String(data.id); 
      let texture = rippleTextures[char]?.[frameId];
      if (!texture) texture = rippleTextures['fallback']?.[frameId]; 
      if (!texture) return; 

      const sprite = new window.PIXI.Sprite(texture);
      sprite.anchor.set(0.5); 
      sprite.alpha = 0; 
      sprite.scale.set(randomScale); // 🌟 套用剛剛算好的統一大小
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

// ==========================================================================
  // 🌟 新增：時空回溯 ── 文字坍縮與記憶粒子螺旋吸入核心 (步驟 3 & 4)
  // ==========================================================================
  const runTimeRewindAnimation = () => {
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2;

    if (rippleHistory.length === 0) {
      phase = 'FADE_IN';
      timer = 0;
      return;
    }

    let completedParticles = 0;
    const totalParticles = rippleHistory.length;
    const maxRippleDur = 74 / FPS; 

    rippleHistory.forEach((hist, index) => {
      // 🌟 套用常數：錯開時間差
      const staggerDelay = (totalParticles - 1 - index) * REWIND_STAGGER_GAP; 

      const dropContainer = new window.PIXI.Container();
      dropContainer.x = hist.x;
      dropContainer.y = hist.y;
      container.addChild(dropContainer);

      const particle = new window.PIXI.Graphics();
      particle.beginFill(0xFFFFFF, 1.0); 
      particle.drawCircle(0, 0, 4);
      particle.beginFill(0x94eaec, 0.4); 
      particle.drawCircle(0, 0, 13);
      particle.endFill();

      const blurFilter = new window.PIXI.filters.BlurFilter();
      blurFilter.blur = 5;
      particle.filters = [blurFilter];

      particle.x = hist.x;
      particle.y = hist.y;
      particle.alpha = 0;
      container.addChild(particle);

      const dx = hist.x - centerX;
      const dy = hist.y - centerY;
      const initialRadius = Math.hypot(dx, dy); 
      const initialAngle = Math.atan2(dy, dx);   
      const animationProps = { radius: initialRadius, angleOffset: 0 };

      const tl = gsap.timeline({
        delay: staggerDelay,
        onComplete: () => {
          dropContainer.destroy({ children: true }); 
          particle.destroy();                        
          completedParticles++;
          
          if (completedParticles === totalParticles) {
            // 🌟 套用常數：粒子吸完後的呼吸間隔
            setTimeout(() => {
              phase = 'FADE_IN'; 
              timer = 0;
            }, DELAY_BEFORE_GEM_REVEAL); 
          }
        }
      });

      // 🎬 階段 A：文字圖片逆向坍縮倒放
      RIPPLE_KEYFRAMES.forEach(data => {
        const frameId = String(data.id);
        let texture = rippleTextures[hist.word]?.[frameId] || rippleTextures['fallback']?.[frameId];
        if (!texture) return;

        const sprite = new window.PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.alpha = 0;
        sprite.scale.set(hist.scale); 
        dropContainer.addChild(sprite);

        // 🌟 套用常數：文字坍縮速度
        const revStart = (maxRippleDur - (data.end / FPS)) / REWIND_TEXT_SPEED;
        const revPeak = (maxRippleDur - (data.peak / FPS)) / REWIND_TEXT_SPEED;
        const revEnd = (maxRippleDur - (data.start / FPS)) / REWIND_TEXT_SPEED;
        
        const fadeInDur = revPeak - revStart;
        const fadeOutDur = revEnd - revPeak;

        tl.to(sprite, { alpha: 1, duration: fadeInDur, ease: "none" }, revStart)
          .to(sprite, { alpha: 0, duration: fadeOutDur, ease: "none" }, revPeak);
      });

      // 🎬 階段 B：光點螺旋吸入
      const particleStart = (maxRippleDur - (7 / FPS)) / REWIND_TEXT_SPEED; 

      tl.to(particle, { alpha: 1, duration: 0.2, ease: "none" }, particleStart)
        .to(animationProps, {
          radius: 0,
          angleOffset: 2.2, 
          // 🌟 套用常數：粒子吸入時間
          duration: REWIND_PARTICLE_DUR,  
          ease: "power2.in", 
          onUpdate: () => {
            const currentAngle = initialAngle + animationProps.angleOffset;
            particle.x = centerX + Math.cos(currentAngle) * animationProps.radius;
            particle.y = centerY + Math.sin(currentAngle) * animationProps.radius;
          }
        }, particleStart)
        // 🌟 套用常數：粒子吸入時間
        .to(particle, { scaleX: 0.1, scaleY: 0.1, duration: REWIND_PARTICLE_DUR, ease: "power2.in" }, particleStart);
    });
  };

  return { 
    addRipple, 
    revealGem, 
    monitorFinished,
    updateWater: (delta, time) => {
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height / 2;
      gemSpriteBottom.position.set(centerX, centerY);
      gemSpriteTop.position.set(centerX, centerY);

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

      for (let i = activeRipplesList.length - 1; i >= 0; i--) {
        activeRipplesList[i].timer -= delta * 16.66;
        if (activeRipplesList[i].timer <= 0) activeRipplesList.splice(i, 1);
      }

      if (phase !== 'IDLE') {
        timer += delta * 16.66; 
        
      if (phase === 'DELAY') {
          if (isMonitorDone && activeRipplesList.length === 0) { 
            phase = 'PHASE_REWIND'; 
            timer = 0;
            runTimeRewindAnimation(); 
          }
        } 
        else if (phase === 'PHASE_REWIND') {
          // 等待粒子動畫完成，由 GSAP 的 setTimeout 切換至 FADE_IN
        }
        else if (phase === 'FADE_IN') {
          let progress = Math.min(timer / GEM_REVEAL_DURATION, 1.0); 
          
          // 🌟 套用常數：遮罩寬高
          const maskW = GEM_MASK_WIDTH;
          const maskH = GEM_MASK_HEIGHT;
          
          const revealHeight = maskH * progress; 

          gemMask.clear();
          gemMask.beginFill(0xffffff);
          gemMask.drawRect(
            centerX - maskW / 2, 
            centerY + maskH / 2 - revealHeight, 
            maskW, 
            revealHeight
          );
          gemMask.endFill();

          // 🌟 套用常數：底層全息氛圍亮度
          gemSpriteBottom.alpha = progress * GEM_BOTTOM_ALPHA; 
          gemSpriteTop.alpha = Math.min(progress * 2, 1.0);            
          
          if (progress >= 1.0) phase = 'WAIT_MONITOR'; 
        }
        else if (phase === 'WAIT_MONITOR') {
          if (isMonitorDone) phase = 'WAIT_RIPPLES'; 
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
          // 🌟 套用常數：結算畫面停留間隔
          else if (timer >= DELAY_BEFORE_SETTLEMENT) { 
            phase = 'FADE_OUT'; 
            timer = 0; 
          }
        }
        else if (phase === 'FADE_OUT') {
          // 🌟 套用常數：寶石淡出時間
          let fadeP = Math.min(timer / GEM_FADE_OUT_DURATION, 1.0); 
          gemSpriteTop.alpha = Math.max(1.0 - fadeP, 0); 
          gemSpriteBottom.alpha = 0; 
          
          if (fadeP >= 1.0) { 
            phase = 'IDLE'; 
            gemSpriteBottom.stop(); 
            gemSpriteTop.stop(); 
            if (onSettlement) onSettlement(); 
          }
        }
      }
    }
  };
}