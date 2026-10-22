// ==========================================
// track.js - 澳門松山健康徑（真實 GPX 跑道）
// ==========================================
const THREE = window.THREE;

// ==========================================
// 1. 松山跑道設定（真實 GPX 資料）
// ==========================================
// 資料來源：
//   20261022102151.gpx（COROS Running，3.02 km）
//   20261022103857.gpx（COROS Other，2.17 km）
// 兩個檔案是同一條松山環山徑的連續紀錄；A 段第 0~583 點正好完成一圈
// （原始軌跡 1,727 m，平滑後 1,708 m，起終點只差 2.1 m），
// B 段第 0~1335 點亦為同一圈（1,733 m），用作交叉驗證。
export const TRACK_REAL_LENGTH = 1708; // 一圈實際長度（公尺）
export const TRACK_POINTS_COUNT = 360; // 樣條曲線細分點數
export const ROAD_WIDTH = 7.5;         // 跑道寬度

// 東望洋山山頂在正規化世界座標中的位置（供環境與 NPC 內圈判定使用）
export const GUIA_HILL_CENTER = { x: -76, z: -16 };

// 松山四大代表性路段地標定義（沿真實跑道進度）
export const LANDMARKS = [
    { start: 0.0,  end: 0.22, name: "松山纜車站起點", desc: "林蔭平路・熱身起跑段" },
    { start: 0.22, end: 0.48, name: "松山防空洞隧道段", desc: "微上斜坡・注意留力" },
    { start: 0.48, end: 0.75, name: "東望洋燈塔遠景彎", desc: "最高點觀景・飽覽澳門半島" },
    { start: 0.75, end: 1.01, name: "健康徑涼亭落斜段", desc: "爽快落斜・衝刺回終點" }
];

// ==========================================
// 2. GPX 正規化（Normalize）
// ==========================================
// 以跑道包圍盒中心為原點，向東為 +X、向上為 +Y、向北為 -Z。
// 1 個 Three.js 單位 = 2.5 公尺（WORLD_SCALE = 0.4）；
// 海拔再額外放大 3 倍，令松山 46~49 m 的起伏在遊戲中清晰可見。
export const WORLD_SCALE = 0.4;
export const ELEVATION_EXAGGERATION = 3;

const GPX_ORIGIN_LAT = 22.1983399;
const GPX_ORIGIN_LON = 113.5513497;
const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LON = METERS_PER_DEG_LAT * Math.cos(GPX_ORIGIN_LAT * Math.PI / 180);

