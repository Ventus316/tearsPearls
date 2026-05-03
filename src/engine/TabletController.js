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

  const baseBg = new window.PIXI.Graphics();
  baseBg.beginFill(0xFFFFFF); 
  baseBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  baseBg.endFill();
  container.addChild(baseBg);

  const textTexture = window.PIXI.Texture.from(customTextImg);
  const ripplesData = new Float32Array(200 * 4); 
  const rippleFilter = new window.PIXI.Filter(null, rippleFragSource, {
    uResolution: [400, TABLET_H],
    uTextTex: textTexture, 
    uRipples: ripplesData
  });
  rippleFilter.padding = 0;
  baseBg.filters = [rippleFilter];

  const gemTextures = {
    pearl: window.PIXI.Texture.from(pearlImg),
    diamond: window.PIXI.Texture.from(diamondImg),
    quartz: window.PIXI.Texture.from(quartzImg),
    opal: window.PIXI.Texture.from(opalImg),
    lapis: window.PIXI.Texture.from(lapisImg)
  };

  const gemSprite = new window.PIXI.Sprite();
  gemSprite.anchor.set(0.5); // 確保從中心點放大
  gemSprite.x = 200;
  // 🚨 拔除 +40 的位移，直接鎖死在平板正中央
  gemSprite.y = TABLET_START_Y + (TABLET_H / 2); 
  gemSprite.alpha = 0;
  gemSprite.scale.set(0.0275); 
  container.addChild(gemSprite);

  let isRevealingGem = false;
  let gemAnimTime = 0;

  const revealGem = (gemType) => {
    gemSprite.texture = gemTextures[gemType] || gemTextures['diamond'];
    gemSprite.alpha = 0;
    gemSprite.scale.set(0.0275);
    // 🚨 拔除 +40 的位移
    gemSprite.y = TABLET_START_Y + (TABLET_H / 2);
    
    isRevealingGem = true;
    gemAnimTime = 0;
  };

  let activeRipples = [];

  const isHittingGem = (x, y) => {
    // 只有在破水期 (大於 10000 毫秒)，且還沒完全淡出前 (小於 18000 毫秒)，寶石才具有物理實體
    if (!isRevealingGem || gemAnimTime < 10000 || gemAnimTime > 18000) return false;
    
    // 🚨 因為寶石不再上下移動，結界判定也不需要計算移動量了，直接鎖定正中央
    let currentGemY = TABLET_START_Y + (TABLET_H / 2);
    let dist = Math.hypot(x - 200, y - currentGemY);
    
    return dist < 40; 
  };

  const addRipple = (x, y) => {
    if (isHittingGem(x, y)) {
      console.log("💥 文字命中寶石實體，準備濺射！");
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
        
        if (gemAnimTime <= 5000) {
            gemSprite.alpha = 0;
            gemSprite.scale.set(0.0275);
            // 🚨 拔除 +40 的位移
            gemSprite.y = TABLET_START_Y + (TABLET_H / 2);
            
        } else if (gemAnimTime <= 12000) {
            let p = (gemAnimTime - 5000) / 7000.0; 
            let easeInP = p * p; 
            
            gemSprite.alpha = easeInP;
            gemSprite.scale.set(0.0275 + (easeInP * 0.0275));
            // 🚨 拔除垂直動畫，維持置中
            gemSprite.y = TABLET_START_Y + (TABLET_H / 2);
            
        } else if (gemAnimTime <= 15000) {
            gemSprite.alpha = 1.0;
            gemSprite.scale.set(0.055);
            gemSprite.y = TABLET_START_Y + (TABLET_H / 2);
            
        } else {
            let fadeP = (gemAnimTime - 15000) / 3000.0; 
            
            gemSprite.alpha = Math.max(1.0 - fadeP, 0);
            gemSprite.scale.set(0.055);
            gemSprite.y = TABLET_START_Y + (TABLET_H / 2);
            
            if (fadeP >= 1.0) {
                isRevealingGem = false;
            }
        }
      }
    }
  };
}