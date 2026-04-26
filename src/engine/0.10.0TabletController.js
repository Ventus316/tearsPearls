// src/engine/0.10.0TabletController.js
import { TABLET_START_Y, TABLET_H } from '../config/constants';
import { backgroundFragSource } from './ripple/BackgroundFilter';

// 引入您準備好的背景圖片
import bgImagePath from '../../src/assets/Rainier_mood.jpg';

export function setupTablet(app) {
  const container = new window.PIXI.Container();
  app.stage.addChildAt(container, 1);

  // 1. 基礎深黑背景 (選詞條時顯示)
  const baseBg = new window.PIXI.Graphics();
  baseBg.beginFill(0x0a0a0c); 
  baseBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  baseBg.endFill();
  container.addChild(baseBg);

  // 2. 動態 Shader 背景 (掉落時顯示)
  const shaderBg = new window.PIXI.Graphics();
  shaderBg.beginFill(0xFFFFFF); 
  shaderBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  shaderBg.endFill();
  shaderBg.visible = false; // 預設隱藏
  
  // 將圖片轉換為 PIXI 紋理
  const bgTexture = window.PIXI.Texture.from(bgImagePath);

  const bgFilter = new window.PIXI.Filter(null, backgroundFragSource, {
    uResolution: [400, TABLET_H],
    uTime: 0,
    iChannel0: bgTexture // 將紋理圖傳遞給 Shader
  });
  shaderBg.filters = [bgFilter];
  container.addChild(shaderBg);

  // 測試用的觀察小圓點
  const drawDebugDot = (x, y) => {
    const dot = new window.PIXI.Graphics();
    dot.beginFill(0xFFFFFF); dot.drawCircle(0, 0, 3); dot.endFill();
    dot.x = x; dot.y = y; container.addChild(dot);
    
    const fadeOut = () => {
        dot.alpha -= 0.02;
        if (dot.alpha <= 0) { container.removeChild(dot); dot.destroy(); app.ticker.remove(fadeOut); }
    };
    app.ticker.add(fadeOut);
  };

  return { 
    drawDebugDot, 
    updateWater: (delta, time) => {
      bgFilter.uniforms.uTime = time;
    },
    setShaderVisible: (visible) => {
      shaderBg.visible = visible;
    }
  };
}