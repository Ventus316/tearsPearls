// src/engine/TabletController.js
import { TABLET_START_Y, TABLET_H } from '../config/constants';
// import { rippleFragSource } from './ripple/RippleFilter';
// import { rippleFragSource } from './ripple/RippleFilter_circle';

// import { rippleFragSource } from './ripple/RippleFilter_white';
// import { rippleFragSource } from './ripple/RippleFilter_white_style1';
import customTextImg from '../../src/assets/gems/textImg_1.png'; 
import { rippleFragSource } from './ripple/RippleFilter_now.js';

export function setupTablet(app) {
  const container = new window.PIXI.Container();
  app.stage.addChildAt(container, 1);

  // ==========================================
  // [圖層設定] 水波扭曲層 (受 Shader 影響)
  // ==========================================
  const waterLayer = new window.PIXI.Container();
  container.addChild(waterLayer);

  // 1. 建立純白底板，放在水波層最底下
  const baseBg = new window.PIXI.Graphics();
  baseBg.beginFill(0xFFFFFF); 
  baseBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  baseBg.endFill();
  waterLayer.addChild(baseBg);

  // 2. 設定水波濾鏡 (Shader)，並掛載到水波層上
  const textTexture = window.PIXI.Texture.from(customTextImg);
  const ripplesData = new Float32Array(200 * 4); 
  const rippleFilter = new window.PIXI.Filter(null, rippleFragSource, {
    uResolution: [400, TABLET_H],
    uTextTex: textTexture, 
    uRipples: ripplesData
  });
  rippleFilter.padding = 0;
  waterLayer.filters = [rippleFilter];

  // ==========================================
  // [寶石設定] 雙圖層交叉淡入系統
  // ==========================================
  // 建立兩個動畫精靈 (初始化為空材質，等 JSON 載入後替換)
  let gemSpriteBottom = new window.PIXI.AnimatedSprite([window.PIXI.Texture.EMPTY]);
  let gemSpriteTop = new window.PIXI.AnimatedSprite([window.PIXI.Texture.EMPTY]);

  // 初始化寶石的共用屬性設定函數
  const initGemSprite = (sprite, parent) => {
    sprite.anchor.set(0.5); // 設定中心點為縮放基準
    sprite.x = 200; // X 軸置中
    sprite.y = TABLET_START_Y + (TABLET_H / 2); // Y 軸置中
    sprite.alpha = 0; // 初始全透明
    sprite.scale.set(0.0275); // 初始大小
    sprite.animationSpeed = 0.5; // 動畫播放速度 (0.5 代表半速播放)
    parent.addChild(sprite);
  };

  // 將底層寶石放入水波層 (會被扭曲)
  initGemSprite(gemSpriteBottom, waterLayer); 
  // 將頂層寶石放入主容器 (浮在水面上，不會被扭曲)
  initGemSprite(gemSpriteTop, container);     

  // ==========================================
  // [粒子系統] 碎裂水花容器
  // ==========================================
  const splashContainer = new window.PIXI.Container();
  container.addChild(splashContainer);
  let activeSplashes = []; // 存放目前存活的水花粒子

  // ==========================================
  // [狀態變數] 寶石生命週期控制
  // ==========================================
  let isRevealingGem = false;
  let gemAnimTime = 0; // 記錄寶石出現了多久 (毫秒)
  const GEM_REVEAL_DURATION = 12000; // 寶石完全成形所需時間

  // 快取物件：儲存已經載入過的 JSON 資源，避免重複下載
  const sheetCache = {};

  // 觸發寶石出現的函式 (gemType 需傳入 'pearl', 'diamond' 等字串)
  const revealGem = async (gemType) => {
    isRevealingGem = false; // 在載入完成前先暫停動畫邏輯
    
    // 如果快取中沒有這個寶石，就發起網路請求去下載 JSON
    if (!sheetCache[gemType]) {
      console.log(`📦 正在載入寶石序列圖: /gems/${gemType}.json`);
      // PIXI 會自動尋找 public/gems/ 下的 json，並讀取對應的 png
      const sheet = await window.PIXI.Assets.load(`/gems/${gemType}.json`);
      sheetCache[gemType] = sheet;
    }

    const sheet = sheetCache[gemType];
    // 嘗試從 JSON 的 animations 欄位取得陣列，若無則抓取所有 textures
    const frames = sheet.animations[gemType] || Object.values(sheet.textures);

    // 將載入好的序列圖影格指定給兩個寶石精靈
    gemSpriteBottom.textures = frames;
    gemSpriteTop.textures = frames;
    
    // 開始播放旋轉動畫
    gemSpriteBottom.play();
    gemSpriteTop.play();
    
    // 初始化外觀狀態
    gemSpriteBottom.alpha = 0;
    gemSpriteTop.alpha = 0;
    gemSpriteBottom.scale.set(0.0275);
    gemSpriteTop.scale.set(0.0275);
    
    // 啟動生命週期計時器
    isRevealingGem = true;
    gemAnimTime = 0;
  };

  let activeRipples = []; // 存放目前存活的水波

  // 判斷文字是否砸中「浮出水面的寶石實體」
  const isHittingGem = (x, y) => {
    // 只有在 10~18 秒之間 (寶石已破水且未消失) 才具備物理碰撞體積
    if (!isRevealingGem || gemAnimTime < 10000 || gemAnimTime > 18000) return false;
    let currentGemY = TABLET_START_Y + (TABLET_H / 2);
    let dist = Math.hypot(x - 200, y - currentGemY);
    // 碰撞半徑設為 40 像素
    return dist < 40; 
  };

  // 新增水波或水花 (由外部呼叫，傳入文字掉落的座標)
  const addRipple = (x, y) => {
    // 如果砸中實體寶石，就不產生水波，改產生水花
    if (isHittingGem(x, y)) {
      const numSplashes = Math.floor(Math.random() * 4) + 5; // 隨機產生 5~8 顆水花
      for (let i = 0; i < numSplashes; i++) {
        const dot = new window.PIXI.Graphics();
        dot.beginFill(0xFFFFFF, 0.7 + Math.random() * 0.3); // 半透明白色
        dot.drawCircle(0, 0, Math.random() * 1.2 + 0.8); // 隨機大小
        dot.endFill();
        dot.x = x; dot.y = y;
        splashContainer.addChild(dot);
        
        // 賦予水花物理初速
        activeSplashes.push({
          sprite: dot,
          vx: (Math.random() - 0.5) * 6, // X軸左右飛散
          vy: -(Math.random() * 4 + 2),  // Y軸向上拋射
          life: 1.0 // 粒子生命值
        });
      }
      return; // 結束函式，不執行下方水波邏輯
    }
    
    // 若未砸中寶石，則產生水波 (轉換為 UV 座標供 Shader 使用)
    const uvX = x / 400.0;
    const uvY = (y - TABLET_START_Y) / TABLET_H;
    activeRipples.push({ x: uvX, y: uvY, life: 0.01, scale: Math.random() * 0.9 + 0.1 }); 
    if(activeRipples.length > 200) activeRipples.shift(); // 限制最多 200 個水波
  };

  // 回傳給主程式的 API 介面與更新迴圈
  return { 
    addRipple, 
    revealGem, 
    // 每幀執行的更新邏輯 (delta 為時間差)
    updateWater: (delta, time) => {
      
      // ==========================================
      // 1. 更新水波資料
      // ==========================================
      for(let i = 0; i < activeRipples.length; i++) activeRipples[i].life += delta * 0.005; 
      activeRipples = activeRipples.filter(r => r.life < 1.0);

      // 將水波資料打包進 Float32Array 傳給 Shader
      for(let i = 0; i < 200; i++) {
        if (i < activeRipples.length) {
          ripplesData[i*4] = activeRipples[i].x;
          ripplesData[i*4 + 1] = activeRipples[i].y;
          ripplesData[i*4 + 2] = activeRipples[i].life;
          ripplesData[i*4 + 3] = activeRipples[i].scale;
        } else {
          ripplesData[i*4 + 2] = 0.0; // 將未使用的水波生命值歸零
        }
      }

      // ==========================================
      // 2. 更新水花粒子 (物理拋物線)
      // ==========================================
      for (let i = activeSplashes.length - 1; i >= 0; i--) {
        let p = activeSplashes[i];
        p.vy += 0.3 * delta; // 重力加速度 (Y軸速度逐漸變大/朝下)
        p.sprite.x += p.vx * delta; // 更新 X 位置
        p.sprite.y += p.vy * delta; // 更新 Y 位置
        p.life -= (delta * 16.66) / 500.0; // 扣除生命值 (約 500ms 後死亡)
        p.sprite.alpha = Math.max(0, p.life); // 透明度隨生命值衰減
        
        // 若粒子死亡，清除圖形並移出陣列
        if (p.life <= 0) {
            splashContainer.removeChild(p.sprite);
            p.sprite.destroy();
            activeSplashes.splice(i, 1);
        }
      }

      // ==========================================
      // 3. 更新寶石生命週期與淡入淡出
      // ==========================================
      if (isRevealingGem) {
        gemAnimTime += delta * 16.66; // 累加動畫時間 (以毫秒計算)
        
        if (gemAnimTime <= 15000) {
            // [成形階段：0~15秒]
            let progress = Math.min(gemAnimTime / GEM_REVEAL_DURATION, 1.0); 
            let easeP = progress * progress; // 二次方緩動：起步慢，後面快
            let currentScale = 0.0275 + (easeP * 0.0275);
            let currentAlpha = easeP;

            // [破水而出階段：10~11秒] 計算交叉淡入的比例
            let crossfadeP = 0;
            if (gemAnimTime > 10000) {
                // crossfadeP 會在 1000 毫秒內從 0 變到 1
                crossfadeP = Math.min((gemAnimTime - 10000) / 1000.0, 1.0); 
            }

            // 同步兩層寶石的大小
            gemSpriteBottom.scale.set(currentScale);
            gemSpriteTop.scale.set(currentScale);
            
            // 分配透明度：水下寶石隨時間淡出，水上寶石隨時間淡入
            gemSpriteBottom.alpha = currentAlpha * (1.0 - crossfadeP); 
            gemSpriteTop.alpha = currentAlpha * crossfadeP;            
        } else {
            // [消散階段：15~18秒]
            let fadeP = (gemAnimTime - 15000) / 3000.0; 
            let remainAlpha = Math.max(1.0 - fadeP, 0);
            
            gemSpriteTop.alpha = remainAlpha; // 實體寶石淡出
            gemSpriteBottom.alpha = 0; // 水底寶石保持隱藏
            
            if (fadeP >= 1.0) {
              isRevealingGem = false; // 結束生命週期
              gemSpriteBottom.stop(); // 停止旋轉動畫以節省效能
              gemSpriteTop.stop();
            }
        }
      }
    }
  };
}