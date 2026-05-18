// src/engine/TabletController.js
import { TABLET_START_Y, TABLET_H } from '../config/constants';
// import { rippleFragSource } from './ripple/RippleFilter';
// import { rippleFragSource } from './ripple/RippleFilter_circle';

// import { rippleFragSource } from './ripple/RippleFilter_white';
// import { rippleFragSource } from './ripple/RippleFilter_white_style1';
// import customTextImg from '../../src/assets/gems/textImg_1.png';   //0.11.10
// import { rippleFragSource } from './ripple/RippleFilter_now.js';   //0.11.10
import { gsap } from 'gsap'; // 🌟 引入 GSAP 來控制影格動畫

export function setupTablet(app) {
  const container = new window.PIXI.Container();
  app.stage.addChildAt(container, 1);

  // ==========================================
  // [資源預載] 載入並手動裁切水波紋的大圖
  // ==========================================
  // 用來存放切好的 8 張水波圖片快取
  const rippleTextures = {};

  // 🚨 修正路徑：Vite 專案讀取 public 內的檔案，不需加 /public，直接用 / 即可
  Promise.all([
    fetch('/textImgLone.json').then(res => res.json()), // 自己去抓 JSON 陣列
    window.PIXI.Assets.load('/textImgLone.png')         // 抓取那張 8 圈合體的大圖
  ])
  .then(([jsonData, baseTexture]) => {
    // 根據 JSON 裡的座標，把大圖切成 8 張小圖存起來
    jsonData.forEach(data => {
      // 這裡的 data.name 對應 JSON 裡的 "textImgLone_1" 等字串
      const rect = new window.PIXI.Rectangle(data.x, data.y, data.width, data.height);
      rippleTextures[data.name] = new window.PIXI.Texture(baseTexture, rect);
    });
    console.log("💧 水波紋雪碧圖載入與裁切成功！");
  })
  .catch(e => console.error("💧 載入失敗，請確認 textImgLone.png 和 .json 都在 public 資料夾下", e));

  // ==========================================
  // [圖層設定] 水波層 (現在只用來裝普通的圖片)
  // ==========================================
  const waterLayer = new window.PIXI.Container();
  container.addChild(waterLayer);

  // 1. 建立純白底板，放在水波層最底下
  const baseBg = new window.PIXI.Graphics();
  baseBg.beginFill(0x000000); 
  baseBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  baseBg.endFill();
  waterLayer.addChild(baseBg);

  // 🚨 已經將舊版的 Shader (RippleFilter_now) 完全移除！

  // ==========================================
  // [寶石設定] 雙圖層交叉淡入系統
  // ==========================================
  let gemSpriteBottom = new window.PIXI.AnimatedSprite([window.PIXI.Texture.EMPTY]);
  let gemSpriteTop = new window.PIXI.AnimatedSprite([window.PIXI.Texture.EMPTY]);

  const initGemSprite = (sprite, parent) => {
    sprite.anchor.set(0.5); 
    sprite.x = 200; 
    sprite.y = TABLET_START_Y + (TABLET_H / 2); 
    sprite.alpha = 0; 
    sprite.scale.set(0.0275); 
    sprite.animationSpeed = 0.5; 
    parent.addChild(sprite);
  };

  initGemSprite(gemSpriteBottom, waterLayer); 
  initGemSprite(gemSpriteTop, container);     

  // ==========================================
  // [粒子系統] 碎裂水花容器
  // ==========================================
  const splashContainer = new window.PIXI.Container();
  container.addChild(splashContainer);
  let activeSplashes = []; 

  // ==========================================
  // [狀態變數] 寶石生命週期控制
  // ==========================================
  let isRevealingGem = false;
  let gemAnimTime = 0; 
  const GEM_REVEAL_DURATION = 12000; 
  const sheetCache = {};

  const revealGem = async (gemType) => {
    isRevealingGem = false; 
    
    if (!sheetCache[gemType]) {
      console.log(`📦 正在載入寶石序列圖: /gems/${gemType}.json`);
      const sheet = await window.PIXI.Assets.load(`/gems/${gemType}.json`);
      sheetCache[gemType] = sheet;
    }

    const sheet = sheetCache[gemType];
    const frames = sheet.animations[gemType] || Object.values(sheet.textures);

    gemSpriteBottom.textures = frames;
    gemSpriteTop.textures = frames;
    gemSpriteBottom.play();
    gemSpriteTop.play();
    
    gemSpriteBottom.alpha = 0;
    gemSpriteTop.alpha = 0;
    gemSpriteBottom.scale.set(0.0275);
    gemSpriteTop.scale.set(0.0275);
    
    isRevealingGem = true;
    gemAnimTime = 0;
  };

  const isHittingGem = (x, y) => {
    if (!isRevealingGem || gemAnimTime < 10000 || gemAnimTime > 18000) return false;
    let currentGemY = TABLET_START_Y + (TABLET_H / 2);
    let dist = Math.hypot(x - 200, y - currentGemY);
    return dist < 40; 
  };

  // ==========================================
  // 💧 [核心改寫] 新增水波或水花 (由顯示器跨螢幕呼叫)
  // ==========================================
  const FPS = 30; // 對應 AE 的 30 幀
  // 完全依照你在 AE 設定的幀數區間
  const RIPPLE_KEYFRAMES = [
    { id: 1, start: 0,  peak: 7,  end: 13 },
    { id: 2, start: 3,  peak: 12, end: 22 },
    { id: 3, start: 6,  peak: 17, end: 29 },
    { id: 4, start: 10, peak: 22, end: 34 },
    { id: 5, start: 14, peak: 26, end: 42 },
    { id: 6, start: 19, peak: 32, end: 49 },
    { id: 7, start: 24, peak: 37, end: 55 },
    { id: 8, start: 27, peak: 43, end: 74 }
  ];

  const addRipple = (x, y) => {
    // 1. 如果砸中實體寶石，就不產生水波，改產生水花
    if (isHittingGem(x, y)) {
      const numSplashes = Math.floor(Math.random() * 4) + 5; 
      for (let i = 0; i < numSplashes; i++) {
        const dot = new window.PIXI.Graphics();
        dot.beginFill(0xFFFFFF, 0.7 + Math.random() * 0.3); 
        dot.drawCircle(0, 0, Math.random() * 1.2 + 0.8); 
        dot.endFill();
        dot.x = x; dot.y = y;
        splashContainer.addChild(dot);
        
        activeSplashes.push({
          sprite: dot,
          vx: (Math.random() - 0.5) * 6, 
          vy: -(Math.random() * 4 + 2),  
          life: 1.0 
        });
      }
      return; 
    }
    
    // 2. 若未砸中，在該座標生成「一滴」由 8 圈文字組成的新水波
    const dropContainer = new window.PIXI.Container();
    dropContainer.x = x;
    dropContainer.y = y;
    waterLayer.addChild(dropContainer);

    let maxDurationSeconds = 0;

    const randomScale = 0.05 + Math.random() * 0.1;

    RIPPLE_KEYFRAMES.forEach(data => {
      // 🚨 改為從我們手動裁切好的 rippleTextures 中提取圖片
      const textureName = `textImgLone_${data.id}`;
      const texture = rippleTextures[textureName];

      if (!texture) {
        return; // 如果圖片大圖還沒載入/切好，就先忽略這次點擊，避免報錯
      }

      const sprite = new window.PIXI.Sprite(texture);
      sprite.anchor.set(0.5); // 中心點對齊
      sprite.alpha = 0;       // 預設全透明

      // 💡 調整縮放：1920x1080 放在平板中太大了，縮小一點
      sprite.scale.set(randomScale); 
      dropContainer.addChild(sprite);

      // 將「幀數」換算為「秒數」給 GSAP 使用
      const startTime = data.start / FPS;
      const fadeInDur = (data.peak - data.start) / FPS;
      const fadeOutDur = (data.end - data.peak) / FPS;
      
      const endTime = data.end / FPS;
      if (endTime > maxDurationSeconds) maxDurationSeconds = endTime;

      // 利用 GSAP 執行 100% 還原 AE 的透明度動畫
      const tl = gsap.timeline({ delay: startTime });
      tl.to(sprite, { alpha: 1, duration: fadeInDur, ease: "none" })
        .to(sprite, { alpha: 0, duration: fadeOutDur, ease: "none" });
    });

    // 3. 資源回收：這滴水波播完後 (大約第 74 幀 / 2.46 秒)，自動銷毀該容器以釋放記憶體
    gsap.delayedCall(maxDurationSeconds + 0.1, () => {
      if (!dropContainer.destroyed) {
        dropContainer.destroy({ children: true });
      }
    });
  };

  // ==========================================
  // API 與 更新迴圈
  // ==========================================
  return { 
    addRipple, 
    revealGem, 
    updateWater: (delta, time) => {
      
      // 🚨 舊版的 shader activeRipples 陣列運算已完全移除，因為現在由 GSAP 全自動控制了！

      // 1. 更新水花粒子 (物理拋物線)
      for (let i = activeSplashes.length - 1; i >= 0; i--) {
        let p = activeSplashes[i];
        p.vy += 0.3 * delta; 
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

      // 2. 更新寶石生命週期與淡入淡出
      if (isRevealingGem) {
        gemAnimTime += delta * 16.66; 
        
        if (gemAnimTime <= 15000) {
            let progress = Math.min(gemAnimTime / GEM_REVEAL_DURATION, 1.0); 
            let easeP = progress * progress; 
            let currentScale = 0.0275 + (easeP * 0.0275);
            let currentAlpha = easeP;

            let crossfadeP = 0;
            if (gemAnimTime > 10000) {
                crossfadeP = Math.min((gemAnimTime - 10000) / 1000.0, 1.0); 
            }

            gemSpriteBottom.scale.set(currentScale);
            gemSpriteTop.scale.set(currentScale);
            
            gemSpriteBottom.alpha = currentAlpha * (1.0 - crossfadeP); 
            gemSpriteTop.alpha = currentAlpha * crossfadeP;            
        } else {
            let fadeP = (gemAnimTime - 15000) / 3000.0; 
            let remainAlpha = Math.max(1.0 - fadeP, 0);
            
            gemSpriteTop.alpha = remainAlpha; 
            gemSpriteBottom.alpha = 0; 
            
            if (fadeP >= 1.0) {
              isRevealingGem = false; 
              gemSpriteBottom.stop(); 
              gemSpriteTop.stop();
            }
        }
      }
    }
  };
}