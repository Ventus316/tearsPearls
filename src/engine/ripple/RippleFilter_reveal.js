// src/engine/ripple/RippleFilter_reveal.js
export const rippleFragSource = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uTextTex;  
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uRipples[200];    

#define S smoothstep

void main() {
    vec2 uv = vTextureCoord;
    float aspect = uResolution.x / uResolution.y;
    
    vec2 circles = vec2(0.0);
    float revealMask = 0.0; 
    
    // 【新增】用來儲存 PNG 圖片真實色彩的變數
    vec3 accumulatedColor = vec3(0.0); 
    
    float maxR = 6.0 / 35.0; 

    for (int i = 0; i < 200; i++) {
        float life = uRipples[i].z;
        if (life > 0.0 && life < 1.0) {
            vec2 center = uRipples[i].xy;
            
            vec2 v_raw = (uv - center); 
            vec2 v = v_raw;
            v.x *= aspect; 
            
            v *= 35.0; 
            float t = life;
            float d = length(v) - 6.0 * t; 
            
            float h = 1e-3;
            float d1 = d - h;
            float d2 = d + h;
            
            float p1 = sin(40. * d1) * S(-0.6, -0.3, d1) * S(0., -0.3, d1);
            float p2 = sin(40. * d2) * S(-0.6, -0.3, d2) * S(0., -0.3, d2);
            
            circles += 0.5 * normalize(v) * ((p2 - p1) / (2. * h) * (1. - t) * (1. - t));
            
            vec2 textUV = (v_raw / maxR) * vec2(aspect, 1.0) * 0.5 + vec2(0.5);
            float bounds = step(0.0, textUV.x) * step(textUV.x, 1.0) * step(0.0, textUV.y) * step(textUV.y, 1.0);
            
            // 【核心修正】：一次把形狀(a)跟顏色(rgb)都讀取出來
            vec4 texData = texture2D(uTextTex, textUV);
            
            float band = S(1.0, 0.0, abs(d));   //控制波紋掃過時，文字顯影的寬度與柔和度
            float fade = 1.0 - S(0.5, 1.0, t);  //控制水波在生命盡頭時，文字像煙霧般消散的效果
            
            // 計算這一滴水貢獻的遮罩強度
            float currentMask = texData.a * bounds * band * fade;
            
            // 累加遮罩強度，並同時累加「真實顏色」
            revealMask += currentMask;
            accumulatedColor += texData.rgb * currentMask;
        }
    }
    
    // --- 基礎光影渲染 ---
    // 計算水波的 3D 法線 (表面起伏)
    vec3 n = vec3(circles, sqrt(max(0.0, 1. - dot(circles, circles))));
    
    // 計算光影與暗角 (用來產生水波的立體感)
    vec3 shadowDir = normalize(vec3(-1.0, -1.0, 0.5));
    float shadow = pow(clamp(dot(n, shadowDir), 0.0, 1.0), 12.0);
    float edgeDarkening = (1.0 - n.z) * 0.18; 
    
    // 還原圖片的真實色彩
    vec3 actualTexColor = accumulatedColor / max(revealMask, 0.0001);
    
    // ==========================================
    // 【核心圖層修正】：光影必須在最後加上去！
    // ==========================================
    
    // 步驟 1：先決定「平面的水底」長什麼樣子 (純白底色 + 鑽石圖案)
    vec3 flatSurfaceColor = mix(vec3(1.0), actualTexColor, clamp(revealMask, 0.0, 1.0));
    
    // 步驟 2：在平面的水底之上，統一扣除水波的立體陰影與折射暗角
    // 這樣鑽石的身上也會吃到水波的明暗起伏，視覺上就會「沉入水底」！
    vec3 finalColor = flatSurfaceColor - edgeDarkening - (shadow * 0.25);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;