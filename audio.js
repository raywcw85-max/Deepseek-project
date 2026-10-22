// ==========================================
// audio.js - Web Audio API 動態合成遊戲音效與 BGM
// 不需要外部音訊檔案；若有 bgm.mp3 會優先使用
// ==========================================
const BGM_BPM = 124;
const BGM_MELODY = [72, 67, 69, 64, 67, 72, 74, 76, 72, 67, 69, 67, 64, 62, 64, 67];
const BGM_CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
const BGM_BASS = [48, 43, 45, 41];

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.noiseBuffer = null;
        this.ambientStarted = false;
        this.ambientNodes = [];
        this.ambientTimer = null;
        this.muted = false;
        this.stepTimer = 0;
        this.boostCooldown = 0;

        // BGM 狀態
        this.musicEnabled = true;
        this.musicRunning = false;
        this.musicGain = null;
        this.synthStarted = false;
        this.synthTimer = null;
        this.bgmStep = 0;
        this.bgmNextNoteTime = 0;
        this.musicRequest = 0;
        this.bgmAudioElement = typeof Audio !== 'undefined' ? new Audio() : null;
        if (this.bgmAudioElement) {
            this.bgmAudioElement.loop = true;
            this.bgmAudioElement.preload = 'none';
            this.bgmAudioElement.addEventListener('error', () => {
                if (this.externalBgmActive && this.musicEnabled && !this.muted) {
                    this.externalBgmActive = false;
                    this.startSynthBgm();
                }
            });
        }
        this.bgmMediaSource = null;
        this.externalBgmActive = false;
        this.externalBgmChecked = false;
        this.externalBgmAvailable = false;
    }

    // 必須由使用者手勢呼叫，例如點擊「立即起跑」
    async unlock() {
        try {
            if (!this.ctx) this.createContext();
            if (!this.ctx) return false;
            if (this.ctx.state === 'suspended') await this.ctx.resume();
            if (!this.muted) {
                this.startAmbient();
                this.startMusic();
            }
            return this.ctx.state === 'running';
        } catch (error) {
            console.warn('[audio] AudioContext 無法啟動：', error);
            return false;
        }
    }

    createContext() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        this.ctx = new AudioContextClass();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.6;
        this.master.connect(this.ctx.destination);
        this.noiseBuffer = this.createNoiseBuffer();
    }

    createNoiseBuffer() {
        const length = Math.floor(this.ctx.sampleRate * 2);
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < length; i++) {
            const white = Math.random() * 2 - 1;
            brown = (brown + 0.02 * white) / 1.02;
            data[i] = brown * 3.5;
        }
        return buffer;
    }

    startAmbient() {
        if (!this.ctx || this.ambientStarted || this.muted) return;
        this.ambientStarted = true;

        const wind = this.ctx.createBufferSource();
        wind.buffer = this.noiseBuffer;
        wind.loop = true;
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'lowpass';
        windFilter.frequency.value = 240;
        windFilter.Q.value = 0.7;
        const windGain = this.ctx.createGain();
        windGain.gain.value = 0.035;
        wind.connect(windFilter).connect(windGain).connect(this.master);
        wind.start();

        const leaves = this.ctx.createBufferSource();
        leaves.buffer = this.noiseBuffer;
        leaves.loop = true;
        const leavesFilter = this.ctx.createBiquadFilter();
        leavesFilter.type = 'bandpass';
        leavesFilter.frequency.value = 1100;
        leavesFilter.Q.value = 0.8;
        const leavesGain = this.ctx.createGain();
        leavesGain.gain.value = 0.009;
        leaves.connect(leavesFilter).connect(leavesGain).connect(this.master);
        leaves.start();

        this.ambientNodes.push(wind, leaves);
        this.scheduleCritter();
    }

    scheduleCritter() {
        if (!this.ambientStarted || this.muted) return;
        const delay = 1600 + Math.random() * 3800;
        this.ambientTimer = window.setTimeout(() => {
            this.playCritter();
            this.scheduleCritter();
        }, delay);
    }

    // 隨機蟬鳴或鳥叫
    playCritter() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.connect(this.master);

        if (Math.random() < 0.5) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            const base = 2800 + Math.random() * 1200;
            osc.frequency.setValueAtTime(base, now);
            for (let i = 0; i < 4; i++) {
                const t = now + i * 0.055;
                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.linearRampToValueAtTime(0.012, t + 0.012);
                gain.gain.linearRampToValueAtTime(0.0001, t + 0.04);
            }
            osc.connect(gain);
            osc.start(now);
            osc.stop(now + 0.3);
        } else {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1500 + Math.random() * 500, now);
            osc.frequency.exponentialRampToValueAtTime(2600 + Math.random() * 700, now + 0.08);
            osc.frequency.exponentialRampToValueAtTime(1800, now + 0.16);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.025, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
            osc.connect(gain);
            osc.start(now);
            osc.stop(now + 0.27);
        }
    }

    stopAmbient() {
        if (this.ambientTimer) {
            clearTimeout(this.ambientTimer);
            this.ambientTimer = null;
        }
        this.ambientNodes.forEach((node) => {
            try {
                node.stop();
                node.disconnect();
            } catch (error) {
                // 節點可能已停止
            }
        });
        this.ambientNodes = [];
        this.ambientStarted = false;
    }

    // 優先使用根目錄 bgm.mp3；找不到才啟動程式合成 BGM
    async startMusic() {
        if (!this.ctx || this.muted || !this.musicEnabled || this.musicRunning) return;
        this.musicRunning = true;
        const requestId = ++this.musicRequest;

        if (!this.musicGain) {
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.15;
            this.musicGain.connect(this.master);
        }
        const now = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setTargetAtTime(0.15, now, 0.05);

        const external = await this.tryExternalBgm();
        if (requestId !== this.musicRequest || !this.musicRunning) return;
        if (!external) this.startSynthBgm();
    }

    async tryExternalBgm() {
        if (!this.bgmAudioElement) return false;
        if (this.externalBgmChecked && !this.externalBgmAvailable) return false;
        try {
            if (!this.externalBgmChecked) {
                const response = await fetch('bgm.mp3', { method: 'HEAD' });
                this.externalBgmChecked = true;
                this.externalBgmAvailable = response.ok;
                if (!response.ok) return false;
            }

            this.bgmAudioElement.src = 'bgm.mp3';
            this.bgmAudioElement.volume = 1;
            if (!this.bgmMediaSource) {
                this.bgmMediaSource = this.ctx.createMediaElementSource(this.bgmAudioElement);
                this.bgmMediaSource.connect(this.musicGain);
            }
            await this.bgmAudioElement.play();
            if (!this.musicEnabled || this.muted || !this.musicRunning) {
                this.bgmAudioElement.pause();
                return false;
            }
            this.externalBgmActive = true;
            return true;
        } catch (error) {
            this.externalBgmChecked = true;
            this.externalBgmAvailable = false;
            return false;
        }
    }

    startSynthBgm() {
        if (!this.ctx || this.muted || !this.musicEnabled || this.synthStarted || !this.musicRunning) return;
        this.synthStarted = true;
        this.bgmStep = 0;
        this.bgmNextNoteTime = this.ctx.currentTime + 0.1;
        this.synthTimer = window.setInterval(() => this.scheduleMusic(), 25);
        this.scheduleMusic();
    }

    scheduleMusic() {
        if (!this.ctx || !this.synthStarted || !this.musicEnabled || this.muted) return;
        const stepDuration = 60 / BGM_BPM / 2;
        const horizon = this.ctx.currentTime + 0.15;
        while (this.bgmNextNoteTime < horizon) {
            this.playMusicStep(this.bgmStep, this.bgmNextNoteTime);
            this.bgmStep = (this.bgmStep + 1) % BGM_MELODY.length;
            this.bgmNextNoteTime += stepDuration;
        }
    }

    playMusicStep(step, when) {
        const stepDuration = 60 / BGM_BPM / 2;
        this.playMusicNote(BGM_MELODY[step], when, stepDuration * 0.8, 0.075, 'triangle');

        // 每兩拍換一次和弦：C - G - Am - F
        if (step % 4 === 0) {
            const chordIndex = Math.floor(step / 4) % BGM_CHORDS.length;
            BGM_CHORDS[chordIndex].forEach((midi) => {
                this.playMusicNote(midi, when, stepDuration * 3.8, 0.03, 'sine');
            });
            this.playMusicNote(BGM_BASS[chordIndex], when, stepDuration * 2.5, 0.11, 'sine');
        }

        // 偶爾加一點高音亮點，令旋律更陽光明亮
        if (step % 8 === 4) {
            this.playMusicNote(84, when, stepDuration * 0.6, 0.018, 'sine');
        }
    }

    playMusicNote(midi, when, duration, volume, type = 'sine') {
        if (!this.ctx || !this.musicGain || this.muted) return;
        const frequency = 440 * Math.pow(2, (midi - 69) / 12);
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, when);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(volume, when + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
        osc.connect(gain).connect(this.musicGain);
        osc.start(when);
        osc.stop(when + duration + 0.03);
    }

    stopSynthBgm() {
        if (this.synthTimer) {
            clearInterval(this.synthTimer);
            this.synthTimer = null;
        }
        this.synthStarted = false;
        this.bgmStep = 0;
    }

    stopMusic() {
        this.musicRunning = false;
        this.musicRequest++;
        this.stopSynthBgm();
        this.externalBgmActive = false;
        if (this.bgmAudioElement) this.bgmAudioElement.pause();
        if (this.musicGain) {
            const now = this.ctx.currentTime;
            this.musicGain.gain.cancelScheduledValues(now);
            this.musicGain.gain.setTargetAtTime(0, now, 0.04);
        }
    }

    updateFootsteps(dt, speedKph, isSprinting = false) {
        if (!this.ctx || this.muted) return;
        if (this.boostCooldown > 0) this.boostCooldown -= dt;
        if (speedKph < 1) {
            this.stepTimer = 0;
            return;
        }

        const interval = Math.min(0.48, Math.max(0.24, 0.52 - speedKph * 0.012));
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
            this.playFootstep(isSprinting);
            this.stepTimer = interval * (0.88 + Math.random() * 0.24);
        }
    }

    playFootstep(isSprinting = false) {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = isSprinting ? 280 : 210;
        filter.Q.value = 0.85;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(isSprinting ? 0.16 : 0.11, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        noise.connect(filter).connect(gain).connect(this.master);
        noise.start(now);
        noise.stop(now + 0.13);

        const thump = this.ctx.createOscillator();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(58, now);
        thump.frequency.exponentialRampToValueAtTime(42, now + 0.09);
        const thumpGain = this.ctx.createGain();
        thumpGain.gain.setValueAtTime(0.0001, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.055, now + 0.006);
        thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        thump.connect(thumpGain).connect(this.master);
        thump.start(now);
        thump.stop(now + 0.12);
    }

    playBoost() {
        if (!this.ctx || this.muted || this.boostCooldown > 0) return;
        this.boostCooldown = 0.5;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.38);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1600;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        osc.connect(filter).connect(gain).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.45);
    }

    playDrink() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        [660, 990].forEach((frequency, index) => {
            const start = now + index * 0.12;
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(frequency, start);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.linearRampToValueAtTime(0.08, start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
            osc.connect(gain).connect(this.master);
            osc.start(start);
            osc.stop(start + 0.24);
        });
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.master) {
            const now = this.ctx.currentTime;
            this.master.gain.cancelScheduledValues(now);
            this.master.gain.setTargetAtTime(muted ? 0 : 0.6, now, 0.04);
        }
        if (muted) {
            this.stopAmbient();
            this.stopMusic();
        } else if (this.ctx) {
            this.startAmbient();
            if (this.musicEnabled) this.startMusic();
        }
    }

    toggleMuted() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    setMusicEnabled(enabled) {
        this.musicEnabled = enabled;
        if (!enabled) {
            this.stopMusic();
        } else if (this.ctx && !this.muted) {
            this.startMusic();
        }
    }

    toggleMusic() {
        this.setMusicEnabled(!this.musicEnabled);
        return this.musicEnabled;
    }
}

export const audio = new AudioEngine();