// A 段一圈，沿軌跡每約 8 m 取樣；欄位：[lat, lon, ele(公尺)]
const GPX_LAP_POINTS = [
    [22.1968811, 113.5487778, 47.74],
    [22.1969511, 113.5487954, 47.63],
    [22.1970224, 113.5488070, 47.53],
    [22.1970933, 113.5488204, 47.44],
    [22.1971612, 113.5488455, 47.35],
    [22.1972190, 113.5488914, 47.29],
    [22.1972653, 113.5489509, 47.29],
    [22.1973073, 113.5490141, 47.29],
    [22.1973482, 113.5490781, 47.27],
    [22.1973884, 113.5491427, 47.19],
    [22.1974242, 113.5492102, 47.10],
    [22.1974531, 113.5492814, 47.02],
    [22.1974751, 113.5493554, 47.00],
    [22.1974941, 113.5494305, 47.00],
    [22.1975140, 113.5495052, 46.93],
    [22.1975356, 113.5495794, 46.83],
    [22.1975585, 113.5496532, 46.74],
    [22.1975847, 113.5497257, 46.65],
    [22.1976183, 113.5497944, 46.56],
    [22.1976658, 113.5498524, 46.46],
    [22.1977275, 113.5498915, 46.37],
    [22.1977982, 113.5499018, 46.27],
    [22.1978676, 113.5498821, 46.18],
    [22.1979332, 113.5498500, 46.13],
    [22.1980002, 113.5498219, 46.13],
    [22.1980714, 113.5498143, 46.20],
    [22.1981398, 113.5498369, 46.29],
    [22.1981994, 113.5498804, 46.37],
    [22.1982541, 113.5499310, 46.45],
    [22.1983074, 113.5499833, 46.53],
    [22.1983592, 113.5500373, 46.62],
    [22.1984076, 113.5500949, 46.71],
    [22.1984551, 113.5501535, 46.80],
    [22.1985029, 113.5502116, 46.90],
    [22.1985442, 113.5502752, 46.99],
    [22.1985662, 113.5503487, 46.97],
    [22.1985559, 113.5504247, 46.88],
    [22.1985164, 113.5504894, 46.78],
    [22.1984702, 113.5505490, 46.69],
    [22.1984377, 113.5506177, 46.59],
    [22.1984453, 113.5506936, 46.48],
    [22.1984864, 113.5507570, 46.38],
    [22.1985392, 113.5508098, 46.28],
    [22.1985936, 113.5508608, 46.18],
    [22.1986404, 113.5509197, 46.09],
    [22.1986712, 113.5509897, 46.00],
    [22.1986923, 113.5510641, 46.00],
    [22.1987177, 113.5511369, 46.06],
    [22.1987520, 113.5512052, 46.16],
    [22.1987944, 113.5512680, 46.25],
    [22.1988446, 113.5513237, 46.34],
    [22.1989027, 113.5513694, 46.43],
    [22.1989700, 113.5513959, 46.53],
    [22.1990418, 113.5513978, 46.62],
    [22.1991136, 113.5513931, 46.71],
    [22.1991826, 113.5514121, 46.82],
    [22.1992354, 113.5514641, 46.91],
    [22.1992743, 113.5515295, 47.00],
    [22.1993085, 113.5515980, 47.00],
    [22.1993422, 113.5516668, 47.00],
    [22.1993777, 113.5517344, 47.00],
    [22.1994142, 113.5518015, 46.97],
    [22.1994526, 113.5518673, 46.88],
    [22.1995014, 113.5519241, 46.78],
    [22.1995645, 113.5519611, 46.68],
    [22.1996335, 113.5519830, 46.59],
    [22.1997042, 113.5519982, 46.51],
    [22.1997745, 113.5520147, 46.42],
    [22.1998405, 113.5520453, 46.33],
    [22.1998966, 113.5520938, 46.24],
    [22.1999505, 113.5521453, 46.14],
    [22.2000152, 113.5521782, 46.04],
    [22.2000866, 113.5521869, 46.05],
    [22.2001584, 113.5521818, 46.14],
    [22.2002293, 113.5521677, 46.22],
    [22.2003002, 113.5521546, 46.31],
    [22.2003720, 113.5521563, 46.40],
    [22.2004409, 113.5521781, 46.48],
    [22.2005047, 113.5522141, 46.56],
    [22.2005667, 113.5522536, 46.65],
    [22.2006318, 113.5522869, 46.74],
    [22.2006994, 113.5523136, 46.84],
    [22.2007657, 113.5523440, 46.94],
    [22.2008283, 113.5523823, 47.00],
    [22.2008862, 113.5524286, 47.00],
    [22.2009332, 113.5524870, 47.00],
    [22.2009554, 113.5525603, 47.00],
    [22.2009507, 113.5526376, 47.00],
    [22.2009344, 113.5527134, 47.00],
    [22.2009162, 113.5527886, 47.00],
    [22.2008983, 113.5528640, 47.00],
    [22.2008792, 113.5529390, 47.00],
    [22.2008599, 113.5530140, 47.00],
    [22.2008376, 113.5530879, 47.00],
    [22.2008092, 113.5531594, 47.00],
    [22.2007708, 113.5532250, 47.00],
    [22.2007225, 113.5532827, 47.00],
    [22.2006691, 113.5533348, 47.00],
    [22.2006161, 113.5533876, 47.00],
    [22.2005673, 113.5534447, 47.00],
    [22.2005242, 113.5535070, 47.00],
    [22.2004827, 113.5535706, 47.00],
    [22.2004353, 113.5536290, 47.00],
    [22.2003737, 113.5536683, 47.00],
    [22.2003027, 113.5536753, 47.00],
    [22.2002333, 113.5536555, 47.00],
    [22.2001664, 113.5536266, 47.00],
    [22.2000991, 113.5535989, 47.00],
    [22.2000314, 113.5535722, 47.00],
    [22.1999643, 113.5535442, 47.00],
    [22.1998974, 113.5535153, 47.00],
    [22.1998296, 113.5534890, 47.00],
    [22.1997605, 113.5534673, 47.00],
    [22.1996897, 113.5534532, 47.00],
    [22.1996181, 113.5534565, 47.00],
    [22.1995505, 113.5534827, 47.00],
    [22.1994891, 113.5535231, 47.03],
    [22.1994307, 113.5535687, 47.12],
    [22.1993726, 113.5536147, 47.21],
    [22.1993102, 113.5536531, 47.30],
    [22.1992399, 113.5536641, 47.39],
    [22.1991786, 113.5536257, 47.48],
    [22.1991397, 113.5535606, 47.56],
    [22.1991107, 113.5534894, 47.64],
    [22.1990825, 113.5534178, 47.72],
    [22.1990451, 113.5533515, 47.80],
    [22.1989928, 113.5532985, 47.89],
    [22.1989302, 113.5532602, 47.98],
    [22.1988640, 113.5532296, 48.00],
    [22.1987970, 113.5532011, 48.00],
    [22.1987308, 113.5531705, 48.00],
    [22.1986665, 113.5531355, 48.00],
    [22.1986050, 113.5530951, 48.00],
    [22.1985454, 113.5530514, 48.00],
    [22.1984877, 113.5530048, 48.00],
    [22.1984329, 113.5529542, 48.00],
    [22.1983791, 113.5529026, 48.00],
    [22.1983234, 113.5528532, 48.00],
    [22.1982652, 113.5528074, 48.00],
    [22.1982056, 113.5527638, 48.00],
    [22.1981458, 113.5527203, 48.00],
    [22.1980880, 113.5526740, 48.00],
    [22.1980329, 113.5526239, 48.00],
    [22.1979798, 113.5525713, 48.00],
    [22.1979246, 113.5525214, 48.00],
    [22.1978642, 113.5524792, 48.00],
    [22.1977984, 113.5524477, 48.00],
    [22.1977303, 113.5524223, 48.00],
    [22.1976642, 113.5523917, 48.00],
    [22.1976046, 113.5523482, 48.00],
    [22.1975560, 113.5522911, 48.00],
    [22.1975202, 113.5522238, 48.00],
    [22.1974965, 113.5521504, 48.00],
    [22.1974790, 113.5520749, 48.00],
    [22.1974636, 113.5519989, 48.00],
    [22.1974494, 113.5519227, 48.00],
    [22.1974358, 113.5518463, 48.00],
    [22.1974182, 113.5517709, 48.00],
    [22.1973921, 113.5516984, 48.00],
    [22.1973557, 113.5516313, 48.00],
    [22.1973150, 113.5515672, 48.05],
    [22.1972754, 113.5515022, 48.14],
    [22.1972391, 113.5514350, 48.23],
    [22.1972055, 113.5513662, 48.31],
    [22.1971716, 113.5512976, 48.40],
    [22.1971360, 113.5512299, 48.49],
    [22.1970987, 113.5511634, 48.57],
    [22.1970601, 113.5510977, 48.66],
    [22.1970149, 113.5510373, 48.75],
    [22.1969584, 113.5509895, 48.84],
    [22.1968927, 113.5509578, 48.93],
    [22.1968242, 113.5509337, 49.00],
    [22.1967569, 113.5509061, 49.00],
    [22.1966968, 113.5508638, 49.00],
    [22.1966502, 113.5508049, 48.92],
    [22.1966136, 113.5507379, 48.83],
    [22.1965719, 113.5506746, 48.74],
    [22.1965184, 113.5506228, 48.66],
    [22.1964585, 113.5505797, 48.57],
    [22.1964009, 113.5505330, 48.49],
    [22.1963558, 113.5504728, 48.40],
    [22.1963242, 113.5504030, 48.32],
    [22.1962970, 113.5503309, 48.24],
    [22.1962601, 113.5502644, 48.15],
    [22.1962088, 113.5502102, 48.06],
    [22.1961508, 113.5501640, 48.00],
    [22.1960964, 113.5501132, 48.00],
    [22.1960546, 113.5500502, 48.00],
    [22.1960315, 113.5499767, 48.00],
    [22.1960195, 113.5499001, 48.00],
    [22.1960106, 113.5498229, 48.00],
    [22.1960015, 113.5497457, 48.00],
    [22.1959916, 113.5496686, 48.00],
    [22.1959818, 113.5495916, 48.00],
    [22.1959718, 113.5495145, 48.00],
    [22.1959625, 113.5494374, 48.00],
    [22.1959555, 113.5493600, 48.00],
    [22.1959541, 113.5492822, 48.00],
    [22.1959628, 113.5492051, 48.00],
    [22.1959848, 113.5491312, 48.00],
    [22.1960214, 113.5490644, 48.00],
    [22.1960705, 113.5490077, 48.00],
    [22.1961290, 113.5489624, 48.00],
    [22.1961930, 113.5489269, 48.00],
    [22.1962593, 113.5488966, 48.00],
    [22.1963239, 113.5488623, 48.00],
    [22.1963855, 113.5488219, 48.00],
    [22.1964508, 113.5487895, 48.00],
    [22.1965218, 113.5487777, 47.94],
    [22.1965938, 113.5487764, 47.86],
    [22.1966658, 113.5487757, 47.78],
    [22.1967378, 113.5487724, 47.74],
    [22.1968097, 113.5487686, 47.74],
];

