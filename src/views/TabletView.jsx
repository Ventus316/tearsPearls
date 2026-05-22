// src/views/TabletView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { WORDS, SETTLEMENT_DESCRIPTIONS, GEM_MAPPING } from '../config/constants';
import { createTabletEngine } from '../engine/TabletEngine'; 
import { io } from 'socket.io-client';

export default function TabletView() {
  const pixiContainer = useRef(null); const engineRef = useRef(null); const socketRef = useRef(null);
  const [interactionState, setInteractionState] = useState('ready'); 
  const [selectedWords, setSelectedWords] = useState([]); 

  useEffect(() => {
    // 🚨 記得檢查你的 IP
    const SERVER_IP = 'http://192.168.138.1:3000'; 
    socketRef.current = io(SERVER_IP);

    if (pixiContainer.current && !engineRef.current) engineRef.current = createTabletEngine(pixiContainer.current);

    socketRef.current.on('tablet-receive-tear', (data) => {
      if (engineRef.current) engineRef.current.receiveTear(data.nx, data.z); // 接收 nx 比例
    });
    socketRef.current.on('tablet-show-finished', () => setInteractionState('finished'));

    return () => { 
      if (socketRef.current) socketRef.current.disconnect(); 
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const toggleWord = (word) => {
    if (interactionState !== 'ready') return;
    if (selectedWords.includes(word)) setSelectedWords(selectedWords.filter(w => w !== word));
    else if (selectedWords.length < 5) setSelectedWords([...selectedWords, word]);
  };

  const determineGemType = (userWords) => {
    if (!userWords || userWords.length === 0) return 'diamond'; 
    const counts = { pearl: 0, diamond: 0, quartz: 0, opal: 0, lapis: 0 };
    userWords.forEach(word => { for (const [gem, wordsList] of Object.entries(GEM_MAPPING)) { if (wordsList.includes(word)) counts[gem]++; } });
    let maxCount = -1; let selectedGem = 'diamond';
    for (const [gem, count] of Object.entries(counts)) { if (count > maxCount) { maxCount = count; selectedGem = gem; } }
    return selectedGem;
  };

  const handleCrying = () => { 
    if (selectedWords.length !== 5) return;
    setInteractionState('playing'); 
    if (socketRef.current && engineRef.current) {
      socketRef.current.emit('tablet-trigger-crying', selectedWords);
      engineRef.current.revealGem(determineGemType(selectedWords));
    }
  };

  const handleTryAgain = () => { setInteractionState('ready'); setSelectedWords([]); };
  const getSettlementText = () => {
    if (selectedWords.length === 0) return '沉重的落淚，已淬鍊成不碎的結晶。';
    return SETTLEMENT_DESCRIPTIONS?.[selectedWords[selectedWords.length - 1]] || '沉重的落淚，已淬鍊成不碎的結晶。';
  };

  return (
    // 🌟 拔除所有寬高限制，改為 w-screen h-screen 全螢幕
    <div className="w-screen h-screen bg-[#050507] text-[#E8E4D9] font-sans select-none overflow-hidden relative">
      
      {/* 🌟 滿版水波與寶石畫布 */}
      <div ref={pixiContainer} className="absolute inset-0 z-0" />

      {/* 標題與 UI 面板層：永遠在全螢幕垂直水平置中 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
        
        <div className={`flex flex-col items-center pointer-events-auto transition-all duration-1000 ${interactionState === 'playing' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <div className="mb-8 text-center px-4">
            <h1 className="text-4xl font-extralight mb-2 tracking-[0.4em] text-white/90 drop-shadow-lg">AFTER FALLING</h1>
            <p className="text-xs tracking-[0.6em] text-amber-100/40 uppercase">The Alchemy of Tears</p>
          </div>

          {interactionState === 'ready' && (
            // UI 面板稍微加寬 (w-[420px]) 以適應大螢幕平板
            <div className="flex flex-col items-center bg-[#1c1c1e]/70 backdrop-blur-2xl border border-white/10 px-8 py-8 rounded-2xl shadow-2xl w-[420px]">
              <div className="flex justify-between w-full items-end mb-3 px-1">
                <span className="text-gray-300 text-[13px] font-light tracking-widest">拾起 5 片壓抑在心底的碎屑</span>
                <span className="text-gray-500 text-xs tracking-wider">{selectedWords.length}/5</span>
              </div>
              <div className="w-full h-[2px] bg-white/20 mb-4"></div>
              
              <div className="flex flex-col gap-2 w-full">
                {Array.from({ length: Math.ceil(WORDS.length / 4) }).map((_, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-4 bg-[#1c1c1e] border border-white/10 rounded-md overflow-hidden w-full">
                    {WORDS.slice(rowIndex * 4, rowIndex * 4 + 4).map(word => (
                      <button key={word} onClick={() => toggleWord(word)} className={`py-3 text-xs tracking-widest transition-colors duration-150 ${selectedWords.includes(word) ? 'bg-white text-black font-medium' : 'bg-transparent text-gray-400 hover:bg-white/5'}`}>
                        {word}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {selectedWords.length === 5 && (
                <div className="w-full mt-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
                  <div className="w-full h-[2px] bg-white/20 mb-5"></div>
                  <button onClick={handleCrying} className="px-10 py-3 bg-white hover:bg-gray-200 rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.2)] text-black text-xs font-medium tracking-widest transition-transform active:scale-95 w-auto text-center">
                    盡情哭吧 GO
                  </button>
                </div>
              )}
            </div>
          )}

          {interactionState === 'finished' && (
            <div className="flex flex-col items-center bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/10 px-8 py-8 rounded-2xl shadow-2xl w-[400px]">
              <p className="text-white/40 text-xs font-light tracking-[0.2em] w-full text-center">情緒已結晶</p>
              <div className="w-full h-[2px] bg-white/20 mt-3 mb-4"></div>
              <p className="text-amber-50/90 text-sm font-light tracking-[0.15em] text-center leading-relaxed px-4 py-2">
                {getSettlementText()}
              </p>
              <div className="w-full h-[2px] bg-white/20 mt-4 mb-4"></div>
              <button onClick={handleTryAgain} className="w-full py-3 bg-[#2c2c2e] hover:bg-[#3a3a3c] rounded-lg font-light text-gray-200 tracking-widest text-xs transition-transform active:scale-95">
                與另一個自己對話
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}