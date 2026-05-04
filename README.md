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

本專案不僅包含前端 UI 介面，更實作了即時的物理運算與跨裝置視覺無縫接軌，以達到最真實的沉浸式互動：

1. **即時眼位動態生成 (Real-time Eye Tracking)**
   整合 MediaPipe 捕捉觀眾臉部特徵，將眼淚生成的初始座標 `(X, Y)` 精準綁定於使用者的眼眶下緣位置，隨觀者姿態即時連動。
2. **擬真 3D 物理演算引擎 (3D Particle Physics Engine)**
   全面改寫底層渲染邏輯，文字下落不再只是 2D 平移。我們導入了 Z 軸深度演算 (Virtual Depth)，依據距離賦予每個字元不同的縮放比例與下落加速度，並結合三角函數 (Sine/Cosine) 達成文字如落葉、櫻花般在空中 3D 翻轉與搖擺的細膩動態。
3. **跨螢幕物理接力與流體交互 (Cross-Screen Routing & Fluid Interaction)**
   開發無縫的雙螢幕傳輸協議。當文字實體掉出上方顯示器 (Monitor) 邊界時，程式會精準計算其落點座標與延遲影格，於平板端 (Tablet) 水池精準激起 WebGL 動態水波 (Ripples)；若文字砸中浮出水面的實體寶石，更會觸發具備重力加速度的拋物線水花濺射粒子 (Splash Particles)。
4. **序列圖動畫與 WebGL 折射渲染 (Sprite Sheet & WebGL Shader Rendering)**
   - **情緒權重演算**：根據使用者選出的 5 個情緒配方，動態計算權重並決定煉化出珍珠、鑽石、白水晶、蛋白石或青金石。
   - **效能最佳化渲染**：寶石動畫全面採用 JSON-TP-Hash 紋理打包技術 (Texture Packing)，將 60 幀高畫質動畫壓縮處理，確保行動裝置維持 60fps 流暢度。
   - **自定義著色器**：撰寫自定義 Fragment Shader，將水底寶石、波紋法線與水面文字進行像素級混合，達成極致逼真的「水底扭曲折射」與「破水而出」的雙圖層交叉淡入 (Crossfade) 視覺表現。

---

## 🚀 如何在本地端運行 (How to Run Locally)

**環境要求：** 請確保您的電腦已安裝 [Node.js](https://nodejs.org/zh-tw/) (建議安裝 LTS 版本)。

### 啟動步驟：

1. 複製專案：
   ```bash
   git clone https://github.com/你的GitHub帳號名稱/tearsPearls.git
   ```
2. 進入專案目錄 (重要)：
   ```bash
   cd tearsPearls
   ```
3. 安裝專案依賴套件：
   ```bash
   npm install
   ```
4. 啟動開發伺服器：
   ```bash
   npm run dev
   ```
5. 開始體驗：
   終端機會顯示一段 Local 網址（通常為 http://localhost:5173/），按住 Ctrl (Mac 為 Cmd) 並點擊該網址，即可在瀏覽器中觀看互動裝置。

---

## 📂 系統架構簡述

- **感知層:** Webcam -> MediaPipe (特徵萃取)
- **運算層:** React 狀態管理 -> PixiJS 畫布渲染 (重力、水流扭曲、Metaball 運算)
- **表現層:** 直式顯示器 (高幀率流體展示) + 平板控制台 (使用者選詞與 3D 寶石觸發)

---

## 🎨 寶石對應邏輯

| 寶石種類 (Gem Type) | 對應情緒詞組 (Corresponding Emotions) |
| :------------------ | :------------------------------------ |
| **珍珠 (Pearl)**    | 孤單、想念、失去、委屈                |
| **鑽石 (Diamond)**  | 責任、焦慮、壓力、自責                |
| **白水晶 (Quartz)** | 沒事、還好、無力、有點累              |
| **蛋白石 (Opal)**   | 說不出口、後悔、怎麼辦、捨不得        |
| **青金石 (Lapis)**  | 面子、期待、別丟臉、不能示弱          |

---

## 👥 開發團隊 (Team)

- **技術開發 (科技組):** [李柏融、許肇天] - 負責物理引擎開發、架構設計與視覺辨識串接。
- **介面與視覺 (美術組):** [余傑克、林昀佑、張庭毓、藍乙甄] - 負責 UI/UX 介面設計、3D 寶石建模與動畫呈現。
