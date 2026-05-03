// src/engine/ripple/RippleFilter_reveal.js
export const rippleFragSource = `
// 📝 設定 GPU 浮點數精度為中等，平衡效能與畫質
precision mediump float;

// 📝 PIXI 傳入的當前像素座標 (0.0 ~ 1.0)
varying vec2 vTextureCoord;

// 📝 外部傳入的參數 (Uniforms)
uniform sampler2D uTextTex;  // 隱藏在水底的「文字/圖案紋理」[cite: 20]
uniform vec2 uResolution;    // 畫布解析度 (寬度, 高度)[cite: 20]
uniform float uTime;         // 全域時間 (通常用於連續動畫，但此處有其他機制)[cite: 20]
uniform vec3 uRipples[200];  // 200 滴水波的陣列資料：x 座標, y 座標, life (生命週期 0~1)[cite: 20]

// 📝 定義平滑過渡的巨集 (縮寫 smoothstep 為 S，讓程式碼更簡潔)[cite: 20]
#define S smoothstep

void main() {
    vec2 uv = vTextureCoord;
    // 計算螢幕長寬比，用來校正水波，確保它是正圓形而不是橢圓[cite: 20]
    float aspect = uResolution.x / uResolution.y;
    
    // 📝 累積變數初始化
    vec2 circles = vec2(0.0);       // 用來累積所有水波造成的「表面法線/法向量」偏移[cite: 20]
    float revealMask = 0.0;         // 用來累積文字的「透明度遮罩 (Alpha)」[cite: 20]
    
    // 【新增】用來儲存 PNG 圖片真實色彩的變數[cite: 20]
    vec3 accumulatedColor = vec3(0.0); // 累積文字/圖案的「真實 RGB 色彩」[cite: 20]
    
    float maxR = 6.0 / 35.0; // 計算圖片紋理映射的最大半徑比例[cite: 20]

    // 📝 迴圈處理每一滴水 (最多 200 滴)
    for (int i = 0; i < 200; i++) {
        float life = uRipples[i].z; // 取出第 i 滴水的生命週期 (t)[cite: 20]
        
        // 只處理「活著」的水波 (life 介於 0~1 之間)[cite: 20]
        if (life > 0.0 && life < 1.0) {
            vec2 center = uRipples[i].xy; // 取出水波中心點[cite: 20]
            
            // 計算當前像素與水波中心的距離向量[cite: 20]
            vec2 v_raw = (uv - center); 
            vec2 v = v_raw;
            v.x *= aspect; // 校正 X 軸的長寬比變形[cite: 20]
            
            v *= 35.0; // 放大座標系，控制水波的物理範圍比例[cite: 20]
            float t = life;
            
            // d: 當前像素與「水波波峰」的相對距離 (6.0 控制擴散速度)[cite: 20]
            float d = length(v) - 6.0 * t; 
            
            // 📝 計算水面起伏 (利用數學導數近似法)
            float h = 1e-3; // 微小偏移量[cite: 20]
            float d1 = d - h;
            float d2 = d + h;
            
            // 使用 sin() 產生波浪的起伏，並用 smoothstep 限制波浪只在特定範圍內產生[cite: 20]
            float p1 = sin(40. * d1) * S(-0.6, -0.3, d1) * S(0., -0.3, d1);
            float p2 = sin(40. * d2) * S(-0.6, -0.3, d2) * S(0., -0.3, d2);
            
            // 將這滴水的波浪起伏強度加入全域的 normals 累加器中
            // (1. - t) * (1. - t) 讓波浪隨著生命週期二次方衰減 (越來越平靜)[cite: 20]
            circles += 0.5 * normalize(v) * ((p2 - p1) / (2. * h) * (1. - t) * (1. - t));
            
            // 📝 圖片紋理映射 (Texture Mapping)
            // 將水波的座標系統反向映射回圖片的 UV 座標，確保圖案是跟著水面扭曲的[cite: 20]
            vec2 textUV = (v_raw / maxR) * vec2(aspect, 1.0) * 0.5 + vec2(0.5);
            // 裁切邊界：確保只讀取 0~1 範圍內的圖片，超出範圍的當作 0 (避免圖片重複平鋪)[cite: 20]
            float bounds = step(0.0, textUV.x) * step(textUV.x, 1.0) * step(0.0, textUV.y) * step(textUV.y, 1.0);
            
            // 【核心修正】：一次把形狀(a)跟顏色(rgb)都讀取出來[cite: 20]
            vec4 texData = texture2D(uTextTex, textUV);
            
            // 📝 顯影邏輯 (Reveal Logic)
            float band = S(1.0, 0.0, abs(d));   //控制波紋掃過時，文字顯影的寬度與柔和度 (1.0 越小光帶越細)[cite: 20]
            float fade = 1.0 - S(0.5, 1.0, t);  //控制水波在生命盡頭時，文字像煙霧般消散的效果 (最後 50% 開始淡出)[cite: 20]
            
            // 計算這一滴水貢獻的遮罩強度 (圖片本身的Alpha * 邊界 * 顯影寬帶 * 生命衰減)[cite: 20]
            float currentMask = texData.a * bounds * band * fade;
            
            // 累加遮罩強度，並同時累加「真實顏色」[cite: 20]
            revealMask += currentMask;
            accumulatedColor += texData.rgb * currentMask;
        }
    }
    
    // ==========================================
    // --- 基礎光影渲染 (Lighting & 3D Math) ---
    // ==========================================
    // 計算水波的 3D 法線 (表面起伏向量)，z 軸代表水面的高度[cite: 20]
    vec3 n = vec3(circles, sqrt(max(0.0, 1. - dot(circles, circles))));
    
    // 計算光影與暗角 (用來產生水波的立體感)
    // 假設有一道光從左上方 (-1.0, -1.0, 0.5) 照過來[cite: 20]
    vec3 shadowDir = normalize(vec3(-1.0, -1.0, 0.5));
    // 計算光線與水面法線的交角，並用 pow(12.0) 強化高光反差[cite: 20]
    float shadow = pow(clamp(dot(n, shadowDir), 0.0, 1.0), 12.0);
    // 邊緣暗角：水波越斜的地方 (n.z 越小)，顏色越暗[cite: 20]
    float edgeDarkening = (1.0 - n.z) * 0.18; 
    
    // 還原圖片的真實色彩 (將累加的顏色除以累加的 Alpha，避免疊加變白。加上 0.0001 防止除以零錯誤)[cite: 20]
    vec3 actualTexColor = accumulatedColor / max(revealMask, 0.0001);
    
    // ==========================================
    // 【核心圖層修正】：光影必須在最後加上去！[cite: 20]
    // ==========================================
    
    // 步驟 1：先決定「平面的水底」長什麼樣子 
    // 將純白底色 vec3(1.0) 與 讀取到的圖片色彩，依照計算出的顯影遮罩 (revealMask) 進行混合 (mix)[cite: 20]
    vec3 flatSurfaceColor = mix(vec3(1.0), actualTexColor, clamp(revealMask, 0.0, 1.0));
    
    // 步驟 2：在平面的水底之上，統一扣除水波的立體陰影與折射暗角
    // 這樣鑽石的身上也會吃到水波的明暗起伏，視覺上就會「沉入水底」！[cite: 20]
    vec3 finalColor = flatSurfaceColor - edgeDarkening - (shadow * 0.25);
    
    // 輸出最終像素顏色到螢幕[cite: 20]
    gl_FragColor = vec4(finalColor, 1.0);
}
`;