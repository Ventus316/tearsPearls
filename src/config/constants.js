// src/config/constants.js

// ==========================================
// 📝 基礎字詞庫
// ==========================================
// 當使用者沒有輸入詞彙，或進行預設展示時所使用的備用詞庫
export const WORDS = [
  '孤單', '想念', '失去', '委屈', '責任', 
  '焦慮', '壓力', '自責', '沒事', '還好', 
  '無力', '有點累', '說不出口', '後悔', '怎麼辦', 
  '捨不得', '面子', '期待', '別丟臉', '不能示弱'
];

// ==========================================
// 📏 實體尺寸與佈局換算
// ==========================================
// 根據實體尺寸 (顯示器 48.83x46.37, 平板 28.06x21.49) 換算的精確高度 (單位：像素 px)
export const MONITOR_H = 380;          // 上半部顯示器的高度
export const TABLET_H = 306;           // 下半部平板的高度
export const GAP_H = 50;               // 兩塊螢幕之間的實體間隙高度

export const TOTAL_H = MONITOR_H + GAP_H + TABLET_H; // PIXI 畫布的總高度
export const TABLET_START_Y = MONITOR_H + GAP_H;     // 下半部平板內容繪製的起始 Y 座標
export const VIRTUAL_H = MONITOR_H + TABLET_H;       // 用於計算深度與模糊的「有效視覺總高度」(不含間隙)

// ==========================================
// 🎨 色彩設定
// ==========================================
export const BG_COLOR = 0xE8E4D9;      // 預設背景顏色 (米白色)
export const TEXT_COLOR = 0x111315;    // 預設文字顏色 (深黑色)
export const BEZEL_COLOR = 0x1A1C20;   // 兩塊螢幕間隙(邊框)的遮罩顏色

// ==========================================
// 🔤 字體設定
// ==========================================
export const FONT_FAMILY = '"PingFang TC", "STKaiti", "KaiTi", serif'; // 文字掉落的字型順序
export const FONT_SIZE_BASE = 12;      // 基礎字體大小
export const TEXT_STROKE_WIDTH = 1;    // 文字的外框粗細 (用於增加辨識度)

// ==========================================
// ⏱️ 時間與延遲控制
// ==========================================
export const CRYING_DURATION = 15000;      // 「大哭」情緒爆發序列的持續總時間 (毫秒)
export const NETWORK_DELAY_FRAMES = 60;    // 文字從上半部消失到下半部出現之間的「網路傳輸/跨螢幕延遲」影格數

// ==========================================
// 💧 水波紋特效 (TabletController)
// ==========================================
export const DISPLACEMENT_STRENGTH = 12; // PIXI.DisplacementFilter 的扭曲強度 (數值越大水波越明顯)
export const WATER_SPEED_Y = 1.5;        // 水波紋貼圖在 Y 軸的垂直流動速度
export const WATER_SPEED_X = 0.3;        // 水波紋貼圖在 X 軸的水平流動速度

// ==========================================
// 👁️ 生成與基礎物理運動 (InkEngine)
// ==========================================
export const EYE_OFFSET = 22;            // 當無法抓取眼動追蹤資料時，預設雙眼生成點的 X 軸偏移量
export const WORD_SPAWN_INTERVAL = 12;   // 每個「字元」生成的間隔影格數 (控制打字/掉落節奏)
export const BASE_VELOCITY_X = 0.15;     // 文字生成的基礎隨機水平初速
export const SWAY_FREQUENCY = 0.05;      // 文字掉落時左右搖擺的正弦波頻率
export const SWAY_AMPLITUDE = 0.3;       // 文字掉落時左右搖擺的幅度

// ==========================================
// 🌫️ 景深與模糊淡出效果 (模擬掉入水中)
// ==========================================
export const FADE_START_RATIO = 0.70; // 螢幕深度的百分比(0~1)，文字到達此深度開始淡出
export const FADE_END_RATIO = 1.0;    // 文字到達此深度時會完全套用 MIN_ALPHA
export const MIN_ALPHA = 0.9;         // 文字掉到最底部的最低透明度
export const ALPHA_EASE = 0.15;       // 透明度漸變的平滑係數 (緩動)

export const BLUR_START_RATIO = 0.40; // 螢幕深度的百分比，文字到達此深度開始產生模糊
export const BLUR_MULTIPLIER = 10;    // 模糊效果的放大倍率

// ==========================================
// 🖋️ 墨跡拖尾系統 (Trail System)
// ==========================================
export const TRAIL_SPAWN_DENSITY = 5;                  // 拖尾生成的密度 (文字移動多少像素產生一個拖尾)
export const TRAIL_START_DEPTH = 0.2;                  // 螢幕深度的百分比，到達此深度才開始產生拖尾
export const TRAIL_SCALE_Y = 1.6;                      // 拖尾精靈在 Y 軸的初始拉伸比例
export const TRAIL_SCALE_X_BASE = 1.0;                 // 拖尾精靈在 X 軸的基礎比例
export const TRAIL_SCALE_X_DEPTH_MULTIPLIER = 0.5;     // 根據掉落深度增加 X 軸寬度的乘數 (越深越寬)
export const TRAIL_INITIAL_BLUR_MULTIPLIER = 8;        // 拖尾剛生成時的模糊強度
export const TRAIL_BASE_ALPHA = 0.1;                   // 拖尾的基礎透明度 (極淡)
export const TRAIL_DEPTH_ALPHA_MULTIPLIER = 0.4;       // 根據深度增加透明度的乘數
export const TRAIL_EXPAND_SPEED_Y = 0.002;             // 拖尾在 Y 軸持續擴散(拉長)的速度
export const TRAIL_BLUR_INCREASE_RATE = 0.2;           // 拖尾模糊度隨時間增加的速率
export const TRAIL_GRAVITY_MULTIPLIER = 0.6;           // 拖尾下沉的速度係數 (通常比本體慢，產生殘影感)

// ==========================================
// 💎 寶石匯聚系統 (Convergence Phase)
// ==========================================
export const CONVERGE_SPEED_MOVE = 0.01;    // 文字被吸附往寶石中心移動的速度係數
export const CONVERGE_SPEED_ALPHA = 0.92;   // 匯聚過程中透明度遞減的乘數 (越接近中心越透明)
export const CONVERGE_SPEED_SCALE = 0.97;   // 匯聚過程中縮小的乘數
export const CONVERGE_BOTTOM_OFFSET = 30;   // 寶石引力中心點距離平板底部的 Y 軸偏移量
export const CONVERGE_FADE_HEIGHT = 150;    // 距離底部多少像素時，開始執行強制的 Alpha 淡出與縮小

// ==========================================
// ✨ 寶石與情緒對應字典 (心理測驗分類)
// ==========================================
// 將使用者輸入的詞彙對應到五種不同的寶石型態
export const GEM_MAPPING = {
  pearl: ['孤單', '想念', '失去', '委屈'],         // 珍珠：悲傷與失落
  diamond: ['責任', '焦慮', '壓力', '自責'],       // 鑽石：重擔與自我要求
  quartz: ['沒事', '還好', '無力', '有點累'],       // 白水晶：疲憊與壓抑
  opal: ['說不出口', '後悔', '怎麼辦', '捨不得'],  // 蛋白石：迷惘與糾結
  lapis: ['面子', '期待', '別丟臉', '不能示弱']    // 青金石：武裝與自尊
};