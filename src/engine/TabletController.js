// src/engine/TabletController.js
import { 
  TABLET_START_Y, TABLET_H, DISPLACEMENT_STRENGTH, 
  WATER_SPEED_X, WATER_SPEED_Y, GEM_MAPPING 
} from '../config/constants';

export function setupTablet(app, masterContainer) {
  const tabletBg = new window.PIXI.Graphics();
  tabletBg.beginFill(0x0a0a0c); 
  tabletBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  tabletBg.endFill();
  app.stage.addChildAt(tabletBg, 1); 

  const svgNs = "http://" + "www.w3.org/2000/svg";
  const svgNoiseUrl = 'data:image/svg+xml;base64,' + window.btoa(`<svg viewBox="0 0 512 512" xmlns="${svgNs}"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" stitchTiles="stitch" /></filter><rect width="100%" height="100%" filter="url(#noise)" /></svg>`);
  const noiseTexture = window.PIXI.Texture.from(svgNoiseUrl);
  const waterSprite = new window.PIXI.TilingSprite(noiseTexture, app.screen.width, app.screen.height);
  waterSprite.alpha = 0.15; 
  app.stage.addChild(waterSprite);

  const displacementFilter = new window.PIXI.DisplacementFilter(waterSprite);
  displacementFilter.scale.set(DISPLACEMENT_STRENGTH); 
  
  let bloomFilter = null;
  if (window.PIXI.filters && window.PIXI.filters.BloomFilter) {
    bloomFilter = new window.PIXI.filters.BloomFilter(8); 
    masterContainer.filters = [displacementFilter, bloomFilter];
  } else {
    masterContainer.filters = [displacementFilter];
  }

  const GEM_CENTER_Y = TABLET_START_Y + (TABLET_H * 0.7); 
  const gemContainer = new window.PIXI.Container();
  gemContainer.position.set(200, GEM_CENTER_Y);
  gemContainer.scale.set(0); 
  gemContainer.visible = false;
  masterContainer.addChildAt(gemContainer, 1); 

  // 原汁原味的幾何寶石繪圖
  const drawGem = (type, container) => {
    container.removeChildren(); 
    const glow = new window.PIXI.Graphics();
    const core = new window.PIXI.Container();

    switch(type) {
      case 'pearl': 
        glow.beginFill(0xFFE4E1, 0.7); glow.drawCircle(0, 0, 50); glow.endFill();
        const p = new window.PIXI.Graphics(); p.beginFill(0xFFFAF0); p.drawCircle(0, 0, 35); p.endFill();
        p.beginFill(0xFFFFFF, 0.9); p.drawCircle(-10, -10, 10); p.endFill(); 
        const pb = new window.PIXI.BlurFilter(); pb.blur = 4; p.filters = [pb];
        core.addChild(p); break;
      case 'diamond': 
        glow.beginFill(0xE0FFFF, 0.7); glow.drawCircle(0, 0, 60); glow.endFill();
        const d = new window.PIXI.Graphics();
        d.lineStyle(2, 0xFFFFFF, 1.0); d.beginFill(0xF0FFFF, 0.9);
        d.moveTo(-30, -20); d.lineTo(30, -20); d.lineTo(45, 0); d.lineTo(0, 50); d.lineTo(-45, 0); d.closePath(); d.endFill();
        d.lineStyle(1.5, 0xFFFFFF, 0.8); 
        d.moveTo(-30, -20); d.lineTo(0, 0); d.lineTo(30, -20);
        d.moveTo(-45, 0); d.lineTo(0, 0); d.lineTo(45, 0); d.moveTo(0, 0); d.lineTo(0, 50);
        core.addChild(d); break;
      case 'quartz': 
        glow.beginFill(0xF8F8FF, 0.7); glow.drawCircle(0, 0, 60); glow.endFill();
        const q = new window.PIXI.Graphics();
        q.lineStyle(2, 0xFFFFFF, 0.9);
        q.beginFill(0xFFFFFF, 0.9); q.moveTo(-15, 20); q.lineTo(-15, -30); q.lineTo(0, -50); q.lineTo(15, -30); q.lineTo(15, 20); q.closePath(); q.endFill();
        q.beginFill(0xF5F5F5, 0.9); q.moveTo(-25, 20); q.lineTo(-25, -10); q.lineTo(-15, -25); q.lineTo(-5, -10); q.lineTo(-5, 20); q.closePath(); q.endFill();
        q.beginFill(0xF5F5F5, 0.9); q.moveTo(5, 20); q.lineTo(5, -5); q.lineTo(15, -20); q.lineTo(25, -5); q.lineTo(25, 20); q.closePath(); q.endFill();
        core.addChild(q); break;
      case 'opal': 
        glow.beginFill(0xFFFFFF, 0.6); glow.drawCircle(0, 0, 55); glow.endFill();
        const o = new window.PIXI.Graphics(); o.beginFill(0xF0F8FF); o.drawEllipse(0, 0, 35, 45); o.endFill();
        const spots = new window.PIXI.Graphics(); 
        spots.beginFill(0xFFB6C1, 0.9); spots.drawCircle(-10, -15, 20); spots.endFill();
        spots.beginFill(0x87CEFA, 0.9); spots.drawCircle(15, 5, 22); spots.endFill();
        spots.beginFill(0x98FB98, 0.9); spots.drawCircle(-5, 20, 18); spots.endFill();
        const sb = new window.PIXI.BlurFilter(); sb.blur = 12; spots.filters = [sb];
        const mask = new window.PIXI.Graphics(); mask.beginFill(0xFFFFFF); mask.drawEllipse(0, 0, 35, 45); mask.endFill();
        spots.mask = mask; 
        core.addChild(o); core.addChild(spots); core.addChild(mask); break;
      case 'lapis': 
        glow.beginFill(0x4169E1, 0.7); glow.drawCircle(0, 0, 55); glow.endFill();
        const l = new window.PIXI.Graphics();
        l.beginFill(0x27408B); l.moveTo(-20, -35); l.lineTo(15, -40); l.lineTo(35, -10); l.lineTo(25, 30); l.lineTo(-10, 40); l.lineTo(-35, 10); l.closePath(); l.endFill();
        l.beginFill(0xFFD700); 
        l.drawCircle(-10, -20, 2.5); l.drawCircle(15, -15, 2); l.drawCircle(5, 10, 3); l.drawCircle(20, 15, 1.5); l.drawCircle(-15, 20, 2.5); l.drawCircle(-5, -5, 2); l.endFill();
        l.lineStyle(1.5, 0xD3D3D3, 0.8); 
        l.moveTo(-15, 10); l.lineTo(10, 25); l.moveTo(10, -25); l.lineTo(25, -5); l.moveTo(-25, -15); l.lineTo(-5, 0);
        core.addChild(l); break;
    }
    
    const shine = new window.PIXI.Graphics();
    shine.beginFill(0xFFFFFF, 0.1);
    shine.drawPolygon([-25, -60, 15, -60, -5, 60, -45, 60]); 
    shine.endFill();
    const shineBlur = new window.PIXI.BlurFilter(); 
    shineBlur.blur = 15;
    shine.filters = [shineBlur];
    core.addChild(shine);

    const glowBlur = new window.PIXI.BlurFilter(); glowBlur.blur = 25; glow.filters = [glowBlur];
    container.addChild(glow); container.addChild(core);
    
    // 回傳光暈與反光物件讓橋接器能進行動畫更新
    return { glow, shine }; 
  };

  const determineGem = (userWords) => {
    if (!userWords || userWords.length === 0) return 'diamond'; 
    const counts = { pearl: 0, diamond: 0, quartz: 0, opal: 0, lapis: 0 };
    userWords.forEach(word => {
      for (const [gem, wordsList] of Object.entries(GEM_MAPPING)) {
        if (wordsList.includes(word)) counts[gem]++;
      }
    });
    let maxCount = -1; let maxGems = [];
    for (const [gem, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; maxGems = [gem]; } 
      else if (count === maxCount) { maxGems.push(gem); }
    }
    return maxGems[Math.floor(Math.random() * maxGems.length)];
  };

  const updateWater = (delta) => {
    waterSprite.tilePosition.y -= WATER_SPEED_Y * delta; 
    waterSprite.tilePosition.x -= WATER_SPEED_X * delta;
  };

  return { gemContainer, GEM_CENTER_Y, drawGem, determineGem, updateWater };
}