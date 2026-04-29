// src/engine/0.10.0TabletController.js
import { TABLET_START_Y, TABLET_H } from '../config/constants';
// import { rippleFragSource } from './ripple/RippleFilter';
// import { rippleFragSource } from './ripple/RippleFilter_circle';
// import { rippleFragSource } from './ripple/RippleFilter_white';
import { rippleFragSource } from './ripple/RippleFilter_white_style1';
// import bgImagePath from '../../src/assets/Rainier_mood.jpg';  //純白背景可以不用


export function setupTablet(app) {
  const container = new window.PIXI.Container();
  app.stage.addChildAt(container, 1);

  // 1. 純白底板 (Shader 現在是純粹的白底計算，不再依賴背景圖)
  const baseBg = new window.PIXI.Graphics();
  baseBg.beginFill(0xFFFFFF); 
  baseBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  baseBg.endFill();
  container.addChild(baseBg);

  // ==========================================
  // 2. 烘焙 (Pre-bake) 同心圓文字紋理
  // ==========================================
  const texSize = 512;
  const cx = texSize / 2;
  const cy = texSize / 2;
  const textGeneratorContainer = new window.PIXI.Container();

  const words = ["孤單", "焦慮", "壓力", "疲倦", "迷惘", "失落", "恐懼", "悲傷"];
  const ringCounts = [8, 6, 4];   
  const ringSizes = [38, 26, 16]; 
  const ringRadii = [60, 140, 220]; 

  for (let i = 0; i < 3; i++) {
      let numWords = ringCounts[i];
      let style = new window.PIXI.TextStyle({
          fontFamily: 'Arial', 
          fontSize: ringSizes[i], 
          fill: '#FFFFFF', // 【除蟲關鍵 1】：改用純白字體，杜絕 Alpha 通道消失的雷區
          fontWeight: 'bold'
      });
      
      for(let j = 0; j < numWords; j++) {
          let angle = (j / numWords) * Math.PI * 2;
          let text = new window.PIXI.Text(words[Math.floor(Math.random() * words.length)], style);
          
          text.updateText(true); // 【除蟲關鍵 2】：強制 PIXI 立刻將文字畫入記憶體，避免截到空圖
          
          text.anchor.set(0.5);
          text.x = cx + Math.cos(angle) * ringRadii[i];
          text.y = cy + Math.sin(angle) * ringRadii[i];
          text.rotation = angle + Math.PI / 2; 
          textGeneratorContainer.addChild(text);
      }
  }

  const textTexture = window.PIXI.RenderTexture.create({ width: texSize, height: texSize });
  
  // 【除蟲關鍵 3】：相容 PIXI 各版本的安全算圖寫法
  if (app.renderer.renderTexture) {
      app.renderer.render(textGeneratorContainer, { renderTexture: textTexture });
  } else {
      app.renderer.render(textGeneratorContainer, textTexture);
  }

  
  // ==========================================
  // 3. 掛載 Shader
  // ==========================================
  const ripplesData = new Float32Array(200 * 3); 

  const rippleFilter = new window.PIXI.Filter(null, rippleFragSource, {
    uResolution: [400, TABLET_H],
    uTime: 0,
    uTextTex: textTexture, // 【核心】：把算好的文字圖傳給 Shader
    uRipples: ripplesData
  });
  rippleFilter.padding = 0;

  // 只需要把濾鏡掛在白底板上即可
  baseBg.filters = [rippleFilter];

  // ==========================================
  // 4. 水波更新邏輯 (維持原版 200 滴水的效能優化)
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