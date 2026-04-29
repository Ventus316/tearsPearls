// src/engine/0.10.0TabletController.js
import { TABLET_START_Y, TABLET_H } from '../config/constants';
// import { rippleFragSource } from './ripple/RippleFilter';
// import { rippleFragSource } from './ripple/RippleFilter_circle';
import { rippleFragSource } from './ripple/RippleFilter_white';
import bgImagePath from '../../src/assets/Rainier_mood.jpg'; 


export function setupTablet(app) {
  const container = new window.PIXI.Container();
  app.stage.addChildAt(container, 1);

  const baseBg = new window.PIXI.Graphics();
  baseBg.beginFill(0x0a0a0c); 
  baseBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  baseBg.endFill();
  container.addChild(baseBg);

  const shaderBg = new window.PIXI.Graphics();
  shaderBg.beginFill(0xFFFFFF); 
  shaderBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  shaderBg.endFill();
  shaderBg.visible = false; 
  
  const bgTexture = window.PIXI.Texture.from(bgImagePath);
  
  // 【修改點 1】：為 30 個波紋分配記憶體 (每個波紋 3 個浮點數：x, y, life)
  const ripplesData = new Float32Array(200 * 3); 

  const rippleFilter = new window.PIXI.Filter(null, rippleFragSource, {
    uResolution: [400, TABLET_H],
    uTime: 0,
    iChannel0: bgTexture,
    uRipples: ripplesData
  });
  shaderBg.filters = [rippleFilter];
  container.addChild(shaderBg);

  let activeRipples = [];

  const addRipple = (x, y) => {
    const uvX = x / 400.0;
    const uvY = (y - TABLET_START_Y) / TABLET_H;
    activeRipples.push({ x: uvX, y: uvY, life: 0.01 }); 
    
    // 【修改點 2】：放寬強制刪除的上限到 30
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

      // 【修改點 3】：迴圈寫入資料時，也要跑到 30
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
    setShaderVisible: (visible) => {
      shaderBg.visible = visible;
    }
  };
}