const BASE_ELEVATION = Math.min(...GPX_LAP_POINTS.map(p => p[2]));

// 將 GPX 經緯度與海拔轉換成 Three.js 控制點
const controlPoints = GPX_LAP_POINTS.map(([lat, lon, ele]) => new THREE.Vector3(
    (lon - GPX_ORIGIN_LON) * METERS_PER_DEG_LON * WORLD_SCALE,
    (ele - BASE_ELEVATION) * WORLD_SCALE * ELEVATION_EXAGGERATION,
    -(lat - GPX_ORIGIN_LAT) * METERS_PER_DEG_LAT * WORLD_SCALE
));

// Centripetal Catmull-Rom 能避免真實 GPX 密集取樣造成的過衝與打結
const trackCurve = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal', 0.5);
export const trackSamples = []; // 儲存預先計算的跑道中心點、切線、法線，加速碰撞與進度查詢

function precomputeTrackSamples() {
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < TRACK_POINTS_COUNT; i++) {
        const t = i / TRACK_POINTS_COUNT;
        const point = trackCurve.getPointAt(t);
        const tangent = trackCurve.getTangentAt(t).normalize();
        const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
        trackSamples.push({ t, point, tangent, right });
    }
}
precomputeTrackSamples();

// 根據世界座標尋找最近的跑道樣本點
export function getClosestTrackSample(pos) {
    let minDistSq = Infinity;
    let bestSample = trackSamples[0];
    for (let i = 0; i < trackSamples.length; i++) {
        const s = trackSamples[i];
        const dx = pos.x - s.point.x;
        const dz = pos.z - s.point.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDistSq) {
            minDistSq = dSq;
            bestSample = s;
        }
    }
    return { sample: bestSample, dist: Math.sqrt(minDistSq) };
}

// 生成地面標記貼圖 (起點線、500m、1000m、1500m)
function createMarkerTexture(text, subText, bgColor = "#15803d") {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, c.width / 2, 62);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(subText, c.width / 2, 100);
    const tex = new THREE.CanvasTexture(c);
    return tex;
}

// 程序化瀝青／紅褐色地磚貼圖（無縫平鋪）＋凹凸貼圖
function createAsphaltTextures() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#202020';
    ctx.fillRect(0, 0, size, size);

    const tileW = 96;
    const tileH = 48;
    const cols = Math.ceil(size / tileW);
    const rows = Math.ceil(size / tileH);
    const palette = ['#292929', '#242424', '#303030', '#37322f', '#272727', '#332c29'];

    for (let row = 0; row <= rows; row++) {
        const offset = (row % 2) * (tileW / 2);
        for (let col = -1; col <= cols; col++) {
            const wrappedCol = ((col % cols) + cols) % cols;
            ctx.fillStyle = palette[(row * 7 + wrappedCol * 13) % palette.length];
            ctx.fillRect(col * tileW + offset, row * tileH, tileW - 2, tileH - 2);
            ctx.strokeStyle = 'rgba(18, 24, 32, 0.42)';
            ctx.lineWidth = 2;
            ctx.strokeRect(col * tileW + offset + 1, row * tileH + 1, tileW - 4, tileH - 4);
        }
    }

    // 細小骨料顆粒與磨損痕跡
    for (let i = 0; i < 2600; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const shade = Math.random();
        ctx.fillStyle = shade > 0.78
            ? 'rgba(196, 181, 160, 0.22)'
            : shade > 0.42
                ? 'rgba(15, 23, 42, 0.2)'
                : 'rgba(120, 78, 58, 0.22)';
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
        ctx.lineWidth = 1;
        let x = Math.random() * size;
        let y = Math.random() * size;
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
            x += (Math.random() - 0.5) * 45;
            y += (Math.random() - 0.5) * 28;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.encoding = THREE.sRGBEncoding;
    map.anisotropy = 4;

    // 灰階凹凸貼圖：地磚接縫較深，骨料顆粒形成細微高低差
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext('2d');
    bumpCtx.fillStyle = '#818181';
    bumpCtx.fillRect(0, 0, size, size);
    for (let row = 0; row <= rows; row++) {
        const offset = (row % 2) * (tileW / 2);
        for (let col = -1; col <= cols; col++) {
            bumpCtx.fillStyle = (row + col) % 2 === 0 ? '#777777' : '#8a8a8a';
            bumpCtx.fillRect(col * tileW + offset, row * tileH, tileW - 2, tileH - 2);
            bumpCtx.fillStyle = '#4f4f4f';
            bumpCtx.fillRect(col * tileW + offset, row * tileH, tileW - 2, 2);
            bumpCtx.fillRect(col * tileW + offset, row * tileH, 2, tileH - 2);
        }
    }
    for (let i = 0; i < 2400; i++) {
        bumpCtx.fillStyle = Math.random() > 0.5 ? '#a2a2a2' : '#626262';
        bumpCtx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }
    const bump = new THREE.CanvasTexture(bumpCanvas);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.anisotropy = 4;

    return { map, bump };
}

