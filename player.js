// ==========================================
// player.js - 跑手控制與物理
// ==========================================
import {
    trackSamples,
    getClosestTrackSample,
    ROAD_WIDTH,
    TRACK_POINTS_COUNT,
    WORLD_SCALE,
    GUIA_HILL_CENTER
} from './track.js';
import { audio } from './audio.js';

const THREE = window.THREE;

// 街坊對白觸發距離：10 米（GPX 世界比例為 1 單位 = 2.5 米）
const NPC_SUBTITLE_RANGE = 10 * WORLD_SCALE;
const NPC_COLLISION_RADIUS = 1.15;
const NPC_DIALOGUE = [
    "借過借過！",
    "唔該借借！",
    "小心啲行呀！",
    "早晨！慢慢跑啦～",
    "前面有石級，睇路呀！",
    "松山空氣真係好！",
    "喂，跑慢啲啦！",
    "一齊行松山，健康啲！",
    "唔好撞到人呀！",
    "借歪少少唔該！"
];

// ==========================================
// 1. 玩家狀態與操控參數
// ==========================================
export const gameState = {
    isRunning: false,
    speed: 10.5,          // 目前時速 km/h
    baseSpeed: 11.5,      // 正常巡航配速
    maxSprintSpeed: 21.0, // 衝刺最高時速
    stamina: 100,         // 體力 0-100
    steerInput: 0,        // 轉向輸入 (-1 左 至 +1 右)
    isSprinting: false,   // 是否按住衝刺
    headingAngle: 0,      // 跑手目前面向的世界角度 (弧度)
    trackProgress: 0,     // 0.0 ~ 1.0 沿跑道進度
    lapCount: 1,
    lapStartTime: 0,
    currentLapTime: 0,
    bestLapTime: null,
    cameraMode: 0,        // 0: 標準追尾, 1: 遠景鳥瞰, 2: 近距離動感
    slopeFactor: 0        // 當前坡度 (-1 下坡 ~ +1 上坡)
};

const keys = { left: false, right: false, sprint: false };
let joystickSteer = 0;
let touchButtonSteer = 0;
let sprintBtnPressed = false;

export let player = null;
export const waterBottles = [];
export const npcs = [];

let notify = () => {};
let notifySubtitle = () => {};
let npcBumpCooldown = 0;
let wasSprinting = false;

// ==========================================
// 2. 建立關節動畫跑手角色 (玩家 + 街坊 NPC)
// ==========================================
function createRunnerCharacter(shirtColor = 0x10b981, shortsColor = 0x1e293b, scale = 1.0) {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfdba74 });
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const shortsMat = new THREE.MeshLambertMaterial({ color: shortsColor });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x18181b });

    // 軀幹
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.35), shirtMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    group.add(torso);

    // 頭部 + 運動頭帶
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skinMat);
    head.position.y = 2.05;
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.48), hairMat);
    hair.position.y = 2.25;
    group.add(head, hair);

    // 四肢關節樞紐
    function makeLimb(w, h, d, mat, x, y) {
        const pivot = new THREE.Group();
        pivot.position.set(x, y, 0);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.y = -h / 2;
        mesh.castShadow = true;
        pivot.add(mesh);
        group.add(pivot);
        return pivot;
    }

    const leftArm = makeLimb(0.2, 0.7, 0.2, skinMat, -0.45, 1.7);
    const rightArm = makeLimb(0.2, 0.7, 0.2, skinMat, 0.45, 1.7);
    const leftLeg = makeLimb(0.25, 0.85, 0.25, shortsMat, -0.18, 0.9);
    const rightLeg = makeLimb(0.25, 0.85, 0.25, shortsMat, 0.18, 0.9);

    group.scale.set(scale, scale, scale);
    return { group, leftArm, rightArm, leftLeg, rightLeg, animPhase: Math.random() * 10 };
}

// 建立方塊跑手作載入期間／失敗時的備援
function attachFallbackPlayer() {
    const fallback = createRunnerCharacter(0xf59e0b, 0x0f172a, 1.05);
    player.fallbackGroup = fallback.group;
    player.leftArm = fallback.leftArm;
    player.rightArm = fallback.rightArm;
    player.leftLeg = fallback.leftLeg;
    player.rightLeg = fallback.rightLeg;
    player.animPhase = fallback.animPhase;
    player.isMixamo = false;
    player.group.add(fallback.group);
}

