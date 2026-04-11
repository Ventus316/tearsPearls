# 💧 《落下之後》 (After Falling) - 互動藝術裝置

> 「你的感性，是你最寶貴的收藏。」
> 本作品透過互動裝置，將伴隨壓力而生的淚水重新定義為「人生的礦石」。每一滴落下的淚，經過情緒的萃取，最終都會結晶成獨一無二的寶石。

<div align="center">
  <img src="assets/demo.gif" alt="落下之後 Demo 畫面" width="400" />
</div>

---

## 🛠️ 技術棧 (Tech Stack)

- **前端框架:** React (使用 Vite 建置)
- **互動渲染引擎:** PixiJS (WebGL)
- **樣式排版:** Tailwind CSS
- **電腦視覺:** Google MediaPipe (Face Landmarker)

---

## ✨ 核心技術亮點 (Technical Highlights)

本專案不僅包含前端 UI 介面，更實作了即時的物理運算與跨裝置通訊模擬，以達到最真實的沉浸式互動：

1. **即時眼位動態生成 (Real-time Eye Tracking)**
   整合 MediaPipe 捕捉觀眾臉部特徵，將眼淚生成的初始座標 `(X, Y)` 精準綁定於使用者的眼角位置。
2. **生成式水墨物理引擎 (Generative Fluid Physics)**
   捨棄傳統的預錄 AE 影片，全面改用 PixiJS 打造底層物理引擎。利用 `ColorMatrixFilter` (閾值二值化) 與 `BlurFilter` (高斯模糊) 實作出 **Metaball (元球演算法)**，達成眼淚文字下落時的「液體沾黏、融合與排泄殘影」效果。
3. **跨螢幕狀態繼承與延遲傳輸 (Cross-Screen Routing & State Inheritance)**
   開發「虛擬深度演算 (Virtual Depth)」系統。當文字掉出顯示器 (Monitor) 邊界時，程式會精準擷取該物件的**速度、縮放比例與透明度**存入佇列，並模擬 2 秒的網路傳輸延遲後，於平板端 (Tablet) 完美重生，達成無縫的物理接力。

---

## 🚀 如何在本地端運行 (How to Run Locally)

**環境要求：** 請確保您的電腦已安裝 [Node.js](https://nodejs.org/zh-tw/) (建議安裝 LTS 版本)。

### 啟動步驟：

1. 將本專案 Clone 到本地端，或下載 ZIP 檔並解壓縮。
2. 使用終端機 (Terminal) 或 VS Code 打開專案資料夾。
3. 安裝專案依賴套件：
   ```bash
   npm install
   ```
4. 啟動開發伺服器：
   ```bash
   npm run dev
   ```
5. 終端機會顯示一段 Local 網址（通常為 http://localhost:5173/），按住 Ctrl (Mac 為 Cmd) 並點擊該網址，即可在瀏覽器中觀看互動裝置。

---

## 📂 系統架構簡述

- **感知層:** Webcam -> MediaPipe (特徵萃取)
- **運算層:** React 狀態管理 -> PixiJS 畫布渲染 (重力、水流扭曲、Metaball 運算)
- **表現層:** 直式顯示器 (高幀率流體展示) + 平板控制台 (使用者選詞與 3D 寶石觸發)

---

## 👥 開發團隊 (Team)

- **技術開發 (科技組):** [李柏融] - 負責物理引擎開發、架構設計與視覺辨識串接。
- **介面與視覺 (美術組):** [組員] - 負責 UI/UX 介面設計、3D 寶石建模與動畫呈現。
