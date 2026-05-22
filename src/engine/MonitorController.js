// src/engine/MonitorController.js
export function setupMonitor(app, videoElement) {
  const videoBaseTexture = new window.PIXI.BaseTexture(videoElement);
  const videoTexture = new window.PIXI.Texture(videoBaseTexture);
  const videoSprite = new window.PIXI.Sprite(videoTexture);
  const videoContainer = new window.PIXI.Container();
  
  videoSprite.anchor.set(0.5); 
  videoContainer.addChild(videoSprite);
  videoSprite.alpha = 0.6; 
  
  // 🌟 直接加入背景，移除舊版的 monitorMask 與 bezelContainer
  app.stage.addChildAt(videoContainer, 0); 

  const updateVideoScale = () => {
    if (videoElement.videoWidth > 0) {
       // 🌟 改用 app.screen.width / height 來進行全螢幕滿版縮放 (Cover)
       const scale = Math.max(app.screen.width / videoElement.videoWidth, app.screen.height / videoElement.videoHeight);
       videoSprite.scale.set(scale); 
       videoSprite.scale.x *= -1; 
       // 🌟 永遠置中於全螢幕
       videoSprite.position.set(app.screen.width / 2, app.screen.height / 2); 
    }
  };

  return { updateVideoScale };
}