// 載入 Mixamo runner.fbx，取代方塊跑手
function loadRunnerFbx() {
    if (!THREE.FBXLoader) {
        console.error("[runner.fbx] THREE.FBXLoader 未載入，使用方塊跑手備援。");
        notify("⚠️ FBXLoader 未載入，暫用方塊跑手", "bg-rose-600/95 border-rose-300");
        return;
    }

    const loader = new THREE.FBXLoader();
    loader.load(
        'runner.fbx',
        (fbx) => {
            // Mixamo 模型以厘米為單位，0.01 可轉為約 1.8 個世界單位高
            fbx.scale.setScalar(0.01);
            fbx.rotation.y = 0; // Mixamo 預設面向 +Z，與遊戲前進方向一致

            fbx.traverse((obj) => {
                if (!obj.isMesh) return;
                obj.castShadow = true;
                obj.receiveShadow = true;
                if (obj.isSkinnedMesh) obj.frustumCulled = false;
                if (obj.material && obj.material.map) {
                    obj.material.map.encoding = THREE.sRGBEncoding;
                }
            });

            // 將模型腳底對齊 y=0，並把水平中心移到 player.group 原點
            fbx.updateMatrixWorld(true);
            const bounds = new THREE.Box3().setFromObject(fbx);
            const center = bounds.getCenter(new THREE.Vector3());
            fbx.position.x -= center.x;
            fbx.position.z -= center.z;
            fbx.position.y -= bounds.min.y;

            if (player.fallbackGroup) {
                player.group.remove(player.fallbackGroup);
                player.fallbackGroup = null;
            }

            player.model = fbx;
            player.leftArm = null;
            player.rightArm = null;
            player.leftLeg = null;
            player.rightLeg = null;
            player.isMixamo = true;
            player.group.add(fbx);

            // 建立 AnimationMixer，優先選 Running 動作；忽略沒有軌道的空片段
            const clips = fbx.animations || [];
            const usableClips = clips.filter((clip) => clip.duration > 0 && clip.tracks.length > 0);
            player.mixer = new THREE.AnimationMixer(fbx);
            const runClip = usableClips.find((clip) => /run|jog/i.test(clip.name)) ||
                usableClips.sort((a, b) => b.duration - a.duration)[0] ||
                null;
            if (runClip) {
                player.runAction = player.mixer.clipAction(runClip);
                player.runAction.setLoop(THREE.LoopRepeat, Infinity);
                player.runAction.clampWhenFinished = false;
                player.runAction.enabled = true;
                player.runAction.timeScale = 1.0;
                player.runAction.play();
            } else {
                console.warn("[runner.fbx] 模型沒有動畫片段。", clips);
            }

            console.info(
                `[runner.fbx] 已載入，高度 ${(bounds.max.y - bounds.min.y).toFixed(2)}，` +
                `動畫：${clips.map((clip) => clip.name).join(', ') || '無'}`
            );
        },
        undefined,
        (error) => {
            console.error("[runner.fbx] 載入失敗：", error);
            notify("⚠️ runner.fbx 載入失敗，暫用方塊跑手", "bg-rose-600/95 border-rose-300");
        }
    );
}

/**
 * 初始化玩家、跑道補給水樽與街坊 NPC。
 * @param {THREE.Scene} scene Three.js 場景
 * @param {{ showToast?: (text: string, colorClasses?: string) => void, showSubtitle?: (text: string) => void }} options
 * @returns {{ player: object, waterBottles: Array, npcs: Array }}
 */
