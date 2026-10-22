// ==========================================
// main.js - Three.js 初始化、UI、HUD 與核心遊戲循環
// ==========================================
import {
    TRACK_REAL_LENGTH,
    LANDMARKS,
    trackSamples,
    buildTrack,
    updateLighthouseBeacon,
    setLighthouseBeaconNight,
    setStreetLightsEnabled,
    updateStreetLampLighting
} from './track.js';
import {
    gameState,
    initPlayer,
    updatePlayer
} from './player.js';

const THREE = window.THREE;

// ==========================================
// 1. 初始化 Three.js 場景、相機與燈光
// ==========================================
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7dd3fc); // 澳門晴朗天空藍
scene.fog = new THREE.FogExp2(0xbae6fd, 0.0028);

// 漸層天空穹頂（頂部與地平線顏色會跟隨時段變化）
const skyUniforms = {
    topColor: { value: new THREE.Color(0x4aa3df) },
    bottomColor: { value: new THREE.Color(0xcfeeff) }
};
const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.ShaderMaterial({
        uniforms: skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition).y;
                float t = smoothstep(-0.08, 0.62, h);
                gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
            }
        `
    })
);
sky.frustumCulled = false;
sky.renderOrder = -10;
scene.add(sky);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);

// 環境光與陽光
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3f6212, 0.75);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.08);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xfffbeb, 0.95);
dirLight.position.set(80, 140, 60);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 10;
dirLight.shadow.camera.far = 350;
dirLight.shadow.radius = 2.5;
dirLight.shadow.bias = -0.0004;
const d = 140;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

// 夜空星星與月亮（夜間模式才顯示）
const starPositions = [];
for (let i = 0; i < 520; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.15 + Math.random() * 0.85);
    const radius = 380;
    starPositions.push(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius + 60,
        Math.sin(phi) * Math.sin(theta) * radius
    );
}
const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true, opacity: 0.9, fog: false })
);
stars.visible = false;
scene.add(stars);

const moon = new THREE.Mesh(
    new THREE.SphereGeometry(8, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe, fog: false })
);
moon.position.set(-180, 230, -260);
moon.visible = false;
scene.add(moon);

const TIME_PRESETS = {
    morning: {
        label: "🌅 早晨",
        background: 0x7dd3fc,
        skyTop: 0x2f80c9,
        skyBottom: 0xd7f1ff,
        fog: 0xbae6fd,
        fogDensity: 0.0028,
        hemiSky: 0xffffff,
        hemiGround: 0x3f6212,
        hemiIntensity: 0.7,
        ambient: 0.06,
        sunColor: 0xfffbeb,
        sunIntensity: 0.95,
        sunPos: [80, 140, 60],
        night: false,
        toast: "🌅 早晨：陽光灑落松山"
    },
    sunset: {
        label: "🌇 黃昏",
        background: 0xfca5a5,
        skyTop: 0x54235f,
        skyBottom: 0xffb36b,
        fog: 0xfdba74,
        fogDensity: 0.0034,
        hemiSky: 0xffd7a8,
        hemiGround: 0x7c2d12,
        hemiIntensity: 0.55,
        ambient: 0.08,
        sunColor: 0xff8a50,
        sunIntensity: 1.15,
        sunPos: [-90, 55, 20],
        night: false,
        toast: "🌇 黃昏：松山日落時分"
    },
    night: {
        label: "🌙 夜晚",
        background: 0x08111f,
        skyTop: 0x020617,
        skyBottom: 0x172554,
        fog: 0x0f172a,
        fogDensity: 0.0045,
        hemiSky: 0x93c5fd,
        hemiGround: 0x0f172a,
        hemiIntensity: 0.28,
        ambient: 0.035,
        sunColor: 0x93c5fd,
        sunIntensity: 0.38,
        sunPos: [-70, 110, -60],
        night: true,
        toast: "🌙 夜晚：路燈與燈塔射燈已開啟"
    }
};

let timeMode = "morning";
function applyTimeOfDay(mode, announce = false) {
    const preset = TIME_PRESETS[mode] || TIME_PRESETS.morning;
    timeMode = mode;
    scene.background.setHex(preset.background);
    skyUniforms.topColor.value.setHex(preset.skyTop);
    skyUniforms.bottomColor.value.setHex(preset.skyBottom);
    scene.fog.color.setHex(preset.fog);
    scene.fog.density = preset.fogDensity;
    hemiLight.color.setHex(preset.hemiSky);
    hemiLight.groundColor.setHex(preset.hemiGround);
    hemiLight.intensity = preset.hemiIntensity;
    ambientLight.intensity = preset.ambient;
    dirLight.color.setHex(preset.sunColor);
    dirLight.intensity = preset.sunIntensity;
    dirLight.position.set(...preset.sunPos);
    stars.visible = preset.night;
    moon.visible = preset.night;
    setStreetLightsEnabled(preset.night);
    setLighthouseBeaconNight(preset.night);
    const button = document.getElementById('time-btn');
    if (button) button.textContent = preset.label;
    if (announce) showToast(preset.toast, "bg-indigo-600/95 border-indigo-300");
}

// ==========================================
// 2. 建立跑道、環境與跑手
// ==========================================
buildTrack(scene);

// 浮動提示訊息輔助函式
let toastTimeout = null;
function showToast(text, colorClasses = "bg-emerald-600/95 border-emerald-300") {
    const toast = document.getElementById('toast-msg');
    const content = document.getElementById('toast-content');
    content.textContent = text;
    content.className = `inline-block text-white text-xs sm:text-sm font-bold px-4 py-1.5 rounded-full shadow-lg border ${colorClasses}`;
    toast.style.opacity = '1';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
    }, 2200);
}

// 街坊對白字幕
let subtitleTimeout = null;
function showSubtitle(text) {
    const bubble = document.getElementById('npc-subtitle');
    const content = document.getElementById('npc-subtitle-text');
    if (!bubble || !content) return;
    content.textContent = text;
    bubble.style.opacity = '1';
    clearTimeout(subtitleTimeout);
    subtitleTimeout = setTimeout(() => {
        bubble.style.opacity = '0';
    }, 2600);
}

const { player } = initPlayer(scene, { showToast, showSubtitle });

// 初始時段
applyTimeOfDay("morning");

// ==========================================
// 3. 按鈕與彈窗事件
// ==========================================
document.getElementById('camera-btn').addEventListener('click', () => {
    gameState.cameraMode = (gameState.cameraMode + 1) % 3;
    const modeNames = ["標準跟隨視角", "全景鳥瞰視角", "貼地競速視角"];
    showToast(`📷 已切換至：${modeNames[gameState.cameraMode]}`, "bg-slate-800/95 border-slate-400");
});

const introModal = document.getElementById('intro-modal');
document.getElementById('help-btn').addEventListener('click', () => {
    introModal.classList.remove('hidden');
    gameState.isRunning = false;
});

// 早晨 → 黃昏 → 夜晚
const TIME_MODES = ["morning", "sunset", "night"];
document.getElementById('time-btn').addEventListener('click', () => {
    const currentIndex = TIME_MODES.indexOf(timeMode);
    const nextMode = TIME_MODES[(currentIndex + 1) % TIME_MODES.length];
    applyTimeOfDay(nextMode, true);
});

document.getElementById('start-game-btn').addEventListener('click', () => {
    introModal.classList.add('hidden');
    if (!gameState.lapStartTime) {
        gameState.lapStartTime = performance.now();
    }
    gameState.isRunning = true;
});

// ==========================================
// 4. 繪製右上角松山環山小地圖 (Mini-map)
// ==========================================
const minimapCanvas = document.getElementById('minimap-canvas');
const mmCtx = minimapCanvas.getContext('2d');

function renderMinimap(playerPos) {
    mmCtx.clearRect(0, 0, 84, 84);
    const scale = 0.28;
    const cx = 42;
    const cy = 42;

    // 畫環山跑道線
    mmCtx.beginPath();
    for (let i = 0; i < trackSamples.length; i += 4) {
        const p = trackSamples[i].point;
        const x = cx + p.x * scale;
        const y = cy + p.z * scale;
        if (i === 0) mmCtx.moveTo(x, y);
        else mmCtx.lineTo(x, y);
    }
    mmCtx.closePath();
    mmCtx.strokeStyle = "rgba(148, 163, 184, 0.55)";
    mmCtx.lineWidth = 4;
    mmCtx.stroke();

    // 起點標記
    const sp = trackSamples[0].point;
    mmCtx.fillStyle = "#10b981";
    mmCtx.beginPath();
    mmCtx.arc(cx + sp.x * scale, cy + sp.z * scale, 3.5, 0, Math.PI * 2);
    mmCtx.fill();

    // 玩家目前位置紅黃亮點
    mmCtx.fillStyle = "#f59e0b";
    mmCtx.beginPath();
    mmCtx.arc(cx + playerPos.x * scale, cy + playerPos.z * scale, 4.5, 0, Math.PI * 2);
    mmCtx.fill();
    mmCtx.strokeStyle = "#ffffff";
    mmCtx.lineWidth = 1.5;
    mmCtx.stroke();
}

// ==========================================
// 5. HUD 更新
// ==========================================
function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1);
    return `${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}