// 透明噴漆數字貼圖（用於路面里程標記）
function createSprayMarkerTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(256, 145);
    ctx.rotate(-0.045);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 120px "Arial Black", "Noto Sans TC", sans-serif';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.52)';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = 'rgba(245, 242, 220, 0.9)';
    ctx.fillText(text, 0, 0);

    // 噴漆飛濺
    for (let i = 0; i < 110; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 45 + Math.random() * 175;
        ctx.fillStyle = Math.random() > 0.2
            ? 'rgba(245, 242, 220, 0.35)'
            : 'rgba(15, 23, 42, 0.3)';
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.55, Math.random() * 2.2, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 4;
    return texture;
}

// 建立跑道網格、路邊石壆與澳門經典綠色鐵欄杆
function buildTrackGeometry(scene) {
    const asphalt = createAsphaltTextures();
    const roadPositions = [];
    const roadUVs = [];
    const roadIndices = [];
    let roadDistance = 0;
    let previousPoint = null;

    for (let i = 0; i <= TRACK_POINTS_COUNT; i++) {
        const sample = trackSamples[i % TRACK_POINTS_COUNT];
        const p = sample.point;
        const r = sample.right;

        if (previousPoint) roadDistance += p.distanceTo(previousPoint);
        const v = roadDistance / 2.4;
        previousPoint = p;

        const halfW = ROAD_WIDTH * 0.5;
        const leftPt = p.clone().addScaledVector(r, -halfW);
        const rightPt = p.clone().addScaledVector(r, halfW);

        roadPositions.push(leftPt.x, leftPt.y, leftPt.z);
        roadPositions.push(rightPt.x, rightPt.y, rightPt.z);
        roadUVs.push(0, v);
        roadUVs.push(ROAD_WIDTH / 1.8, v);

        if (i < TRACK_POINTS_COUNT) {
            const base = i * 2;
            roadIndices.push(base, base + 1, base + 2);
            roadIndices.push(base + 1, base + 3, base + 2);
        }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUVs, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
        map: asphalt.map,
        bumpMap: asphalt.bump,
        bumpScale: 0.08,
        roughness: 0.93,
        metalness: 0.02,
        side: THREE.DoubleSide
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // 灰色混凝土路壆（兩側，使用 InstancedMesh）
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x4c5257, roughness: 0.95 });
    const curbGeo = new THREE.BoxGeometry(0.38, 0.22, 1);
    const curbData = [];
    for (let i = 0; i < TRACK_POINTS_COUNT; i += 2) {
        const s = trackSamples[i];
        const nextS = trackSamples[(i + 2) % TRACK_POINTS_COUNT];
        const mid = s.point.clone().lerp(nextS.point, 0.5);
        const segmentLength = s.point.distanceTo(nextS.point) * 1.06;
        const yaw = Math.atan2(s.tangent.x, s.tangent.z);
        [-1, 1].forEach((side) => {
            curbData.push({
                position: mid.clone().addScaledVector(s.right, side * (ROAD_WIDTH * 0.5 + 0.19)),
                yaw,
                segmentLength
            });
        });
    }
    const curbMesh = new THREE.InstancedMesh(curbGeo, curbMat, curbData.length);
    const curbDummy = new THREE.Object3D();
    curbData.forEach((curb, index) => {
        curbDummy.position.copy(curb.position);
        curbDummy.position.y += 0.11;
        curbDummy.rotation.set(0, curb.yaw, 0);
        curbDummy.scale.set(1, 1, curb.segmentLength);
        curbDummy.updateMatrix();
        curbMesh.setMatrixAt(index, curbDummy.matrix);
    });
    curbMesh.instanceMatrix.needsUpdate = true;
    curbMesh.receiveShadow = true;
    curbMesh.frustumCulled = false;
    scene.add(curbMesh);

    // 墨綠色鐵欄杆（柱與橫欄都使用 InstancedMesh，兩側都有）
    const railMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.42, metalness: 0.42 });
    const postGeo = new THREE.BoxGeometry(0.12, 1.15, 0.12);
    const railGeo = new THREE.BoxGeometry(0.08, 0.08, 1);
    const railOffset = ROAD_WIDTH * 0.5 + 0.78;
    const postData = [];
    const railData = [];
    for (let i = 0; i < TRACK_POINTS_COUNT; i += 3) {
        const s = trackSamples[i];
        const nextS = trackSamples[(i + 3) % TRACK_POINTS_COUNT];
        const segmentLength = s.point.distanceTo(nextS.point) * 1.06;
        const yaw = Math.atan2(s.tangent.x, s.tangent.z);
        const mid = s.point.clone().lerp(nextS.point, 0.5);
        [-1, 1].forEach((side) => {
            postData.push({
                position: s.point.clone().addScaledVector(s.right, side * railOffset),
                yaw
            });
            [0.42, 0.9].forEach((height) => {
                railData.push({
                    position: mid.clone().addScaledVector(s.right, side * railOffset).add(new THREE.Vector3(0, height, 0)),
                    yaw,
                    segmentLength
                });
            });
        });
    }

    const postMesh = new THREE.InstancedMesh(postGeo, railMat, postData.length);
    const railMesh = new THREE.InstancedMesh(railGeo, railMat, railData.length);
    const railDummy = new THREE.Object3D();
    postData.forEach((post, index) => {
        railDummy.position.copy(post.position);
        railDummy.position.y += 0.55;
        railDummy.rotation.set(0, post.yaw, 0);
        railDummy.scale.set(1, 1, 1);
        railDummy.updateMatrix();
        postMesh.setMatrixAt(index, railDummy.matrix);
    });
    railData.forEach((rail, index) => {
        railDummy.position.copy(rail.position);
        railDummy.rotation.set(0, rail.yaw, 0);
        railDummy.scale.set(1, 1, rail.segmentLength);
        railDummy.updateMatrix();
        railMesh.setMatrixAt(index, railDummy.matrix);
    });
    [postMesh, railMesh].forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        scene.add(mesh);
    });

    // 地面噴漆里程標記：每 200 公尺一個
    for (let meters = 0; meters < TRACK_REAL_LENGTH; meters += 200) {
        const t = meters / TRACK_REAL_LENGTH;
        const idx = Math.floor(t * TRACK_POINTS_COUNT) % TRACK_POINTS_COUNT;
        const s = trackSamples[idx];
        const label = meters === 0 ? "START 0m" : `${meters}m`;
        const planeGeo = new THREE.PlaneGeometry(3.8, 1.7);
        const planeMat = new THREE.MeshBasicMaterial({
            map: createSprayMarkerTexture(label),
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            side: THREE.DoubleSide
        });
        const markerMesh = new THREE.Mesh(planeGeo, planeMat);
        markerMesh.position.copy(s.point).add(new THREE.Vector3(0, 0.07, 0));
        markerMesh.rotation.x = -Math.PI / 2;
        const angle = Math.atan2(s.tangent.x, s.tangent.z);
        markerMesh.rotation.z = angle + Math.PI;
        markerMesh.renderOrder = 1;
        scene.add(markerMesh);
    }
}