export function initPlayer(scene, options = {}) {
    notify = options.showToast || (() => {});
    notifySubtitle = options.showSubtitle || (() => {});
    npcBumpCooldown = 0;
    wasSprinting = false;

    // 建立玩家主角容器；先放方塊跑手，FBX 載入成功後自動替換
    player = {
        group: new THREE.Group(),
        model: null,
        mixer: null,
        runAction: null,
        fallbackGroup: null,
        leftArm: null,
        rightArm: null,
        leftLeg: null,
        rightLeg: null,
        animPhase: 0,
        isMixamo: false
    };
    const startSample = trackSamples[0];
    player.group.position.copy(startSample.point);
    gameState.headingAngle = Math.atan2(startSample.tangent.x, startSample.tangent.z);
    player.group.rotation.y = gameState.headingAngle;
    scene.add(player.group);
    attachFallbackPlayer();
    loadRunnerFbx();

    // 建立跑道上的飲水補給站 (Floating Water Bottles)
    const bottleGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.95, 10);
    const bottleMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.4,
        roughness: 0.2
    });

    for (let i = 28; i < TRACK_POINTS_COUNT; i += 45) {
        const s = trackSamples[i];
        const laneOffset = (Math.random() - 0.5) * (ROAD_WIDTH - 2.4);
        const bottle = new THREE.Mesh(bottleGeo, bottleMat);
        const pos = s.point.clone().addScaledVector(s.right, laneOffset);
        pos.y += 1.0;
        bottle.position.copy(pos);
        scene.add(bottle);
        waterBottles.push({ mesh: bottle, basePos: pos.clone(), cooldown: 0 });
    }

    // 建立 15 位松山街坊 NPC：
    // 6 位兩兩並排、5 位靠內圈慢走、4 位倒後行
    const npcShirtColors = [0xec4899, 0x3b82f6, 0x8b5cf6, 0x14b8a6, 0xeab308, 0xef4444, 0xf97316, 0x22c55e, 0x06b6d4, 0xa855f7];
    const npcShortsColors = [0x334155, 0x1e293b, 0x475569, 0x3f3f46];
    const totalSpawnSlots = 12;
    const spawnTs = Array.from({ length: totalSpawnSlots }, (_, i) =>
        (i + 0.5) / totalSpawnSlots + (Math.random() - 0.5) * 0.035
    ).sort((a, b) => a - b);
    let spawnSlot = 0;

    const addNeighborhoodNpc = (t, laneOffset, speed, direction, backwards, shirtColor, shortsColor, phrase, kind) => {
        const runner = createRunnerCharacter(shirtColor, shortsColor, 0.92 + Math.random() * 0.14);
        const sample = trackSamples[Math.floor(t * TRACK_POINTS_COUNT) % TRACK_POINTS_COUNT];

        // 靠內圈慢走的街坊，按該段跑道方向自動選擇朝向山頂的一側
        let finalLaneOffset = laneOffset;
        if (kind === "inner") {
            const toHillX = GUIA_HILL_CENTER.x - sample.point.x;
            const toHillZ = GUIA_HILL_CENTER.z - sample.point.z;
            const inwardSign = (toHillX * sample.right.x + toHillZ * sample.right.z) >= 0 ? 1 : -1;
            finalLaneOffset = Math.abs(laneOffset) * inwardSign;
        }

        const pos = sample.point.clone().addScaledVector(sample.right, finalLaneOffset);
        runner.group.position.copy(pos);
        runner.group.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
        scene.add(runner.group);
        npcs.push({
            runner,
            t,
            speed,
            laneOffset: finalLaneOffset,
            direction,
            backwards,
            kind,
            phrase,
            wasInRange: false,
            greetingCooldown: 0,
            collisionCooldown: 0
        });
    };

    // 3 組兩人並排（6 人）
    const pairLanes = [
        [-1.15, 0.35],
        [-1.55, -0.15],
        [0.2, 1.55]
    ];
    pairLanes.forEach((lanes, pairIndex) => {
        const t = spawnTs[spawnSlot++];
        const speed = 0.0031 + Math.random() * 0.0012;
        const shirtColor = npcShirtColors[(pairIndex * 2) % npcShirtColors.length];
        const shortsColor = npcShortsColors[pairIndex % npcShortsColors.length];
        lanes.forEach((laneOffset) => {
            addNeighborhoodNpc(t, laneOffset, speed, 1, false, shirtColor, shortsColor, NPC_DIALOGUE[Math.floor(Math.random() * NPC_DIALOGUE.length)], "pair");
        });
    });

    // 5 位靠內圈慢走（內圈 = right 向量負方向）
    for (let i = 0; i < 5; i++) {
        const t = spawnTs[spawnSlot++];
        addNeighborhoodNpc(
            t,
            1.05 + Math.random() * 0.4,
            0.0021 + Math.random() * 0.0011,
            1,
            false,
            npcShirtColors[(spawnSlot + i) % npcShirtColors.length],
            npcShortsColors[(i + 1) % npcShortsColors.length],
            NPC_DIALOGUE[Math.floor(Math.random() * NPC_DIALOGUE.length)],
            "inner"
        );
    }

    // 4 位倒後行：面向跑道前方，但身體向後移動
    for (let i = 0; i < 4; i++) {
        const t = spawnTs[spawnSlot++];
        addNeighborhoodNpc(
            t,
            -1.4 + Math.random() * 2.8,
            0.0028 + Math.random() * 0.0012,
            -1,
            true,
            npcShirtColors[(spawnSlot + i + 3) % npcShirtColors.length],
            npcShortsColors[(i + 2) % npcShortsColors.length],
            NPC_DIALOGUE[Math.floor(Math.random() * NPC_DIALOGUE.length)],
            "backwards"
        );
    }

    setupControls();

    return { player, waterBottles, npcs };
}

