# 💧 心之結晶- Interactive Digital Art Installation

「你的感性，是你最寶貴的收藏。」

**心之結晶** 是一套雙螢幕互動藝術裝置，利用電腦視覺與實時物理模擬，將使用者的情緒選詞轉化為視覺化的「淚水」，在顯示器上進行 3D 物理演算，並最終在平板控制端結晶為獨特的礦石。本專案旨在探索人類情緒與數位互動之間的張力，並實現跨裝置的無縫體驗。

## 🛠️ 技術棧 (Tech Stack)

- **前端開發**: React (Vite)
- **互動渲染引擎**: PixiJS (WebGL)
- **物理與動畫**: GSAP
- **電腦視覺 (AI)**: Google MediaPipe (Face Landmarker)
- **即時通訊**: Socket.io (Node.js)
- **樣式排版**: Tailwind CSS

## 💡 核心技術架構 (Technical Highlights)

本專案採用 **"Display-Controller" 雙螢幕同步架構**，透過 Socket.io 建立低延遲的事件中轉 。

### 1. 即時臉部特徵映射 (Real-time Face Tracking)

整合 **MediaPipe Face Landmarker**，捕捉使用者眼部特徵點 。系統將眼淚生成的初始座標 `(X, Y)` 精準綁定於眼眶下緣，確保虛擬淚水與現實中的觀者動態連動 。

### 2. Z-軸深度模擬物理引擎 (3D Physics Engine)

跳脫傳統 2D 平移，我們開發了基於 **Virtual Depth (Z-axis)** 的物理演算 。每個淚珠字元擁有獨立的加速度、旋轉與縮放係數，結合三角函數 (Sine/Cosine) 模擬落葉般的 3D 漂浮路徑 。

### 3. 跨裝置流體交互協議 (Cross-Screen Fluid Interaction)

當文字越過顯示器邊界 (Monitor)，系統計算其座標與速度，透過 Socket.io 觸發平板端 (Tablet) 的 WebGL 水波特效 。若字元與螢幕中央的寶石發生碰撞，將觸發拋物線水花粒子效果 (Splash Particles) 。

### 4. 效能優化 (Rendering Performance)

- **Texture Packing**: 寶石與詞彙動畫全面採用 JSON-Texture-Hash 紋理打包技術，確保在各類行動裝置上維持 60fps 流暢體驗 。
- **UV Displacement**: 利用 SVG Displacement Map 實現大螢幕待機圖層的「流動呼吸感」，極大化沉浸式體驗 。

## 🎨 互動設計 (Interaction Design)

本裝置的核心機制在於將使用者的情緒詞彙進行權重加總，並即時煉化為獨特的寶石結晶。我們建立了以下情緒對應字典，確保每一次互動體驗都帶有個人色彩：

| 寶石種類 (Gem Type) | 對應情緒詞組 (Corresponding Emotions) |
| :------------------ | :------------------------------------ |
| **珍珠 (Pearl)**    | 孤單、想念、失去、委屈                |
| **鑽石 (Diamond)**  | 責任、焦慮、壓力、自責                |
| **白水晶 (Quartz)** | 沒事、還好、無力、有點累              |
| **蛋白石 (Opal)**   | 說不出口、後悔、怎麼辦、捨不得        |
| **青金石 (Lapis)**  | 面子、期待、別丟臉、不能示弱          |

## 📂 系統架構目錄 (Directory Structure)

tearsPearls/
├── 📂 public/ # 靜態資源 (素材紋理、JSON)
├── 📂 src/
│ ├── 📂 engine/ # PIXI.js 互動渲染邏輯 (物理、控制、粒子系統)
│ ├── 📂 views/ # React UI 介面 (Monitor/Tablet 視圖)
│ ├── 📂 config/ # 全域參數與情緒對應字典
│ └── 📄 App.jsx # 路由分發器 (Router)
├── 📄 server.js # Socket.io 通訊中樞 (事件中轉)
└── 📄 vite.config.js # 建置設定

## 🚀 部署與運行 (How to Run)

### 環境需求

- Node.js (LTS 版本)
- 具備 WebCam 的電腦 (顯示器端)

### 安裝步驟

1.  **Clone 專案**:

```bash
git clone https://github.com/Ventus316/tearsPearls.git
```

2.  **安裝依賴**:

```bash
npm install
```

3. **設定伺服器 IP**:

```bash
修改 `src/views/MonitorView.jsx` 與 `src/views/TabletView.jsx` 中的 `SERVER_IP` 為你的區域網路 IP 。
```

> **💡 如何查詢你的 IP？**
> **Windows**: 開啟終端機輸入 `ipconfig`，查看「IPv4 位址」。
> **Mac/Linux**: 開啟終端機輸入 `ifconfig` 或 `ipconfig getifaddr en0`。

4. **啟動後端通訊伺服器 (Terminal 1)**:

請在終端機 (Terminal) 中執行以下指令，確保 Socket.io 伺服器已啟動並監聽 3000 Port：

```bash
node server.js
```

5. **啟動前端開發伺服器 (Terminal 2)**:

請開啟**另一個**新的終端機視窗，執行以下指令啟動 Vite 開發伺服器：

```bash
npm run dev
```

### 🌐 存取應用程式

啟動伺服器後，請於瀏覽器輸入以下對應網址：

| 設備類型             | 存取網址                               |
| :------------------- | :------------------------------------- |
| **顯示器 (Monitor)** | `http://<你的區域網路IP>:5173/monitor` |
| **平板 (Tablet)**    | `http://<你的區域網路IP>:5173/tablet`  |

> **⚠️ 注意事項：**
>
> 1. 請將 `<你的區域網路IP>` 替換為執行專案之電腦的實際 IP (例如：`192.168.1.50`)。
> 2. 請確保所有裝置皆連線至**同一個區域網路 (Wi-Fi)**。

## 👥 開發團隊 (Credits)

本專案由 [Yuan Ze University - Department of Information and Communication] 團隊開發:

- **技術開發**: 李柏融、許肇天
- **介面與視覺**: 余傑克、林昀佑、張庭毓、藍乙甄