let lighthouseBeacon = null;

/**
 * 以 Three.js 原生幾何體組裝東望洋燈塔與聖母雪地殿。
 * 使用本地座標建模，最後由 buildGuiaHillEnvironment 縮放並放上高台。
 */
function createGuiaLighthouse() {
    const group = new THREE.Group();

    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4, metalness: 0.15 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4b2e1e, roughness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.55,
        roughness: 0.2
    });

    // 1. 石造基座與黃色腰線
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.4, 1.2, 24), stoneMat);
    plinth.position.y = 0.6;
    group.add(plinth);

    const baseBand = new THREE.Mesh(new THREE.CylinderGeometry(4.45, 4.65, 0.55, 24), yellowMat);
    baseBand.position.y = 1.4;
    group.add(baseBand);

    // 2. 白色錐形主塔
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 17.2, 24), whiteMat);
    tower.position.y = 10.25;
    group.add(tower);

    // 塔身黃色細帶
    const towerBandA = new THREE.Mesh(new THREE.CylinderGeometry(3.84, 3.9, 0.16, 24), yellowMat);
    towerBandA.position.y = 6.8;
    group.add(towerBandA);
    const towerBandB = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.56, 0.16, 24), yellowMat);
    towerBandB.position.y = 13.5;
    group.add(towerBandB);

    // 塔身小窗
    [5.4, 9.2, 13.0].forEach((y, row) => {
        for (let k = 0; k < 4; k++) {
            const angle = k * Math.PI / 2 + (row % 2) * Math.PI / 4;
            const radius = 4.2 - (y - 1.65) / 17.2;
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.16), darkMat);
            win.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
            win.rotation.y = angle;
            group.add(win);
        }
    });

    // 正門
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.8, 0.2), doorMat);
    door.position.set(0, 3.0, 4.12);
    group.add(door);

    // 3. 觀景平台與標誌性黃色欄杆
    const galleryFloor = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.9, 0.4, 24), whiteMat);
    galleryFloor.position.y = 19.05;
    group.add(galleryFloor);

    const galleryRim = new THREE.Mesh(new THREE.CylinderGeometry(4.65, 4.65, 0.22, 24), yellowMat);
    galleryRim.position.y = 19.36;
    group.add(galleryRim);

    const railRadius = 4.55;
    const postCount = 20;
    for (let i = 0; i < postCount; i++) {
        const angle = (i / postCount) * Math.PI * 2;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.05, 0.14), yellowMat);
        post.position.set(Math.sin(angle) * railRadius, 19.78, Math.cos(angle) * railRadius);
        group.add(post);
    }
    const railTop = new THREE.Mesh(new THREE.TorusGeometry(railRadius, 0.09, 8, 40), yellowMat);
    railTop.rotation.x = Math.PI / 2;
    railTop.position.y = 20.32;
    group.add(railTop);
    const railMid = new THREE.Mesh(new THREE.TorusGeometry(railRadius, 0.055, 8, 40), yellowMat);
    railMid.rotation.x = Math.PI / 2;
    railMid.position.y = 19.6;
    group.add(railMid);

    // 4. 燈籠室：玻璃窗、黃色骨架與頂環
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.15, 0.4, 20), yellowMat);
    lanternBase.position.y = 19.45;
    group.add(lanternBase);

    const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 2.9, 20), glassMat);
    lanternGlass.position.y = 21.1;
    group.add(lanternGlass);

    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const mullion = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.0, 6), yellowMat);
        mullion.position.set(Math.sin(angle) * 2.48, 21.1, Math.cos(angle) * 2.48);
        group.add(mullion);
    }

    const lanternCrown = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 3.05, 0.35, 20), yellowMat);
    lanternCrown.position.y = 22.62;
    group.add(lanternCrown);

    // 5. 紅色半球圓頂與金色頂飾
    const domeRim = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.22, 24), yellowMat);
    domeRim.position.y = 22.82;
    group.add(domeRim);

    const redDome = new THREE.Mesh(
        new THREE.SphereGeometry(3.05, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        redMat
    );
    redDome.position.y = 22.9;
    group.add(redDome);

    const finialPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), yellowMat);
    finialPole.position.y = 26.35;
    group.add(finialPole);
    const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), yellowMat);
    finialBall.position.y = 27.05;
    group.add(finialBall);

    // 6. 聖母雪地殿：黃白相間的小教堂
    const chapel = new THREE.Group();
    chapel.position.set(-9.2, 0, 0.5);

    const chapelWalls = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 5), whiteMat);
    chapelWalls.position.y = 2.5;
    chapel.add(chapelWalls);

    const chapelBase = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.7, 5.3), yellowMat);
    chapelBase.position.y = 0.35;
    chapel.add(chapelBase);

    [1.5, 3.0, 4.35].forEach((y) => {
        const band = new THREE.Mesh(new THREE.BoxGeometry(7.22, 0.32, 5.22), yellowMat);
        band.position.y = y;
        chapel.add(band);
    });

    [-3.35, 3.35].forEach((x) => {
        [-2.35, 2.35].forEach((z) => {
            const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.32, 5, 0.32), yellowMat);
            pilaster.position.set(x, 2.5, z);
            chapel.add(pilaster);
        });
    });

    const chapelRoof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.3, 4), redMat);
    chapelRoof.position.y = 6.15;
    chapelRoof.rotation.y = Math.PI / 4;
    chapel.add(chapelRoof);

    const crossVertical = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.3, 0.14), yellowMat);
    crossVertical.position.y = 7.95;
    chapel.add(crossVertical);
    const crossHorizontal = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.14), yellowMat);
    crossHorizontal.position.y = 8.05;
    chapel.add(crossHorizontal);

    const chapelDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.9, 0.12), yellowMat);
    chapelDoorFrame.position.set(0, 1.45, 2.54);
    chapel.add(chapelDoorFrame);
    const chapelDoor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.16), doorMat);
    chapelDoor.position.set(0, 1.2, 2.63);
    chapel.add(chapelDoor);

    [-2.0, 2.0].forEach((x) => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 0.1), yellowMat);
        frame.position.set(x, 3.45, 2.54);
        chapel.add(frame);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.2, 0.12), darkMat);
        glass.position.set(x, 3.45, 2.63);
        chapel.add(glass);
    });

    group.add(chapel);

    // 7. 360° 旋轉夜間探照燈
    const beaconPivot = new THREE.Group();
    beaconPivot.position.set(0, 21.1, 0);

    const beaconLight = new THREE.SpotLight(0xfff3b0, 2.4, 180, 0.14, 0.35, 1.0);
    beaconLight.position.set(0, 0, 0);
    beaconLight.castShadow = false;
    const beaconTarget = new THREE.Object3D();
    beaconTarget.position.set(0, 0, 80);
    beaconLight.target = beaconTarget;
    beaconPivot.add(beaconLight, beaconTarget);

    const beaconBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff7c0 })
    );
    beaconPivot.add(beaconBulb);

    // 可見的淡黃色光束（配合 SpotLight 一起旋轉）
    const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0xfff3b0,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(12, 90, 20, 1, true), beamMaterial);
    beam.rotation.x = -Math.PI / 2;
    beam.position.z = 45;
    beaconPivot.add(beam);

    group.add(beaconPivot);
    lighthouseBeacon = {
        pivot: beaconPivot,
        spot: beaconLight,
        beam,
        bulb: beaconBulb
    };

    return group;
}