// ==========================================
// 3. 操控系統：手機虛擬搖桿、方向鍵與衝刺按鈕
// ==========================================
function setupControls() {
    // 鍵盤事件
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
        if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.sprint = true;
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
        if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.sprint = false;
    });

    // 虛擬搖桿觸控與滑鼠拖曳邏輯
    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');
    let joystickActive = false;

    function handleJoystickMove(clientX, clientY) {
        const rect = joystickZone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxRadius = rect.width * 0.36;

        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }

        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        joystickSteer = dx / maxRadius; // -1 (左) ~ +1 (右)
    }

    function resetJoystick() {
        joystickActive = false;
        joystickSteer = 0;
        joystickKnob.style.transform = `translate(0px, 0px)`;
    }

    joystickZone.addEventListener('pointerdown', (e) => {
        joystickActive = true;
        joystickZone.setPointerCapture(e.pointerId);
        handleJoystickMove(e.clientX, e.clientY);
    });
    joystickZone.addEventListener('pointermove', (e) => {
        if (!joystickActive) return;
        handleJoystickMove(e.clientX, e.clientY);
    });
    joystickZone.addEventListener('pointerup', resetJoystick);
    joystickZone.addEventListener('pointercancel', resetJoystick);

    // 手機左右輔助按鍵
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    btnLeft.addEventListener('pointerdown', () => { touchButtonSteer = -0.85; });
    btnLeft.addEventListener('pointerup', () => { touchButtonSteer = 0; });
    btnLeft.addEventListener('pointerleave', () => { touchButtonSteer = 0; });

    btnRight.addEventListener('pointerdown', () => { touchButtonSteer = 0.85; });
    btnRight.addEventListener('pointerup', () => { touchButtonSteer = 0; });
    btnRight.addEventListener('pointerleave', () => { touchButtonSteer = 0; });

    // 衝刺加速按鈕
    const sprintBtn = document.getElementById('sprint-btn');
    sprintBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        sprintBtnPressed = true;
        sprintBtn.classList.add('sprint-active');
    });
    const stopSprint = () => {
        sprintBtnPressed = false;
        sprintBtn.classList.remove('sprint-active');
    };
    sprintBtn.addEventListener('pointerup', stopSprint);
    sprintBtn.addEventListener('pointerleave', stopSprint);
    sprintBtn.addEventListener('pointercancel', stopSprint);
}

// ==========================================
// 4. 跑手物理、碰撞與賽道事件
// ==========================================
function animateCharacterLimbs(runnerObj, speedFactor, dt, reverse = false) {
    runnerObj.animPhase += dt * speedFactor * 1.15 * (reverse ? -1 : 1);
    const swing = Math.sin(runnerObj.animPhase) * Math.min(1.1, 0.4 + speedFactor * 0.045);
    runnerObj.leftLeg.rotation.x = swing;
    runnerObj.rightLeg.rotation.x = -swing;
    runnerObj.leftArm.rotation.x = -swing * 0.85;
    runnerObj.rightArm.rotation.x = swing * 0.85;
}

/**
 * 更新跑手一幀的物理、碰撞、補給與 NPC。
 * @param {number} dt 距上一幀的秒數
 * @returns {{ slopeY: number, lapCompleted: { lapNumber: number, lapTime: number, isBest: boolean } | null } | null}
 */
