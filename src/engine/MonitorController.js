// src/engine/MonitorController.js

/**
 * 螢幕視訊控制器 (Monitor Controller)
 * 負責將使用者的 WebRTC 攝影機畫面轉換為 PIXI 背景，並維持全螢幕等比例滿版 (Cover) 縮放。
 */
export function setupMonitor(app, videoElement) {
  // 將 HTML Video 轉換為 PIXI 可用的動態紋理
  const videoBaseTexture = new window.PIXI.BaseTexture(videoElement);
  const videoTexture = new window.PIXI.Texture(videoBaseTexture);
  const videoSprite = new window.PIXI.Sprite(videoTexture);
  const videoContainer = new window.PIXI.Container();
  
  videoSprite.anchor.set(0.5); 
  videoContainer.addChild(videoSprite);
  videoSprite.alpha = 0.6; // 降低不透明度，讓前景的文字眼淚更清晰
  
  // 將視訊層置於 PIXI 畫布的最底層 (index: 0)
  app.stage.addChildAt(videoContainer, 0); 

  /**
   * 更新視訊縮放比例
   * 確保畫面無論視窗如何縮放，都能像 CSS 的 object-fit: cover 一樣填滿且不變形
   */
  const updateVideoScale = () => {
    if (videoElement.videoWidth > 0) {
       // 取畫面寬度比與高度比的「最大值」來進行滿版縮放
       const scale = Math.max(
         app.screen.width / videoElement.videoWidth, 
         app.screen.height / videoElement.videoHeight
       );
       
       videoSprite.scale.set(scale); 
       videoSprite.scale.x *= -1; // X 軸鏡像反轉，讓使用者有照鏡子的直覺感
       
       // 永遠保持在畫布正中央
       videoSprite.position.set(app.screen.width / 2, app.screen.height / 2); 
    }
  };

  return { updateVideoScale };
}