export function updateLighthouseBeacon(dt) {
    if (!lighthouseBeacon) return;
    lighthouseBeacon.pivot.rotation.y += dt * 0.85;
}

// 夜晚增強燈塔射燈與可見光束
export function setLighthouseBeaconNight(isNight) {
    if (!lighthouseBeacon) return;
    lighthouseBeacon.spot.intensity = isNight ? 3.2 : 0.7;
    lighthouseBeacon.beam.material.opacity = isNight ? 0.16 : 0.035;
}

// 夜間路燈：燈柱／燈頭／燈泡全部使用 InstancedMesh
let streetLampState = null;

function buildStreetLamps(scene) {
    const lampPositions = [];
    for (let i = 10; i < TRACK_POINTS_COUNT; i += 8) {
        const s = trackSamples[i];
        const side = Math.floor(i / 8) % 2 === 0 ? 1 : -1;
        const pos = s.point.clone().addScaledVector(s.right, side * (ROAD_WIDTH * 0.5 + 1.6));
        pos.y = s.point.y;
        lampPositions.push(pos);
    }
    if (lampPositions.length === 0) return;

    const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 3.2, 6);
    const headGeo = new THREE.BoxGeometry(0.36, 0.24, 0.36);
    const glowGeo = new THREE.SphereGeometry(0.34, 8, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, metalness: 0.35 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.25 });
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffefb0,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, lampPositions.length);
    const headMesh = new THREE.InstancedMesh(headGeo, headMat, lampPositions.length);
    const glowMesh = new THREE.InstancedMesh(glowGeo, glowMat, lampPositions.length);
    const dummy = new THREE.Object3D();

    lampPositions.forEach((pos, i) => {
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);

        dummy.position.set(pos.x, pos.y + 1.6, pos.z);
        dummy.updateMatrix();
        poleMesh.setMatrixAt(i, dummy.matrix);

        dummy.position.set(pos.x, pos.y + 3.35, pos.z);
        dummy.updateMatrix();
        headMesh.setMatrixAt(i, dummy.matrix);

        dummy.position.set(pos.x, pos.y + 3.18, pos.z);
        dummy.updateMatrix();
        glowMesh.setMatrixAt(i, dummy.matrix);
    });

    [poleMesh, headMesh, glowMesh].forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
        scene.add(mesh);
    });
    glowMesh.visible = false;

    const lampLight = new THREE.PointLight(0xffd58a, 0, 32, 2);
    lampLight.position.set(0, 0, 0);
    scene.add(lampLight);

    streetLampState = {
        positions: lampPositions.map((pos) => pos.clone().add(new THREE.Vector3(0, 3.18, 0))),
        glowMesh,
        lampLight,
        enabled: false
    };
}

export function setStreetLightsEnabled(enabled) {
    if (!streetLampState) return;
    streetLampState.enabled = enabled;
    streetLampState.glowMesh.visible = enabled;
    if (!enabled) streetLampState.lampLight.intensity = 0;
}