function updateHUD({ slopeY, lapCompleted }) {
    document.getElementById('speed-val').textContent = gameState.speed.toFixed(1);
    const distMeters = Math.floor(gameState.trackProgress * TRACK_REAL_LENGTH);
    document.getElementById('dist-val').textContent = distMeters;
    document.getElementById('dist-bar').style.width = `${(gameState.trackProgress * 100).toFixed(1)}%`;
    document.getElementById('lap-count').textContent = `第 ${gameState.lapCount} 圈`;

    const elapsedSec = (performance.now() - gameState.lapStartTime) / 1000;
    document.getElementById('timer-val').textContent = formatTime(elapsedSec);

    document.getElementById('stamina-bar').style.width = `${gameState.stamina.toFixed(0)}%`;
    document.getElementById('stamina-text').textContent = `${gameState.stamina.toFixed(0)}%`;

    // 坡度文字提示
    const slopeEl = document.getElementById('slope-indicator');
    if (slopeY > 0.025) {
        slopeEl.textContent = "🔼 上斜路段 (耗力)";
        slopeEl.className = "text-[11px] text-amber-300 mt-1 font-bold";
    } else if (slopeY < -0.025) {
        slopeEl.textContent = "🔽 落斜路段 (加速)";
        slopeEl.className = "text-[11px] text-emerald-300 mt-1 font-bold";
    } else {
        slopeEl.textContent = "➡️ 林蔭平路";
        slopeEl.className = "text-[11px] text-slate-300 mt-1 font-medium";
    }

    // 更新目前所在松山地標名稱
    for (const lm of LANDMARKS) {
        if (gameState.trackProgress >= lm.start && gameState.trackProgress < lm.end) {
            document.getElementById('landmark-name').textContent = lm.name;
            document.getElementById('landmark-desc').textContent = lm.desc;
            break;
        }
    }

    // 完成一圈的提示與最佳成績
    if (lapCompleted) {
        if (lapCompleted.isBest) {
            const badge = document.getElementById('best-lap-badge');
            badge.textContent = `最佳: ${formatTime(lapCompleted.lapTime)}`;
            badge.classList.remove('hidden');
        }
        showToast(
            `🎉 完成第 ${lapCompleted.lapNumber} 圈松山跑道！用時 ${formatTime(lapCompleted.lapTime)}`,
            "bg-amber-500/95 border-amber-200"
        );
    }
}

