// src/engine/ripple/RippleFilter_reveal.js
export const rippleFragSource = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;  // 🚨 PIXI 自動傳入的濾鏡底層影像 (包含純白背景與水底寶石)
uniform sampler2D uTextTex;  
uniform vec2 uResolution;
uniform vec4 uRipples[200];    

#define S smoothstep

void main() {
    vec2 uv = vTextureCoord;
    float aspect = uResolution.x / uResolution.y;
    
    vec2 circles = vec2(0.0);
    float revealMask = 0.0; 
    vec3 accumulatedColor = vec3(0.0); 
    
    float maxR = 6.0 / 35.0; 

    for (int i = 0; i < 200; i++) {
        float life = uRipples[i].z;
        if (life > 0.0 && life < 1.0) {
            float scale = max(uRipples[i].w, 0.1); 
            vec2 center = uRipples[i].xy;
            
            vec2 v_raw = (uv - center); 
            vec2 v = v_raw;
            v.x *= aspect; 
            v *= 35.0 / scale; 
            
            float t = life;
            float d = length(v) - 6.0 * t; 
            
            float h = 1e-3;
            float d1 = d - h;
            float d2 = d + h;
            
            float p1 = sin(40. * d1) * S(-0.6, -0.3, d1) * S(0., -0.3, d1);
            float p2 = sin(40. * d2) * S(-0.6, -0.3, d2) * S(0., -0.3, d2);
            
            circles += 0.5 * normalize(v) * ((p2 - p1) / (2. * h) * (1. - t) * (1. - t));
            
            vec2 textUV = ((v_raw / scale) / maxR) * vec2(aspect, 1.0) * 0.5 + vec2(0.5);
            float bounds = step(0.0, textUV.x) * step(textUV.x, 1.0) * step(0.0, textUV.y) * step(textUV.y, 1.0);
            
            vec4 texData = texture2D(uTextTex, textUV);
            
            float band = S(1.0, 0.0, abs(d));   
            float fade = 1.0 - S(0.5, 1.0, t);  
            
            float currentMask = texData.a * bounds * band * fade;
            
            revealMask += currentMask;
            accumulatedColor += texData.rgb * currentMask;
        }
    }
    
    vec3 n = vec3(circles, sqrt(max(0.0, 1. - dot(circles, circles))));
    vec3 shadowDir = normalize(vec3(-1.0, -1.0, 0.5));
    float shadow = pow(clamp(dot(n, shadowDir), 0.0, 1.0), 12.0);
    float edgeDarkening = (1.0 - n.z) * 0.18; 
    
    vec3 actualTexColor = accumulatedColor / max(revealMask, 0.0001);
    
    // 🚨 【核心修正】：讀取底層水池影像，並加入水波法線(circles)產生折射扭曲！
    vec2 distortedUV = uv + (circles * 0.04); 
    vec4 baseColor = texture2D(uSampler, distortedUV);
    
    // 讓文字顯影與水底影像混合
    vec3 flatSurfaceColor = mix(baseColor.rgb, actualTexColor, clamp(revealMask, 0.0, 1.0));
    vec3 finalColor = flatSurfaceColor - edgeDarkening - (shadow * 0.25);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;