// 只保留離玩家最近的一盞路燈作為實際 PointLight，避免手機上燈光數量過多
export function updateStreetLampLighting(playerPosition) {
    if (!streetLampState || !streetLampState.enabled || !playerPosition) return;
    let nearest = null;
    let nearestDistSq = Infinity;
    for (const pos of streetLampState.positions) {
        const dx = pos.x - playerPosition.x;
        const dz = pos.z - playerPosition.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearest = pos;
        }
    }
    if (nearest) {
        streetLampState.lampLight.position.copy(nearest);
        streetLampState.lampLight.intensity = 1.7;
    }
}


// ==========================================
// 3. 建立松山環境、山體與四大特色 3D 地標
// ==========================================
function buildGuiaHillEnvironment(scene) {
    // 東望洋燈塔實際位置（由 GPX 原點正規化後的世界座標）
    const HILL_CENTER = new THREE.Vector3(GUIA_HILL_CENTER.x, 0, GUIA_HILL_CENTER.z);
    const HILL_RADIUS = 20;

    // 1. 中央松山山峰地形與底部草地
    const groundGeo = new THREE.CylinderGeometry(240, 260, 40, 32);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x1e3a2f });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -20.2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 中央東望洋山：上窄下寬的截錐山，山頂形成真正的平坦高台
    const hillGeo = new THREE.CylinderGeometry(8, HILL_RADIUS, 18, 24);
    const hillMat = new THREE.MeshLambertMaterial({ color: 0x365314 });
    const centerHill = new THREE.Mesh(hillGeo, hillMat);
    centerHill.position.set(HILL_CENTER.x, 7, HILL_CENTER.z);
    centerHill.castShadow = true;
    centerHill.receiveShadow = true;
    scene.add(centerHill);

    // 2. 山頂石造平台（直接鋪在截錐山平坦山頂上）
    const terraceMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.9 });
    const terraceTop = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.2, 0.35, 24), terraceMat);
    terraceTop.position.set(HILL_CENTER.x, 16.175, HILL_CENTER.z);
    terraceTop.castShadow = true;
    terraceTop.receiveShadow = true;
    scene.add(terraceTop);

    // 3. 地標一：東望洋燈塔與聖母雪地殿
    const lighthouseGroup = createGuiaLighthouse();
    lighthouseGroup.scale.setScalar(0.55);
    lighthouseGroup.position.set(HILL_CENTER.x, 16.35, HILL_CENTER.z);
    lighthouseGroup.traverse((obj) => {
        if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
        }
    });
    scene.add(lighthouseGroup);

    // 4. 地標二：松山防空洞入口 (Air-Raid Shelter Entrance) 在約 32% 處內側山壁
    const shelterSample = trackSamples[Math.floor(0.32 * TRACK_POINTS_COUNT)];
    const shelterGroup = new THREE.Group();
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x78716c });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(7, 5.5, 4), stoneMat);
    wall.position.y = 2.75;
    shelterGroup.add(wall);

    const archHole = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 4.2, 12), new THREE.MeshBasicMaterial({ color: 0x090d16 }));
    archHole.rotation.x = Math.PI / 2;
    archHole.position.set(0, 1.8, 0);
    shelterGroup.add(archHole);

    const shelterPos = shelterSample.point.clone().addScaledVector(shelterSample.right, -ROAD_WIDTH * 0.5 - 2.2);
    shelterGroup.position.copy(shelterPos);
    shelterGroup.lookAt(shelterSample.point);
    scene.add(shelterGroup);

    // 5. 地標三：松山健康徑中式涼亭 (Pavilion) 在約 76% 處
    const pavSample = trackSamples[Math.floor(0.76 * TRACK_POINTS_COUNT)];
    const pavGroup = new THREE.Group();
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x991b1b });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x065f46 });

    for (let px of [-2, 2]) {
        for (let pz of [-2, 2]) {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.2, 8), pillarMat);
            col.position.set(px, 2.1, pz);
            pavGroup.add(col);
        }
    }
    const pavRoof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.6, 6), roofMat);
    pavRoof.position.y = 5.2;
    pavGroup.add(pavRoof);

    const pavPos = pavSample.point.clone().addScaledVector(pavSample.right, -ROAD_WIDTH * 0.5 - 4.0);
    pavGroup.position.copy(pavPos);
    scene.add(pavGroup);

    // 6. 地標四：起點松山纜車站拱門
    const startSample = trackSamples[0];
    const archGroup = new THREE.Group();
    const archPillarGeo = new THREE.BoxGeometry(0.7, 6.5, 0.7);
    const archMat = new THREE.MeshStandardMaterial({ color: 0x059669 });
    const leftP = new THREE.Mesh(archPillarGeo, archMat);
    leftP.position.set(-ROAD_WIDTH * 0.5, 3.25, 0);
    const rightP = new THREE.Mesh(archPillarGeo, archMat);
    rightP.position.set(ROAD_WIDTH * 0.5, 3.25, 0);
    const topBanner = new THREE.Mesh(
        new THREE.BoxGeometry(ROAD_WIDTH + 1.4, 1.5, 0.8),
        new THREE.MeshBasicMaterial({ map: createMarkerTexture("澳門松山健康徑", "GUIA HILL FITNESS TRAIL", "#065f46") })
    );
    topBanner.position.set(0, 6.0, 0);
    archGroup.add(leftP, rightP, topBanner);
    archGroup.position.copy(startSample.point);
    const startAngle = Math.atan2(startSample.tangent.x, startSample.tangent.z);
    archGroup.rotation.y = startAngle;
    scene.add(archGroup);

    [shelterGroup, pavGroup, archGroup].forEach((group) => {
        group.traverse((obj) => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });
    });

    // 7. 沿路樹木：InstancedMesh 樹幹＋三色多層樹冠，數百棵樹只需 4 個 draw call
    const treeData = [];
    for (let i = 0; i < TRACK_POINTS_COUNT; i += 2) {
        const s = trackSamples[i];
        [-1, 1].forEach(side => {
            if (side === 1 && i % 4 === 0) return; // 外側留空隙看澳門遠景
            const dist = ROAD_WIDTH * 0.5 + 3.2 + Math.random() * 5.5;
            const treePos = s.point.clone().addScaledVector(s.right, side * dist);
            // 避免樹木插入中央燈塔山體
            if (Math.hypot(treePos.x - HILL_CENTER.x, treePos.z - HILL_CENTER.z) < HILL_RADIUS + 1.5) return;
            treeData.push({
                position: treePos,
                scale: 0.85 + Math.random() * 0.6,
                rotation: Math.random() * Math.PI * 2,
                colorSeed: Math.floor(Math.random() * 3)
            });
        });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 2.6, 7);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4032 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeData.length);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;

    // 以多層低多邊形二十面體組成樹冠，混合深綠、翠綠、黃綠
    const foliageGeo = new THREE.IcosahedronGeometry(1.0, 0);
    const foliageMats = [
        new THREE.MeshStandardMaterial({ color: 0x103b2b, roughness: 0.95, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.94, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.94, flatShading: true })
    ];
    const crownBuckets = [[], [], []];
    const dummy = new THREE.Object3D();

    treeData.forEach((tree, index) => {
        dummy.position.set(tree.position.x, tree.position.y + 1.3 * tree.scale, tree.position.z);
        dummy.rotation.set(0, tree.rotation, 0);
        dummy.scale.set(tree.scale, tree.scale, tree.scale);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(index, dummy.matrix);

        // 三個重疊的葉團，越高越小，形成有層次的樹冠
        const layers = [
            { y: 2.6, size: 1.8, spread: 0.45 },
            { y: 3.7, size: 1.45, spread: 0.85 },
            { y: 4.75, size: 1.05, spread: 0.55 }
        ];
        layers.forEach((layer, layerIndex) => {
            const colorIndex = (tree.colorSeed + layerIndex) % 3;
            const blobScale = layer.size * tree.scale * (0.82 + Math.random() * 0.36);
            crownBuckets[colorIndex].push({
                x: tree.position.x + (Math.random() - 0.5) * layer.spread * tree.scale,
                y: tree.position.y + layer.y * tree.scale,
                z: tree.position.z + (Math.random() - 0.5) * layer.spread * tree.scale,
                rx: Math.random() * Math.PI,
                ry: Math.random() * Math.PI * 2,
                rz: Math.random() * Math.PI,
                sx: blobScale * (0.85 + Math.random() * 0.3),
                sy: blobScale * (0.85 + Math.random() * 0.25),
                sz: blobScale * (0.85 + Math.random() * 0.3)
            });
        });
    });

    const crownMeshes = crownBuckets.map((records, materialIndex) => {
        if (records.length === 0) return null;
        const mesh = new THREE.InstancedMesh(foliageGeo, foliageMats[materialIndex], records.length);
        records.forEach((blob, index) => {
            dummy.position.set(blob.x, blob.y, blob.z);
            dummy.rotation.set(blob.rx, blob.ry, blob.rz);
            dummy.scale.set(blob.sx, blob.sy, blob.sz);
            dummy.updateMatrix();
            mesh.setMatrixAt(index, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        return mesh;
    }).filter(Boolean);

    trunkMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.frustumCulled = false;
    scene.add(trunkMesh);
    crownMeshes.forEach((mesh) => scene.add(mesh));

    // 8. 夜間路燈（同樣使用 InstancedMesh 減少 draw calls）
    buildStreetLamps(scene);

    // 9. 遠景澳門半島剪影（新葡京蓮花造型剪影與海景大樓）
    const skylineMat = new THREE.MeshLambertMaterial({ color: 0x3f4a5a });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 });
    // 遠處新葡京地標意象
    const glTower = new THREE.Group();
    const lotus = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 6), goldMat);
    lotus.scale.set(1, 1.8, 0.6);
    lotus.position.y = 25;
    const glTop = new THREE.Mesh(new THREE.CylinderGeometry(2, 9, 38, 8), goldMat);
    glTop.position.y = 48;
    glTower.add(lotus, glTop);
    glTower.position.set(185, -12, 160);
    scene.add(glTower);

    // 10. 低多邊形澳門城市天際線與友誼大橋（遠景剪影）
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildingCount = 36;
    const skyline = new THREE.InstancedMesh(buildingGeo, skylineMat, buildingCount);
    const skylineDummy = new THREE.Object3D();
    for (let i = 0; i < buildingCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 210 + Math.random() * 55;
        const width = 5 + Math.random() * 10;
        const height = 14 + Math.random() * 48;
        const depth = 5 + Math.random() * 8;
        skylineDummy.position.set(
            Math.cos(angle) * radius,
            -12 + height * 0.5,
            Math.sin(angle) * radius
        );
        skylineDummy.rotation.y = Math.random() * Math.PI;
        skylineDummy.scale.set(width, height, depth);
        skylineDummy.updateMatrix();
        skyline.setMatrixAt(i, skylineDummy.matrix);
    }
    skyline.instanceMatrix.needsUpdate = true;
    skyline.frustumCulled = false;
    scene.add(skyline);

    const bridge = new THREE.Group();
    const bridgeMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(190, 1.3, 4.5), bridgeMat);
    deck.position.y = 2;
    bridge.add(deck);
    [-58, 58].forEach((x) => {
        const pylon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 30, 6), bridgeMat);
        pylon.position.set(x, 16, 0);
        bridge.add(pylon);
        [-22, 22].forEach((offset) => {
            const cable = new THREE.Mesh(new THREE.BoxGeometry(0.35, 28, 0.35), bridgeMat);
            cable.position.set(x + offset, 15.5, 0);
            cable.rotation.z = offset > 0 ? -0.35 : 0.35;
            bridge.add(cable);
        });
    });
    bridge.position.set(-35, -12, 300);
    bridge.rotation.y = 0.12;
    scene.add(bridge);
}

/**
 * 建立整條松山跑道與沿線環境。
 * @param {THREE.Scene} scene Three.js 場景
 */
export function buildTrack(scene) {
    buildTrackGeometry(scene);
    buildGuiaHillEnvironment(scene);
}
