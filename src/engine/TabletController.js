// src/engine/TabletController.js
import { TABLET_START_Y, TABLET_H } from '../config/constants';
// import bgImagePath from '../../src/assets/Rainier_mood.jpg';  //純白背景可以不用
// import { rippleFragSource } from './ripple/RippleFilter';
// import { rippleFragSource } from './ripple/RippleFilter_circle';

// import { rippleFragSource } from './ripple/RippleFilter_white';
// import { rippleFragSource } from './ripple/RippleFilter_white_style1';

import customTextImg from '../../src/assets/gems/diamond_non_square.png'; 
import { rippleFragSource } from './ripple/RippleFilter_reveal';

export function setupTablet(app) {
  const container = new window.PIXI.Container();
  app.stage.addChildAt(container, 1);

  // 1. 純白底板
  const baseBg = new window.PIXI.Graphics();
  baseBg.beginFill(0xFFFFFF); 
  baseBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  baseBg.endFill();
  container.addChild(baseBg);

  // ==========================================
  // 2. 載入自訂圖片紋理
  // ==========================================
  // 直接將 PNG 圖片轉為 PIXI 紋理，取代原本的虛擬畫布與迴圈算圖
  const textTexture = window.PIXI.Texture.from(customTextImg);

  // ==========================================
  // 3. 掛載 Shader
  // ==========================================
  const ripplesData = new Float32Array(200 * 3); 

  const rippleFilter = new window.PIXI.Filter(null, rippleFragSource, {
    uResolution: [400, TABLET_H],
    uTime: 0,
    uTextTex: textTexture, // 把你的 PNG 圖片傳給 Shader
    uRipples: ripplesData
  });
  rippleFilter.padding = 0;

  baseBg.filters = [rippleFilter];

  // ==========================================
  // 4. 水波更新邏輯
  // ==========================================
  let activeRipples = [];

  const addRipple = (x, y) => {
    const uvX = x / 400.0;
    const uvY = (y - TABLET_START_Y) / TABLET_H;
    activeRipples.push({ x: uvX, y: uvY, life: 0.01 }); 
    if(activeRipples.length > 200) activeRipples.shift(); 
  };

  return { 
    addRipple, 
    updateWater: (delta, time) => {
      rippleFilter.uniforms.uTime = time;

      for(let i = 0; i < activeRipples.length; i++) {
        activeRipples[i].life += delta * 0.012; 
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
    },
    setShaderVisible: (visible) => {} 
  };
}