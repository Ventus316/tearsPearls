// src/engine/TabletController.js
import { TABLET_START_Y, TABLET_H } from '../config/constants';
// import { rippleFragSource } from './ripple/RippleFilter';
// import { rippleFragSource } from './ripple/RippleFilter_circle';

// import { rippleFragSource } from './ripple/RippleFilter_white';
// import { rippleFragSource } from './ripple/RippleFilter_white_style1';
import customTextImg from '../../src/assets/gems/textImg_1.png'; 
import { rippleFragSource } from './ripple/RippleFilter_reveal';

import pearlImg from '../../src/assets/gems/pearl.png';
import diamondImg from '../../src/assets/gems/diamond.png';
import quartzImg from '../../src/assets/gems/quartz.png';
import opalImg from '../../src/assets/gems/opal.png';
import lapisImg from '../../src/assets/gems/lapis.png';

export function setupTablet(app) {
  const container = new window.PIXI.Container();
  app.stage.addChildAt(container, 1);

  // 🚨 建立「水池圖層」：所有加進這裡的東西都會被水波 Shader 扭曲
  const waterLayer = new window.PIXI.Container();
  container.addChild(waterLayer);

  const baseBg = new window.PIXI.Graphics();
  baseBg.beginFill(0xFFFFFF); 
  baseBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  baseBg.endFill();
  waterLayer.addChild(baseBg);

  const textTexture = window.PIXI.Texture.from(customTextImg);
  const ripplesData = new Float32Array(200 * 4); 
  const rippleFilter = new window.PIXI.Filter(null, rippleFragSource, {
    uResolution: [400, TABLET_H],
    uTextTex: textTexture, 
    uRipples: ripplesData
  });
  rippleFilter.padding = 0;
  
  // 濾鏡掛在整個水池圖層上
  waterLayer.filters = [rippleFilter];

  const gemTextures = {
    pearl: window.PIXI.Texture.from(pearlImg),
    diamond: window.PIXI.Texture.from(diamondImg),
    quartz: window.PIXI.Texture.from(quartzImg),
    opal: window.PIXI.Texture.from(opalImg),
    lapis: window.PIXI.Texture.from(lapisImg)
  };

  // 🚨 雙圖層設定
  // 1. 水下的寶石 (會被折射扭曲)
  const gemSpriteBottom = new window.PIXI.Sprite();
  gemSpriteBottom.anchor.set(0.5);
  gemSpriteBottom.x = 200;
  gemSpriteBottom.y = TABLET_START_Y + (TABLET_H / 2); 
  gemSpriteBottom.alpha = 0;
  gemSpriteBottom.scale.set(0.0275); 
  waterLayer.addChild(gemSpriteBottom); 

  // 2. 水面上的寶石 (清晰實體)
  const gemSpriteTop = new window.PIXI.Sprite();
  gemSpriteTop.anchor.set(0.5);
  gemSpriteTop.x = 200;
  gemSpriteTop.y = TABLET_START_Y + (TABLET_H / 2); 
  gemSpriteTop.alpha = 0;
  gemSpriteTop.scale.set(0.0275); 
  container.addChild(gemSpriteTop); // 加在容器頂層，不受水波影響

  let isRevealingGem = false;
  let gemAnimTime = 0;
  const GEM_REVEAL_DURATION = 12000; 

  const revealGem = (gemType) => {
    const tex = gemTextures[gemType] || gemTextures['diamond'];
    gemSpriteBottom.texture = tex;
    gemSpriteTop.texture = tex;
    
    gemSpriteBottom.alpha = 0;
    gemSpriteTop.alpha = 0;
    gemSpriteBottom.scale.set(0.0275);
    gemSpriteTop.scale.set(0.0275);
    
    isRevealingGem = true;
    gemAnimTime = 0;
  };

  let activeRipples = [];

  const isHittingGem = (x, y) => {
    // 🚨 關鍵防禦：水面下 ( < 10000) 絕對不觸發碰撞實體！
    if (!isRevealingGem || gemAnimTime < 10000 || gemAnimTime > 18000) return false;
    
    let currentGemY = TABLET_START_Y + (TABLET_H / 2);
    let dist = Math.hypot(x - 200, y - currentGemY);
    
    return dist < 40; 
  };

  const addRipple = (x, y) => {
    if (isHittingGem(x, y)) {
      console.log("💥 文字命中水面上的寶石實體，準備濺射！");
      return; 
    }

    const uvX = x / 400.0;
    const uvY = (y - TABLET_START_Y) / TABLET_H;
    const randomScale = Math.random() * 0.9 + 0.1;
    
    activeRipples.push({ x: uvX, y: uvY, life: 0.01, scale: randomScale }); 
    if(activeRipples.length > 200) activeRipples.shift(); 
  };

  return { 
    addRipple, 
    revealGem, 
    updateWater: (delta, time) => {
      for(let i = 0; i < activeRipples.length; i++) {
        activeRipples[i].life += delta * 0.005; 
      }
      activeRipples = activeRipples.filter(r => r.life < 1.0);

      for(let i = 0; i < 200; i++) {
        if (i < activeRipples.length) {
          ripplesData[i*4]     = activeRipples[i].x;
          ripplesData[i*4 + 1] = activeRipples[i].y;
          ripplesData[i*4 + 2] = activeRipples[i].life;
          ripplesData[i*4 + 3] = activeRipples[i].scale;
        } else {
          ripplesData[i*4 + 2] = 0.0; 
        }
      }

      if (isRevealingGem) {
        gemAnimTime += delta * 16.66; 
        
        if (gemAnimTime <= 15000) {
            // 🚨 恢復舊版平滑增長邏輯：用連續時間變數算進度
            let progress = Math.min(gemAnimTime / GEM_REVEAL_DURATION, 1.0); 
            // 透過二次方達成你說的「0~5秒極慢，5~10秒加速」的視覺感
            let easeP = progress * progress; 
            
            let currentScale = 0.0275 + (easeP * 0.0275);
            let currentAlpha = easeP;

            // 🚨 10~11 秒：破水而出交叉淡入 (Crossfade)
            let crossfadeP = 0;
            if (gemAnimTime > 10000) {
                // 在 1000 毫秒內，從 0 變 1
                crossfadeP = Math.min((gemAnimTime - 10000) / 1000.0, 1.0); 
            }

            // 同步兩顆寶石的大小，確保視覺絕對連貫
            gemSpriteBottom.scale.set(currentScale);
            gemSpriteTop.scale.set(currentScale);

            // 分配透明度：水下寶石出水後消失，實體寶石出水後成型
            gemSpriteBottom.alpha = currentAlpha * (1.0 - crossfadeP); 
            gemSpriteTop.alpha = currentAlpha * crossfadeP;            

        } else {
            // 15 秒後的退場機制 (原地淡出)
            let fadeP = (gemAnimTime - 15000) / 3000.0; 
            let remainAlpha = Math.max(1.0 - fadeP, 0);
            
            // 已經完全出水，只要控制 Top 寶石
            gemSpriteTop.alpha = remainAlpha;
            gemSpriteBottom.alpha = 0;
            
            if (fadeP >= 1.0) isRevealingGem = false;
        }
      }
    }
  };
}