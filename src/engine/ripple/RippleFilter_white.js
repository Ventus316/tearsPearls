// src/engine/ripple/RippleFilter.js
export const rippleFragSource = `
precision mediump float;
varying vec2 vTextureCoord;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uRipples[200];    

#define S smoothstep

void main() {
    vec2 uv = vTextureCoord;
    float aspect = uResolution.x / uResolution.y;
    
    vec2 circles = vec2(0.0);
    
    // 計算水波物理形狀
    for (int i = 0; i < 200; i++) {
        float life = uRipples[i].z;
        if (life > 0.0 && life < 1.0) {
            vec2 center = uRipples[i].xy;
            vec2 v = (center - uv);
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
        }
    }
    
    // 1. 計算 3D 法線 (Normal)
    vec3 n = vec3(circles, sqrt(max(0.0, 1. - dot(circles, circles))));
    
    // 2. 強制設定為純白背景 (RGB 1.0, 1.0, 1.0)
    vec3 bg = vec3(1.0);
    
    // 3. 微弱陰影 (Emboss Shadow)：模擬光源從左上方打來的背光面陰影
    vec3 shadowDir = normalize(vec3(-1.0, -1.0, 0.5));
    float shadow = pow(clamp(dot(n, shadowDir), 0.0, 1.0), 12.0);
    
    // 4. 邊緣折射暗角 (Edge Darkening)
    // 當水波表面越傾斜 (n.z 越小)，產生越明顯的灰色折射邊緣，這是刻畫透明玻璃感的關鍵
    float edgeDarkening = (1.0 - n.z) * 0.18; 
    
    // 5. 顏色組合：純白底色 - 折射暗角 - 實體陰影
    // 在白底上，只有減去顏色(變灰)才能被人眼辨識出形狀
    vec3 finalColor = bg - edgeDarkening - (shadow * 0.25);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;      