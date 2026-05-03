// src/engine/TabletController.js
import { TABLET_START_Y, TABLET_H } from '../config/constants';
// import bgImagePath from '../../src/assets/Rainier_mood.jpg';  //純白背景可以不用
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
  const ripplesData = new Float32Array(200 * 3); 
  const rippleFilter = new window.PIXI.Filter(null, rippleFragSource, {
    uResolution: [400, TABLET_H],
    uTime: 0,
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
  // 【縮小比例】：初始縮小到非常小的 0.1
  gemSprite.scale.set(0.1); 
  container.addChild(gemSprite);

  let isRevealingGem = false;
  let gemAnimTime = 0;
  const GEM_REVEAL_DURATION = 12000; 

  const revealGem = (gemType) => {
    gemSprite.texture = gemTextures[gemType] || gemTextures['diamond'];
    gemSprite.alpha = 0;
    // 重設為初始極小比例
    gemSprite.scale.set(0.005);
    gemSprite.y = TABLET_START_Y + (TABLET_H / 2) + 40;
    
    isRevealingGem = true;
    gemAnimTime = 0;
  };

  let activeRipples = [];

  const addRipple = (x, y) => {
    const uvX = x / 400.0;
    const uvY = (y - TABLET_START_Y) / TABLET_H;
    activeRipples.push({ x: uvX, y: uvY, life: 0.01 }); 
    if(activeRipples.length > 200) activeRipples.shift(); 
  };

  return { 
    addRipple, 
    revealGem, 
    updateWater: (delta, time) => {
      rippleFilter.uniforms.uTime = time;

      for(let i = 0; i < activeRipples.length; i++) {
        activeRipples[i].life += delta * 0.005; 
      }
      activeRipples = activeRipples.filter(r => r.life < 1.0);

      for(let i = 0; i < 200; i++) {
        if (i < activeRipples.length) {
          ripplesData[i*3] = activeRipples[i].x;
          ripplesData[i*3+1] = activeRipples[i].y;
          ripplesData[i*3+2] = activeRipples[i].life;
        } else {
          ripplesData[i*3+2] = 0.0; 
        }
      }

      if (isRevealingGem) {
        gemAnimTime += delta * 16.66; 
        let progress = Math.min(gemAnimTime / GEM_REVEAL_DURATION, 1.0);
        
        gemSprite.alpha = progress;
        
        // 【控制寶石大小的精華區】：
        // 從極小的 0.1 開始，加上進度比例 (最大 1.0) 乘以 0.2。
        // 也就是說，當動畫播完時，寶石的 scale 最多只會放大到 0.3！
        // 如果覺得 0.3 還是太大，可以把 0.2 改成 0.1 (最後變成 0.2 倍)。
        gemSprite.scale.set(0.005 + (progress * 0.05));
        
        gemSprite.y = TABLET_START_Y + (TABLET_H / 2) + 40 - (progress * 40);
        gemSprite.rotation = Math.sin(time * 0.5) * 0.05 * progress;
      }
    },
    setShaderVisible: (visible) => {} 
  };
}