// ==========================================
// 6. 第三人稱跟隨鏡頭
// ==========================================
function updateCamera(dt) {
    const camPresets = [
        { dist: 6.8, height: 3.3, lookAhead: 4.5 }, // 0: 標準賽車視角
        { dist: 13.5, height: 7.5, lookAhead: 6.0 }, // 1: 遠景地標視角
        { dist: 4.5, height: 2.1, lookAhead: 6.5 }  // 2: 近距離衝刺視角
    ];
    const preset = camPresets[gameState.cameraMode];

    const backward = new THREE.Vector3(
        -Math.sin(gameState.headingAngle),
        0,
        -Math.cos(gameState.headingAngle)
    );

    const desiredCamPos = player.group.position.clone()
        .addScaledVector(backward, preset.dist)
        .add(new THREE.Vector3(0, preset.height, 0));

    camera.position.lerp(desiredCamPos, Math.min(1, dt * 8.5));

    const lookTarget = player.group.position.clone().add(
        new THREE.Vector3(
            Math.sin(gameState.headingAngle) * preset.lookAhead,
            1.6,
            Math.cos(gameState.headingAngle) * preset.lookAhead
        )
    );
    camera.lookAt(lookTarget);
}

// ==========================================
// 7. 主遊戲循環
// ==========================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const frame = updatePlayer(dt);

    // 更新 Mixamo 跑步動畫（AnimationMixer）
    if (player.mixer) player.mixer.update(dt);

    // 夜間路燈照明跟隨玩家最近的一盞燈
    updateStreetLampLighting(player.group.position);

    // 燈塔探照燈持續 360° 旋轉（即使暫停亦保持運作）
    updateLighthouseBeacon(dt);
    updateCamera(dt);

    if (frame) {
        updateHUD(frame);
        renderMinimap(player.group.position);
    }

    renderer.render(scene, camera);
}

// 視窗大小改變自適應
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 啟動遊戲渲染循環
window.addEventListener('load', () => {
    renderMinimap(player.group.position);
    animate();
});
