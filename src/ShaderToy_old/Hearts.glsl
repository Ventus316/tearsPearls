#define S smoothstep
#define HEART_COLOR_F vec3(1.0,.05,0.05)
#define HEART_COLOR_B vec3(1.0,0.25,0.25)
#define BG_COLOR vec3(0.5,0.05,0.05)
#define T (iTime)
#define NB_HEARTS 50.0

mat2 Rot(float angle){
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c,-s,s,c);
}

float smax(float a, float b, float k){
    float h = clamp((b-a)/k+0.5, 0., 1.);
    return mix(a, b, h) + h*(1.0-h)*k*0.5;
}

vec4 Heart(vec2 uv, float radius, float blur){
    float angle = sin(iTime*0.1)*0.25;    
    blur *= radius;
    uv -= vec2(0.0,-radius);
    uv *= Rot(angle*length(uv)*2.);
    uv -= vec2(0.0,+radius);
    uv.x *= 0.7;
    uv.y -= smax(sqrt(abs(uv.x))*.5, blur, 0.1) -.1 - blur*0.5;
    float d = length(uv);
    float c = S(radius+blur,radius-blur-0.01,d);
    return vec4(vec3(1),c);
}

vec3 Transform(vec3 p, float a){
    p.xz *= Rot(a);
    p.xy *= Rot(a*0.765);
    return p;
}

vec4 HeartBall(vec3 ro, vec3 rd, vec3 pos, float radius, float angle, float blur){

    vec4 col = vec4(0);
    float t  = dot(pos-ro, rd);
    vec3  p  = ro + rd*t;
    float y  = length(pos-p);    
    if (y<1.0){
        float x = sqrt(1.0-y);
        vec3 pF = ro + rd*(t-x) - pos;         // front intersection
        vec3 pB = ro + rd*(t+x) - pos;         // back intersection
        pF = Transform(pF,angle);
        pB = Transform(pB,angle);    
        vec2 uvF = vec2(atan(pF.x,pF.z),pF.y);
        vec2 uvB = vec2(atan(pB.x,pB.z),pB.y);
        vec4 front = Heart(uvF, radius, blur);
        vec4 back = Heart(uvB, radius, blur);
        front.xyz *= HEART_COLOR_F;
        back.xyz  *= HEART_COLOR_B;
        col = mix(back, front, front.a) ;
    }
    return col;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Get coords normallized according to Y resolution. Screen displays uv between -1/+1  
    vec2 uv = (fragCoord-iResolution.xy*0.5)/iResolution.y;

    // Mouse vector
    vec2 M = iMouse.xy/iResolution.xy;

    // output color
    vec3 bg = BG_COLOR*(uv.y+1.0);
    vec4 col = vec4(bg,1.0);
    vec3 ro = vec3(0,0,-4);
    vec3 rd = normalize(vec3(uv,1));
    
    for(float i=0.0; i<1.0 ; i+=1.0/NB_HEARTS){
        float x = mix(-4.0, 4.0, fract(sin(i*735.25)*457.56));
        float y = mix(-5.0,5.0,fract(i-T*0.1));
        float z = mix(3.0, 0.0, i);
        float radius = S(3.0,0.0,z)*0.3+0.3 ;
        float angle = T+i*985.989;
        // blur in the background / Blur in the foreground 
        float blur = S(0.25,0.75,abs(z-1.5))/4.0;
        vec3 pos = vec3(x,y,z);
        vec4 heart = HeartBall(ro, rd, pos, radius, angle, blur); 
        //heart.xyz = vec3(abs(1.5-z)/1.5 );
        col = mix(col, heart, heart.a);
    }

    fragColor = col;
    
}