export function updatePlayer(dt) {
    if (!gameState.isRunning || !player) return null;

    // 1. 整合轉向輸入 (鍵盤 + 虛擬搖桿 + 按鈕)
    let kbSteer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    let combinedSteer = kbSteer || joystickSteer || touchButtonSteer;
    gameState.steerInput = THREE.MathUtils.clamp(combinedSteer, -1, 1);

    // 2. 處理衝刺與體力消耗
    const wantSprint = keys.sprint || sprintBtnPressed;
    if (wantSprint && gameState.stamina > 2) {
        gameState.isSprinting = true;
        gameState.stamina = Math.max(0, gameState.stamina - dt * 20);
    } else {
        gameState.isSprinting = false;
        gameState.stamina = Math.min(100, gameState.stamina + dt * 8.5);
    }

    // 3. 查詢最近跑道區段與坡度影響
    const closestInfo = getClosestTrackSample(player.group.position);
    const currentSample = closestInfo.sample;

    // 計算上下坡度 (tangent.y > 0 為上斜坡，< 0 為落斜坡)
    const slopeY = currentSample.tangent.y;
    let slopeSpeedBonus = -slopeY * 18.0; // 上坡減速、下坡加速

    const targetSpeed = (gameState.isSprinting ? gameState.maxSprintSpeed : gameState.baseSpeed) + slopeSpeedBonus;
    gameState.speed = THREE.MathUtils.lerp(gameState.speed, Math.max(6.5, targetSpeed), dt * 3.5);

    // 2b. 音效：依速度播放步頻，並在開始衝刺時播放滑音
    if (gameState.isSprinting && !wasSprinting) audio.playBoost();
    wasSprinting = gameState.isSprinting;
    audio.updateFootsteps(dt, gameState.speed, gameState.isSprinting);

    // 4. 手動控制轉向 + 輕微彎道輔助（讓新手在手機上更容易過急彎）
    const manualTurnRate = 2.05; // 轉向靈敏度
    gameState.headingAngle -= gameState.steerInput * manualTurnRate * dt;

    // 根據面向角度與配速向前移動
    const moveStep = (gameState.speed * 0.92) * dt;
    player.group.position.x += Math.sin(gameState.headingAngle) * moveStep;
    player.group.position.z += Math.cos(gameState.headingAngle) * moveStep;

    // 5. 跑道邊界碰撞與貼合地面高度
    const afterMoveInfo = getClosestTrackSample(player.group.position);
    const sAfter = afterMoveInfo.sample;
    const toPlayer = new THREE.Vector3().subVectors(player.group.position, sAfter.point);
    const lateralOffset = toPlayer.dot(sAfter.right); // 距離跑道中心線的左右偏移

    const maxOffset = ROAD_WIDTH * 0.5 - 0.55;
    if (Math.abs(lateralOffset) > maxOffset) {
        // 撞到路邊綠色鐵欄杆：推回跑道內並自動順著彎道微調方向
        const clampedLat = Math.sign(lateralOffset) * maxOffset;
        player.group.position.x = sAfter.point.x + sAfter.right.x * clampedLat;
        player.group.position.z = sAfter.point.z + sAfter.right.z * clampedLat;
        gameState.speed *= 0.94; // 擦撞欄杆微幅減速

        const trackAngle = Math.atan2(sAfter.tangent.x, sAfter.tangent.z);
        // 處理角度跨越 -PI / PI 的平滑插值
        let angleDiff = trackAngle - gameState.headingAngle;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        gameState.headingAngle += angleDiff * 0.28;
    }

    // 貼合松山高低起伏地形；FBX 動畫本身已有跑步起伏，不再額外加 bounce
    const bounce = player.isMixamo ? 0 : Math.abs(Math.sin(player.animPhase)) * 0.12;
    player.group.position.y = sAfter.point.y + bounce;
    player.group.rotation.y = gameState.headingAngle;
    // 轉彎時身體自然向彎內微傾
    player.group.rotation.z = THREE.MathUtils.lerp(player.group.rotation.z, gameState.steerInput * 0.18, dt * 8);

    // 6. 玩家動畫：Mixamo 使用 AnimationMixer；方塊跑手使用手腳擺動
    if (player.isMixamo) {
        if (player.runAction) {
            // 衝刺時加快跑步動畫播放速度
            const targetTimeScale = gameState.isSprinting ? 1.6 : 1.0;
            player.runAction.timeScale = THREE.MathUtils.lerp(
                player.runAction.timeScale,
                targetTimeScale,
                Math.min(1, dt * 8)
            );
        }
    } else {
        animateCharacterLimbs(player, gameState.speed, dt);
    }

    // 7. 檢測繞圈進度與過終點線
    const prevProgress = gameState.trackProgress;
    gameState.trackProgress = sAfter.t;
    let lapCompleted = null;
    if (prevProgress > 0.85 && gameState.trackProgress < 0.15) {
        // 完成一圈 1708m！
        const completedLapNumber = gameState.lapCount;
        const lapTime = (performance.now() - gameState.lapStartTime) / 1000;
        const isBest = !gameState.bestLapTime || lapTime < gameState.bestLapTime;
        if (isBest) {
            gameState.bestLapTime = lapTime;
        }
        gameState.lapCount++;
        gameState.lapStartTime = performance.now();
        lapCompleted = { lapNumber: completedLapNumber, lapTime, isBest };
    }

    // 8. 更新飲水補給瓶動畫與拾取判定
    waterBottles.forEach(b => {
        if (b.cooldown > 0) {
            b.cooldown -= dt;
            if (b.cooldown <= 0) b.mesh.visible = true;
            return;
        }
        b.mesh.rotation.y += dt * 2.5;
        b.mesh.position.y = b.basePos.y + Math.sin(performance.now() * 0.004) * 0.2;

        if (player.group.position.distanceTo(b.mesh.position) < 1.65) {
            gameState.stamina = Math.min(100, gameState.stamina + 35);
            b.mesh.visible = false;
            b.cooldown = 12; // 12秒後重生
            audio.playDrink();
            notify("💧 飲水補給！體力回復 +35%", "bg-sky-600/95 border-sky-300");
        }
    });

    // 9. 更新 15 位街坊 NPC：慢走、並排、倒後行、對白與碰撞
    if (npcBumpCooldown > 0) npcBumpCooldown -= dt;

    let nearestGreeter = null;
    let nearestGreeterDistance = Infinity;
    let collisionThisFrame = false;

    npcs.forEach(npcObj => {
        // 倒後行的方向為 -1，其他街坊為 +1
        npcObj.t = (npcObj.t + npcObj.direction * npcObj.speed * dt + 1) % 1.0;

        const idx = Math.floor(npcObj.t * TRACK_POINTS_COUNT) % TRACK_POINTS_COUNT;
        const ns = trackSamples[idx];
        const npcPos = ns.point.clone().addScaledVector(ns.right, npcObj.laneOffset);
        npcObj.runner.group.position.copy(npcPos);

        // 倒後行街坊面向 +tangent，但位置向 -tangent 移動
        npcObj.runner.group.rotation.y = Math.atan2(ns.tangent.x, ns.tangent.z);
        animateCharacterLimbs(npcObj.runner, npcObj.backwards ? 5.0 : 7.0, dt, npcObj.backwards);

        // 以水平距離判定，避免高低起伏影響 10 米範圍
        const dx = player.group.position.x - npcPos.x;
        const dz = player.group.position.z - npcPos.z;
        const distToNpc = Math.hypot(dx, dz);
        npcObj.distanceToPlayer = distToNpc;

        // 碰撞：減速並扣體力（有短暫冷卻，避免每幀重複扣）
        if (npcObj.collisionCooldown > 0) npcObj.collisionCooldown -= dt;
        if (distToNpc < NPC_COLLISION_RADIUS && npcObj.collisionCooldown <= 0 && npcBumpCooldown <= 0) {
            gameState.speed = Math.max(6.0, gameState.speed * 0.62);
            gameState.stamina = Math.max(0, gameState.stamina - 8);
            npcObj.collisionCooldown = 2.0;
            npcObj.wasInRange = true;
            npcObj.greetingCooldown = 9;
            npcBumpCooldown = 0.8;
            collisionThisFrame = true;
            notify("⚠️ 撞到街坊！速度減慢、體力 -8", "bg-rose-600/95 border-rose-300");
            notifySubtitle("哎呀！睇路啦！");
        }

        // 進入 10 米範圍時，只讓最近的一位街坊開口
        if (npcObj.greetingCooldown > 0) npcObj.greetingCooldown -= dt;
        if (distToNpc <= NPC_SUBTITLE_RANGE) {
            if (!npcObj.wasInRange && npcObj.greetingCooldown <= 0 && distToNpc < nearestGreeterDistance) {
                nearestGreeter = npcObj;
                nearestGreeterDistance = distToNpc;
            }
            npcObj.wasInRange = true;
        } else {
            npcObj.wasInRange = false;
        }
    });

    if (nearestGreeter && !collisionThisFrame) {
        notifySubtitle(nearestGreeter.phrase);
        nearestGreeter.greetingCooldown = 9;
    }

    return { slopeY, lapCompleted };
}
