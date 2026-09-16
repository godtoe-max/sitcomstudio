// Web Audio API procedural sound effects for Sitcom Studio
// Generates studio laughter, applause, 90s slap-bass stinger, and comedy rimshots procedurally!

class SitcomAudioEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (muted) this.stopSpeech();
    }

    // Play 90s Seinfeld-style slap bass transition stinger
    playBassSlap() {
        if (this.isMuted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const freqs = [110, 146.83, 164.81, 220];
        freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + idx * 0.12 + 0.2);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2500, now + idx * 0.12);
            filter.frequency.exponentialRampToValueAtTime(300, now + idx * 0.12 + 0.2);

            gain.gain.setValueAtTime(0.3, now + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.25);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.3);
        });
    }

    // Play comedy rimshot (ba-dum tss!)
    playRimshot() {
        if (this.isMuted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Snare 1
        this._snareHit(now);
        // Snare 2
        this._snareHit(now + 0.15);
        // Cymbal crash
        this._cymbalCrash(now + 0.3);
    }

    _snareHit(time) {
        const ctx = this.ctx;
        // Tone
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, time);
        osc.frequency.exponentialRampToValueAtTime(60, time + 0.08);
        oscGain.gain.setValueAtTime(0.4, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.09);

        // Noise
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 800;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(time);
        noise.stop(time + 0.1);
    }

    _cymbalCrash(time) {
        const ctx = this.ctx;
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 8000;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(time);
        noise.stop(time + 0.5);
    }

    // Play synthetic audience canned laughter
    playLaughter(intensity = 'mild') {
        if (this.isMuted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const count = intensity === 'big' ? 14 : 7;
        const duration = intensity === 'big' ? 1.8 : 1.1;

        for (let i = 0; i < count; i++) {
            const chuckleTime = now + (Math.random() * duration * 0.7);
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            const basePitch = 220 + Math.random() * 280;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(basePitch, chuckleTime);
            osc.frequency.linearRampToValueAtTime(basePitch + 60, chuckleTime + 0.08);
            osc.frequency.linearRampToValueAtTime(basePitch - 40, chuckleTime + 0.16);

            filter.type = 'bandpass';
            filter.frequency.value = 900 + Math.random() * 400;
            filter.Q.value = 3.0;

            const vol = (intensity === 'big' ? 0.08 : 0.04) * (1 - (chuckleTime - now) / duration);
            gain.gain.setValueAtTime(vol, chuckleTime);
            gain.gain.exponentialRampToValueAtTime(0.001, chuckleTime + 0.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(chuckleTime);
            osc.stop(chuckleTime + 0.22);
        }
    }

    // Play audience gasp / ooooh
    playGasp() {
        if (this.isMuted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.7);

        filter.type = 'lowpass';
        filter.frequency.value = 600;

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.75);
    }

    stopSpeech() {
        this.speechToken = (this.speechToken || 0) + 1;
        this.speechRequest?.abort();
        this.speechRequest = null;
        if (this.currentAudio) {
            this.currentAudio.onended = this.currentAudio.onerror = null;
            this.currentAudio.pause();
            this.currentAudio = null;
        }

    }

    async speakLine(text, voiceId = 'fable', speakerName = '', onComplete = null, onError = null) {
        this.stopSpeech();
        const token = this.speechToken;
        let finished = false;
        const done = () => {
            if (finished || token !== this.speechToken) return;
            finished = true;
            this.currentAudio = null;
            onComplete?.();
        };
        const clean = (text || '').replace(/\[.*?\]/g, '').trim();
        if (!clean || this.isMuted) { done(); return; }
        const request = new AbortController();
        this.speechRequest = request;
        const timeout = setTimeout(() => request.abort(), 45000);
        let failed = false;
        const fail = (message) => {
            if (failed || token !== this.speechToken) return;
            failed = true;
            this.currentAudio?.pause();
            onError?.(message || 'AI audio could not be played. Please retry.');
        };
        const backendOrigin = (typeof localStorage !== 'undefined' && localStorage.getItem('sitcom_backend_url')) ? localStorage.getItem('sitcom_backend_url').trim().replace(/\/+$/, '') : '';
        const ttsEndpoint = backendOrigin ? `${backendOrigin}/api/tts` : '/api/tts';
        try {
            const response = await fetch(ttsEndpoint, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, signal: request.signal,
                body: JSON.stringify({text: clean, voice: voiceId, speaker_name: speakerName})
            });
            const data = response.ok ? await response.json() : {};
            if (token !== this.speechToken) return;
            if (data.status === 'ok' && data.audio_url) {
                let audioUrl = data.audio_url;
                if (backendOrigin && audioUrl && !audioUrl.startsWith('http://') && !audioUrl.startsWith('https://') && !audioUrl.startsWith('data:')) {
                    audioUrl = `${backendOrigin}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
                }
                const audio = new Audio(audioUrl);
                this.currentAudio = audio;
                audio.onended = done;
                audio.onerror = () => fail("The AI voice clip could not be loaded. Please retry.");
                await audio.play();
            } else fail(data.message || "AI speech generation is unavailable. Check your account credits.");
        } catch (error) {
            if (token === this.speechToken) fail("AI speech timed out or could not be played. Please retry.");
        } finally { clearTimeout(timeout); }
    }

    playAudienceCue(cue = '') {
        if (cue.includes('Big') || cue.includes('Cheers')) { this.playLaughter('big'); return 1900; }
        if (cue.includes('Mild')) { this.playLaughter('mild'); return 1200; }
        if (cue.includes('Groan') || cue.includes('Ooooh')) { this.playGasp(); return 850; }
        if (cue.includes('Rimshot')) { this.playRimshot(); return 900; }
        return cue.includes('Awkward') ? 1400 : 300;
    }
}

window.sitcomAudio = new SitcomAudioEngine();
