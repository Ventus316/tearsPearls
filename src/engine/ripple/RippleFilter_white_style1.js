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
            
            // 【除蟲關鍵 4】：因為 JS 端改為純白字體，直接讀取 r 通道作為形狀，100% 避開透明度錯誤
            float textShape = texture2D(uTextTex, textUV).r * bounds;
            
            // 【優化】：將波紋顯影寬度從 1.5 加粗為 3.0，讓文字出現得更明顯
            float band = S(3.0, 0.0, abs(d)); 
            
            float fade = 1.0 - S(0.7, 1.0, t);
            
            revealMask += textShape * band * fade;
        }
    }
    
    vec3 n = vec3(circles, sqrt(max(0.0, 1. - dot(circles, circles))));
    vec3 bg = vec3(1.0); 
    vec3 shadowDir = normalize(vec3(-1.0, -1.0, 0.5));
    float shadow = pow(clamp(dot(n, shadowDir), 0.0, 1.0), 12.0);
    float edgeDarkening = (1.0 - n.z) * 0.18; 
    vec3 baseWaterColor = bg - edgeDarkening - (shadow * 0.25);
    
    vec3 textColor = vec3(0.08, 0.1, 0.15); 
    
    vec3 finalColor = mix(baseWaterColor, textColor, clamp(revealMask, 0.0, 1.0));
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`