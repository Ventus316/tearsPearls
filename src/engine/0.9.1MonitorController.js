// src/engine/MonitorController.js
import { MONITOR_H, GAP_H } from '../config/constants';

export function setupMonitor(app, videoElement) {
  const videoBaseTexture = new window.PIXI.BaseTexture(videoElement);
  const videoTexture = new window.PIXI.Texture(videoBaseTexture);
  const videoSprite = new window.PIXI.Sprite(videoTexture);
  const videoContainer = new window.PIXI.Container();
  
  videoSprite.anchor.set(0.5); 
  videoContainer.addChild(videoSprite);
  videoSprite.alpha = 0.6; // 稍微調暗鏡頭，營造氣氛

  const monitorMask = new window.PIXI.Graphics();
  monitorMask.beginFill(0xFFFFFF); 
  monitorMask.drawRect(0, 0, 400, MONITOR_H); 
  monitorMask.endFill();
  videoContainer.mask = monitorMask;
  
  app.stage.addChildAt(videoContainer, 0); 
  app.stage.addChildAt(monitorMask, 0);

  const bezelContainer = new window.PIXI.Container();
  app.stage.addChild(bezelContainer);
  const bezel = new window.PIXI.Graphics(); 
  bezel.beginFill(0x111315); 
  bezel.drawRect(0, MONITOR_H, 400, GAP_H); 
  bezel.endFill();
  bezelContainer.addChild(bezel);

  const updateVideoScale = () => {
    if (videoElement.videoWidth > 0) {
       const scale = Math.max(400 / videoElement.videoWidth, MONITOR_H / videoElement.videoHeight);
       videoSprite.scale.set(scale); 
       videoSprite.scale.x *= -1; 
       videoSprite.position.set(200, MONITOR_H / 2); 
    }
  };

  return { updateVideoScale };
}