// src/engine/MonitorController.js

/**
 * 螢幕視訊控制器 (Monitor Controller)
 * 接收去背後的 Canvas，轉換為 PIXI 背景，並維持全螢幕等比例滿版 (Cover) 縮放。
 */
export function setupMonitor(app, sourceElement) {
  // 🌟 修正 1：使用 PIXI.Texture.from()，讓 PIXI 自動管理底層資源
  const videoTexture = window.PIXI.Texture.from(sourceElement);
  const videoSprite = new window.PIXI.Sprite(videoTexture);
  const videoContainer = new window.PIXI.Container();
  
  videoSprite.anchor.set(0.5); 
  videoContainer.addChild(videoSprite);
  videoSprite.alpha = 1.0; 
  
  // 將視訊層置於 PIXI 畫布的最底層 (index: 0)
  app.stage.addChildAt(videoContainer, 0); 

  // 🌟 修正 2：在渲染迴圈中，嚴格核對並更新紋理尺寸
  app.ticker.add(() => {
    // 讀取 Canvas 實時的像素寬高
    const currentW = sourceElement.videoWidth || sourceElement.width;
    const currentH = sourceElement.videoHeight || sourceElement.height;

    if (currentW > 0 && currentH > 0) {
      // 如果 Canvas 的尺寸與 PIXI 緩存的尺寸不同 (例如從 300x150 變為真實相機解析度)
      // 必須強制重設 WebGL 的 Texture 尺寸！
      if (videoTexture.baseTexture.width !== currentW || videoTexture.baseTexture.height !== currentH) {
        videoTexture.baseTexture.setSize(currentW, currentH);
      }
      
      // 每幀更新像素資料
      videoTexture.update();
    }
  });

  /**
   * 更新視訊縮放比例
   */
  const updateVideoScale = () => {
    const w = sourceElement.videoWidth || sourceElement.width;
    const h = sourceElement.videoHeight || sourceElement.height;

    if (w > 0 && h > 0) {
       // 取畫面寬度比與高度比的「最大值」來進行滿版縮放 (object-fit: cover 效果)
       const scale = Math.max(
         app.screen.width / w, 
         app.screen.height / h
       );
       
       videoSprite.scale.set(scale); 
       videoSprite.scale.x *= -1; // X 軸鏡像反轉，讓使用者有照鏡子的直覺感
       
       // 永遠保持在畫布正中央
       videoSprite.position.set(app.screen.width / 2, app.screen.height / 2); 
    }
  };

  return { updateVideoScale };
}