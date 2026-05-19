import React, { useEffect, useRef, useState } from 'react';
import "./index.css";

export default function App() {
  const pixiContainer = useRef(null);
  const appRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // 測試情緒詞彙 (長短不一，更能看出逐字效果)
  const words = ['焦慮', '壓力很大', '自責', '委屈', '孤單', '沒事', '不知道怎麼辦', '想念'];

  useEffect(() => {
    if (window.PIXI) {
      initPixi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js';
      script.onload = initPixi;
      document.body.appendChild(script);
    }

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, []);

  const initPixi = () => {
    if (appRef.current) return;

    const app = new window.PIXI.Application({
      width: 400,
      height: 700,
      backgroundColor: 0xE8E4D9, // 宣紙色
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    
    pixiContainer.current.appendChild(app.view);
    appRef.current = app;

    // --- 效能優化：把所有「單字」預先算成圖片 ---
    // 找出所有出現過的不重複單字
    const uniqueChars = new Set(words.join('').split(''));
    const charTextures = {};
    
    uniqueChars.forEach(char => {
      const textGraphic = new window.PIXI.Text(char, {
        fontFamily: '"PingFang TC", "STKaiti", "KaiTi", serif',
        fontSize: 34, // 字放大一點，單字比較有感覺
        fill: 0x1A1C20, // 濃墨色
        fontWeight: 'bold',
      });
      charTextures[char] = app.renderer.generateTexture(textGraphic);
      textGraphic.destroy();
    });

    // --- 產生平滑柏林雜訊 (水波紋理) ---
    const svgNoise = `
      <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    `;
    const noiseUrl = `data:image/svg+xml;base64,${btoa(svgNoise)}`;
    const noiseTexture = window.PIXI.Texture.from(noiseUrl);
    
    const waterSprite = new window.PIXI.TilingSprite(noiseTexture, app.screen.width, app.screen.height);
    app.stage.addChild(waterSprite);

    // ✅ 移除 .filters 解決棄用警告
    const displacementFilter = new window.PIXI.DisplacementFilter(waterSprite);
    displacementFilter.scale.set(12);

    const inkContainer = new window.PIXI.Container();
    inkContainer.filters = [displacementFilter];
    app.stage.addChild(inkContainer);

    const drops = [];
    const inkTrails = [];
    
    // 存放「排隊等著掉下來」的單字
    const dropQueue = [];
    let frameCounter = 0; // 用來計時

    // --- 定義：產生一個詞彙的排隊邏輯 ---
    const spawnWordFlow = () => {
      const word = words[Math.floor(Math.random() * words.length)];
      const chars = word.split('');
      
      // 決定這個詞是從左眼還是右眼流出
      const isLeftEye = Math.random() > 0.5;
      // 眼睛的 X 座標：左邊 30% 處，右邊 70% 處
      const eyeX = isLeftEye ? app.screen.width * 0.3 : app.screen.width * 0.7;
      
      // 將拆解的字放進佇列，設定每個字的掉落延遲
      chars.forEach((char, index) => {
        dropQueue.push({
          char: char,
          x: eyeX + (Math.random() - 0.5) * 15, // 眼睛位置有一點微小的偏移
          y: 40, // 眼睛的 Y 座標 (頂端)
          triggerFrame: frameCounter + (index * 25) // 每個字相隔 25 幀 (約0.4秒) 掉落
        });
      });
    };

    // --- 實作：單個字的物理掉落 ---
    const spawnSingleChar = (char, startX, startY) => {
      const drop = new window.PIXI.Sprite(charTextures[char]);
      drop.anchor.set(0.5);
      drop.x = startX; 
      drop.y = startY;
      
      // ✅ 移除 .filters 解決棄用警告
      const blurFilter = new window.PIXI.BlurFilter();
      blurFilter.blur = 0.5;
      drop.filters = [blurFilter];

      inkContainer.addChild(drop);

      drops.push({
        sprite: drop,
        char: char,
        blur: blurFilter,
        vx: (Math.random() - 0.5) * 0.15, // 非常小的橫向飄移，保持像一道淚痕
        vy: Math.random() * 0.5 + 1.2,    // 穩定的下落速度
        life: 0,
        lastTrailTime: 0
      });
    };

    window.spawnWord = spawnWordFlow;

    // --- 動畫循環 ---
    app.ticker.add((delta) => {
      frameCounter += delta;

      // 檢查有沒有該掉下來的字
      for (let i = dropQueue.length - 1; i >= 0; i--) {
        if (frameCounter >= dropQueue[i].triggerFrame) {
          spawnSingleChar(dropQueue[i].char, dropQueue[i].x, dropQueue[i].y);
          dropQueue.splice(i, 1); // 發射後從佇列移除
        }
      }

      waterSprite.tilePosition.y -= 1.0 * delta; 
      waterSprite.tilePosition.x -= 0.3 * delta;

      // 更新掉落中的字
      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        drop.life += delta;
        drop.sprite.y += drop.vy * delta;
        // 沿著虛擬臉頰的微幅 S 型擺動
        drop.sprite.x += drop.vx * delta + Math.sin(drop.life * 0.03) * 0.2; 

        const depthRatio = drop.sprite.y / app.screen.height; 
        
        drop.blur.blur = 0.5 + (depthRatio * 2.5); // 往下掉逐漸模糊

        drop.sprite.alpha = Math.max(2 - (depthRatio * 3), 0);

        // 留下水墨殘影
        if (drop.life - drop.lastTrailTime > (15 - depthRatio * 10)) {
          drop.lastTrailTime = drop.life;
          
          const trail = new window.PIXI.Sprite(charTextures[drop.char]);
          trail.anchor.set(0.5);
          trail.x = drop.sprite.x;
          trail.y = drop.sprite.y;
          trail.rotation = Math.random() * 0.2 - 0.1; 
          
          // ✅ 移除 .filters 解決棄用警告
          const trailBlur = new window.PIXI.BlurFilter();
          trailBlur.blur = 1.5 + (depthRatio * 4); 
          trail.filters = [trailBlur];
          
          inkContainer.addChildAt(trail, 0);

          inkTrails.push({
            sprite: trail,
            blurFilter: trailBlur,
            scaleSpeed: 0.005 + (Math.random() * 0.008), 
            alphaSpeed: 0.01 + (Math.random() * 0.01),  
            vy: drop.vy * 0.3 // 墨跡流動得比較慢
          });
        }

        if (drop.sprite.y > app.screen.height + 80) {
          inkContainer.removeChild(drop.sprite);
          drop.sprite.destroy();
          drops.splice(i, 1);
        }
      }

      // 更新墨跡殘影
      for (let i = inkTrails.length - 1; i >= 0; i--) {
        const trail = inkTrails[i];
        trail.sprite.scale.x += trail.scaleSpeed * delta;
        trail.sprite.scale.y += trail.scaleSpeed * delta;
        trail.sprite.alpha -= trail.alphaSpeed * delta;
        trail.blurFilter.blur += 0.15 * delta;
        trail.sprite.y += trail.vy * delta;

        if (trail.sprite.alpha <= 0) {
          inkContainer.removeChild(trail.sprite);
          trail.sprite.destroy();
          inkTrails.splice(i, 1);
        }
      }
    });

    setIsReady(true);
  };

  const startCrying = () => {
    if (!window.spawnWord) return;
    let count = 0;
    const interval = setInterval(() => {
      window.spawnWord();
      count++;
      if (count > 15) clearInterval(interval); // 產生 15 組詞
    }, 800); // 每 0.8 秒決定一組詞從哪隻眼睛流出
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#2A2B2E] text-[#E8E4D9] font-sans p-4">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2 tracking-widest text-amber-100">情緒萃取：雙眼逐字落淚</h1>
        <p className="text-sm text-gray-400 max-w-md">
          詞彙被拆解為單字，從虛擬的左眼或右眼接連滑落，形成兩道淚痕。
        </p>
      </div>

      <div 
        ref={pixiContainer} 
        className="rounded-sm shadow-2xl border border-[#1A1C20] relative overflow-hidden"
        style={{ width: '400px', height: '700px' }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#E8E4D9] text-[#1A1C20]">
            研墨中...
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-4">
        <button 
          onClick={() => window.spawnWord && window.spawnWord()}
          className="px-6 py-3 bg-transparent hover:bg-white/10 rounded-full font-medium transition-colors border border-[#E8E4D9]"
        >
          流出一個詞彙
        </button>
        <button 
          onClick={startCrying}
          className="px-6 py-3 bg-amber-700 hover:bg-amber-600 rounded-full font-medium transition-colors shadow-lg"
        >
          模擬情緒崩潰 (10秒)
        </button>
      </div>
    </div>
  );
}