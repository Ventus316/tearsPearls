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
  waterLayer.filters = [rippleFilter];

  const gemTextures = {
    pearl: window.PIXI.Texture.from(pearlImg),
    diamond: window.PIXI.Texture.from(diamondImg),
    quartz: window.PIXI.Texture.from(quartzImg),
    opal: window.PIXI.Texture.from(opalImg),
    lapis: window.PIXI.Texture.from(lapisImg)
  };

  const gemSpriteBottom = new window.PIXI.Sprite();
  gemSpriteBottom.anchor.set(0.5);
  gemSpriteBottom.x = 200;
  gemSpriteBottom.y = TABLET_START_Y + (TABLET_H / 2); 
  gemSpriteBottom.alpha = 0;
  gemSpriteBottom.scale.set(0.0275); 
  waterLayer.addChild(gemSpriteBottom); 

  const gemSpriteTop = new window.PIXI.Sprite();
  gemSpriteTop.anchor.set(0.5);
  gemSpriteTop.x = 200;
  gemSpriteTop.y = TABLET_START_Y + (TABLET_H / 2); 
  gemSpriteTop.alpha = 0;
  gemSpriteTop.scale.set(0.0275); 
  container.addChild(gemSpriteTop); 

  // 🚨 [階段四] 建立專屬的水花粒子圖層，確保水花疊加在最頂層
  const splashContainer = new window.PIXI.Container();
  container.addChild(splashContainer);
  // 用來存放存活粒子的陣列
  let activeSplashes = [];

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
    if (!isRevealingGem || gemAnimTime < 10000 || gemAnimTime > 18000) return false;
    
    let currentGemY = TABLET_START_Y + (TABLET_H / 2);
    let dist = Math.hypot(x - 200, y - currentGemY);
    
    return dist < 40; 
  };

  const addRipple = (x, y) => {
    if (isHittingGem(x, y)) {
      // 🚨 [階段四] 觸發水花濺射！
      // 隨機生成 5 ~ 8 顆水花
      const numSplashes = Math.floor(Math.random() * 4) + 5; 
      
      for (let i = 0; i < numSplashes; i++) {
        const dot = new window.PIXI.Graphics();
        // 畫一個半透明偏白的小圓點 (Alpha: 0.7 ~ 1.0)
        dot.beginFill(0xFFFFFF, 0.7 + Math.random() * 0.3);
        // 半徑隨機 0.8 ~ 2.0 像素
        const radius = Math.random() * 1.2 + 0.8; 
        dot.drawCircle(0, 0, radius);
        dot.endFill();
        
        dot.x = x;
        dot.y = y;
        splashContainer.addChild(dot);
        
        // 賦予物理初速
        activeSplashes.push({
          sprite: dot,
          // X軸初速：隨機向左或向右飛 (-3 到 3)
          vx: (Math.random() - 0.5) * 6,
          // Y軸初速：隨機向上飛 (-2 到 -6)
          vy: -(Math.random() * 4 + 2), 
          // 生命週期 1.0，會在 500ms 內扣完
          life: 1.0 
        });
      }
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
      // --- 水波更新 ---
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

      // 🚨 [階段四] 水花粒子物理引擎更新
      // 使用反向迴圈，方便在生命週期結束時安全移除元素
      for (let i = activeSplashes.length - 1; i >= 0; i--) {
        let p = activeSplashes[i];
        
        // 1. 套用重力 (向下加速)
        p.vy += 0.3 * delta; 
        
        // 2. 更新位置 (拋物線軌跡)
        p.sprite.x += p.vx * delta;
        p.sprite.y += p.vy * delta;
        
        // 3. 更新生命週期與透明度 (設定 500 毫秒內歸零)
        p.life -= (delta * 16.66) / 500.0; 
        p.sprite.alpha = Math.max(0, p.life);
        
        // 4. 壽終正寢：銷毀圖形並移出陣列，釋放記憶體
        if (p.life <= 0) {
            splashContainer.removeChild(p.sprite);
            p.sprite.destroy();
            activeSplashes.splice(i, 1);
        }
      }

      // --- 寶石生命週期更新 ---
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
            
            if (fadeP >= 1.0) isRevealingGem = false;
        }
      }
    }
  };
}