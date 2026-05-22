// src/views/TabletView.jsx
import React, { useState } from 'react';
import { WORDS, SETTLEMENT_DESCRIPTIONS, TABLET_H } from '../config/constants';

export default function TabletView() {
  // 📝 平板只需要控制 UI 的狀態，不需要管攝影機
  const [interactionState, setInteractionState] = useState('ready'); // 'ready' | 'playing' | 'finished'
  const [selectedWords, setSelectedWords] = useState([]); 

  const toggleWord = (word) => {
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter(w => w !== word));
    } else if (selectedWords.length < 5) {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const handleCrying = () => { 
    if (selectedWords.length !== 5) return;
    setInteractionState('playing'); 
    
    // 🚧 [準備中] 這裡之後會透過 Socket.io 發送訊號給 MonitorView
    console.log("發送廣播給顯示器：開始大哭！", selectedWords);
  };

  const handleTryAgain = () => { 
    setInteractionState('ready'); 
    setSelectedWords([]); 
  };

  const getSettlementText = () => {
    if (selectedWords.length === 0) return '沉重的落淚，已淬鍊成不碎的結晶。';
    const coreWord = selectedWords[selectedWords.length - 1];
    return SETTLEMENT_DESCRIPTIONS?.[coreWord] || '沉重的落淚，已淬鍊成不碎的結晶。';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050507] text-[#E8E4D9] font-sans select-none">
      
      <div className="mb-6 text-center px-4">
        <h1 className="text-3xl font-extralight mb-1 tracking-[0.4em] text-white/90 drop-shadow-md">AFTER FALLING</h1>
        <p className="text-[10px] tracking-[0.6em] text-amber-100/40 uppercase">The Alchemy of Tears</p>
      </div>

      <div className="relative shadow-2xl border border-[#222] bg-black overflow-hidden rounded-xl" style={{ width: '400px', height: `${TABLET_H}px` }}>
        
        {/* 🚧 [準備中] 這裡之後會掛載專屬於 Tablet 的 PIXI 水波與寶石畫布 */}
        <div className="absolute inset-0 bg-[#0a0a0c] z-0 flex items-center justify-center">
             <span className="text-white/10 text-xs tracking-widest">水池畫布預備區</span>
        </div>

        {/* Apple 風格 UI 面板 */}
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className={`pointer-events-auto transition-all duration-1000 ${interactionState === 'playing' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            
            {/* 3. 準備畫面：極簡 Apple 橫向分欄風格 */}
            {interactionState === 'ready' && (
              <div className="flex flex-col items-center bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 px-5 py-5 rounded-xl shadow-2xl w-[360px]">
                
                <div className="flex justify-between w-full items-end mb-2 px-1">
                  <span className="text-gray-300 text-[11px] font-light tracking-widest">拾起 5 片壓抑在心底的碎屑</span>
                  <span className="text-gray-500 text-[10px] tracking-wider">{selectedWords.length}/5</span>
                </div>

                <div className="w-full h-[2px] bg-white/20 mb-3"></div>
                
                <div className="flex flex-col gap-1.5 w-full">
                  {Array.from({ length: Math.ceil(WORDS.length / 4) }).map((_, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-4 bg-[#1c1c1e] border border-white/10 rounded-sm overflow-hidden w-full">
                      {WORDS.slice(rowIndex * 4, rowIndex * 4 + 4).map(word => (
                        <button
                          key={word} onClick={() => toggleWord(word)}
                          className={`py-2 text-[10px] tracking-widest transition-colors duration-150 ${selectedWords.includes(word) ? 'bg-white text-black font-medium' : 'bg-transparent text-gray-400 hover:bg-white/5'}`}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                {selectedWords.length === 5 && (
                  <div className="w-full mt-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
                    <div className="w-full h-[2px] bg-white/20 mb-3.5"></div>
                    <button onClick={handleCrying} className="px-8 py-2.5 bg-white hover:bg-gray-200 rounded-md shadow-[0_0_15px_rgba(255,255,255,0.2)] text-black text-[11px] font-medium tracking-widest transition-transform active:scale-95 w-auto text-center">
                      盡情哭吧 GO
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 4. 結算畫面 */}
            {interactionState === 'finished' && (
              <div className="flex flex-col items-center bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 px-6 py-6 rounded-xl shadow-2xl w-[340px]">
                <p className="text-white/40 text-[10px] font-light tracking-[0.2em] w-full text-center">情緒已結晶</p>
                <div className="w-full h-[2px] bg-white/20 mt-2 mb-3"></div>
                <p className="text-amber-50/90 text-[11px] font-light tracking-[0.15em] text-center leading-relaxed px-2 py-2">
                  {getSettlementText()}
                </p>
                <div className="w-full h-[2px] bg-white/20 mt-3 mb-3"></div>
                <button onClick={handleTryAgain} className="w-full py-2.5 bg-[#2c2c2e] hover:bg-[#3a3a3c] rounded-md font-light text-gray-200 tracking-widest text-[11px] transition-transform active:scale-95">
                  與另一個自己對話
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}