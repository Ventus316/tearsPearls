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
  // 🚨 改為 200 * 4，用來儲存 (x, y, life, scale)
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
  gemSprite.anchor.set(0.5);
  gemSprite.x = 200;
  gemSprite.y = TABLET_START_Y + (TABLET_H / 2) + 40; 
  gemSprite.alpha = 0;
  gemSprite.scale.set(0.005); 
  container.addChild(gemSprite);

  let isRevealingGem = false;
  let gemAnimTime = 0;
  const GEM_REVEAL_DURATION = 12000; 

  const revealGem = (gemType) => {
    gemSprite.texture = gemTextures[gemType] || gemTextures['diamond'];
    gemSprite.alpha = 0;
    gemSprite.scale.set(0.005);
    gemSprite.y = TABLET_START_Y + (TABLET_H / 2) + 40;
    
    isRevealingGem = true;
    gemAnimTime = 0;
  };

  let activeRipples = [];

  // 🚨 階段一：新增物理結界判定
  const isHittingGem = (x, y) => {
    // 只有在破水期 (大於 10000 毫秒) 寶石才具有物理實體
    if (!isRevealingGem || gemAnimTime < 10000) return false;
    
    // 計算當下寶石的真實中心點 Y 座標
    let progress = Math.min(gemAnimTime / GEM_REVEAL_DURATION, 1.0);
    let currentGemY = TABLET_START_Y + (TABLET_H / 2) + 40 - (progress * 40);
    
    // 計算文字落點與寶石中心的直線距離
    let dist = Math.hypot(x - 200, y - currentGemY);
    
    // 設定碰撞半徑為 40 像素 (可依視覺做微調)
    return dist < 40; 
  };

  const addRipple = (x, y) => {
    // 🚨 階段一：結界防禦！
    if (isHittingGem(x, y)) {
      // 命中實體！我們將在未來階段四把濺射特效寫在這裡
      console.log("💥 文字命中寶石實體，準備濺射！");
      return; // 直接中斷，不產生水底波紋跟文字顯影
    }

    const uvX = x / 400.0;
    const uvY = (y - TABLET_START_Y) / TABLET_H;
    
    // 🚨 階段一：產生隨機大小 (0.1 ~ 1.0)
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

      // 🚨 打包四個維度的資料傳給 Shader
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
        let progress = Math.min(gemAnimTime / GEM_REVEAL_DURATION, 1.0);
        
        gemSprite.alpha = progress;
        gemSprite.scale.set(0.005 + (progress * 0.05));
        gemSprite.y = TABLET_START_Y + (TABLET_H / 2) + 40 - (progress * 40);
        
        // 暫時保留程式旋轉，等未來接上序列圖再拔除
        gemSprite.rotation = Math.sin(time * 0.5) * 0.05 * progress;
      }
    }
  };
}