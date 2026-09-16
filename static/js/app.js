// Sitcom AI Studios - Frontend Controller

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const showInput = document.getElementById('showInput');
    const promptInput = document.getElementById('promptInput');
    const produceBtn = document.getElementById('produceBtn');
    const showChips = document.querySelectorAll('.show-chip');
    const randomPitchBtn = document.getElementById('randomPitchBtn');

    const tvChannelBadge = document.getElementById('tvChannelBadge');
    const tvEpisodeTitleBar = document.getElementById('tvEpisodeTitleBar');
    const stageEmptyState = document.getElementById('stageEmptyState');
    const activeStoryboardContainer = document.getElementById('activeStoryboardContainer');
    const tvLowerThird = document.getElementById('tvLowerThird');
    const spotlightAvatar = document.getElementById('spotlightAvatar');
    const spotlightName = document.getElementById('spotlightName');
    const spotlightStatus = document.getElementById('spotlightStatus');

    const storyboardTrack = document.getElementById('storyboardTrack');
    const storyboardCountText = document.getElementById('storyboardCountText');
    const castGrid = document.getElementById('castGrid');

    const scriptShowName = document.getElementById('scriptShowName');
    const scriptEpisodeTitle = document.getElementById('scriptEpisodeTitle');
    const scriptLogline = document.getElementById('scriptLogline');
    const scriptFormatPill = document.getElementById('scriptFormatPill');
    const scriptContentArea = document.getElementById('scriptContentArea');
    const teleprompterBody = document.getElementById('teleprompterBody');
    const autoScrollToggle = document.getElementById('autoScrollToggle');
    const clearScriptBtn = document.getElementById('clearScriptBtn');

    const inspectorHeader = document.getElementById('inspectorHeader');
    const inspectorBody = document.getElementById('inspectorBody');
    const inspectorToggleText = document.getElementById('inspectorToggleText');

    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const soundIcon = document.getElementById('soundIcon');
    const soundLabel = document.getElementById('soundLabel');
    const testSoundBtn = document.getElementById('testSoundBtn');

    // Screenplay & Watch Theater Elements
    const downloadScriptBtn = document.getElementById('downloadScriptBtn');
    const watchStoryboardBtn = document.getElementById('watchStoryboardBtn');
    const watchTheaterModal = document.getElementById('watchTheaterModal');
    const theaterTitle = document.getElementById('theaterTitle');
    const closeTheaterBtn = document.getElementById('closeTheaterBtn');
    const theaterStoryboardImg = document.getElementById('theaterStoryboardImg');
    const theaterAvatar = document.getElementById('theaterAvatar');
    const theaterSpeakerName = document.getElementById('theaterSpeakerName');
    const theaterSpeechText = document.getElementById('theaterSpeechText');
    const theaterPrevBtn = document.getElementById('theaterPrevBtn');
    const theaterPlayPauseBtn = document.getElementById('theaterPlayPauseBtn');
    const theaterNextBtn = document.getElementById('theaterNextBtn');
    const theaterProgress = document.getElementById('theaterProgress');

    // State
    let socket = null;
    let autoScroll = true;
    let soundEnabled = true;
    let inspectorOpen = true;
    let storyboardPanels = [];
    let castMap = {};
    let currentShowBible = null;
    let currentActiveScene = 1;
    let recordedEpisodeLines = [];
    let watchCurrentLineIndex = 0;
    let watchIsPlaying = false;
    let watchPlaybackTimer = null;
    let playbackVersion = 0;
    let replayFinished = false;

    // Curated comedic pitch presets
    const PRESET_PITCHES = {
        "The Office": [
            "Dwight discovers an autonomous AI agent is outselling him and suspects Jim installed it to ruin his beet farm reputation.",
            "Michael signs Dunder Mifflin up for a high-tech corporate metaverse retreat, but loses his virtual avatar in a digital lake.",
            "Jim places Dwight's entire desk inside an AI-powered smart vending machine that requires solving riddles to dispense a stapler."
        ],
        "Seinfeld": [
            "George hires an AI chatbot to maintain an automated relationship with his girlfriend's parents so he never has to visit Long Island.",
            "Kramer starts an underground artisan toast delivery service operated entirely via pigeons and Jerry's kitchen fire escape.",
            "Elaine's boss insists on replacing the J. Peterman catalogue copywriters with an AI trained exclusively on 18th-century pirate diaries."
        ],
        "Friends": [
            "Chandler uses an AI speech coach to cure his sarcastic vocal inflections, driving Monica crazy when he becomes unnervingly sincere.",
            "Joey accidentally agrees to star in a Japanese commercial where he plays a robot that is allergic to sandwiches.",
            "Phoebe writes a new protest song against smart refrigerators and stages a sit-in inside Central Perk's walk-in freezer."
        ],
        "Parks and Recreation": [
            "Ron Swanson discovers his face has been used as the default avatar for Pawnee's new automated tax filing kiosk.",
            "Leslie Knope organizes a 48-hour marathon town hall to debate whether robots should be allowed to run in the local squirrel festival.",
            "Tom and Jean-Ralphio launch 'GlowBot'—a company that rents out autonomous disco balls to high-end parties."
        ],
        "Brooklyn Nine-Nine": [
            "Captain Holt implements an emotionless AI detective system, triggering Jake Peralta into a high-stakes investigation duel.",
            "Boyle becomes convinced that a robotic vacuum cleaner in the precinct has developed a sophisticated palate for artisanal cheese.",
            "The annual Halloween Heist includes an autonomous drone programmed by Gina Linetti to mock everyone simultaneously."
        ],
        "It's Always Sunny in Philadelphia": [
            "The Gang invents their own cryptocurrency called 'Paddy's Bucks' and accidentally crashes the bar's entire electrical grid trying to mine it.",
            "Charlie finds an old laptop in the alley and believes he is communicating with the ghost of Benjamin Franklin through an AI chat.",
            "Dennis attempts to optimize the D.E.N.N.I.S. system using predictive neural networks."
        ],
        "Frasier": [
            "Frasier and Niles wage a bitter feud over an exclusive smart-home sommelier system that declared Niles' favorite Bordeaux 'vulgar'.",
            "Martin buys a loud electronic singing bass fish that interferes with Frasier's live psychiatric radio broadcast."
        ]
    };

    // Initialize Web Audio Engine
    soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        window.sitcomAudio.setMuted(!soundEnabled);
        soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
        soundLabel.textContent = soundEnabled ? 'Sound On' : 'Muted';
    });

    testSoundBtn.addEventListener('click', () => {
        window.sitcomAudio.playBassSlap();
    });

    // Preset Show Chips Click
    showChips.forEach(chip => {
        chip.addEventListener('click', () => {
            showChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const showName = chip.getAttribute('data-show');
            if (showName === 'Custom') {
                showInput.value = '';
                showInput.placeholder = 'Enter any show name...';
                showInput.focus();
            } else {
                showInput.value = showName;
                pickRandomPitchForShow(showName);
            }
        });
    });

    // Random Pitch Button
    randomPitchBtn.addEventListener('click', () => {
        const currentShow = showInput.value.trim() || 'The Office';
        pickRandomPitchForShow(currentShow);
    });

    function pickRandomPitchForShow(show) {
        const pitches = PRESET_PITCHES[show] || [
            "An absurd high-tech misunderstanding spirals into complete chaos at work and home.",
            "The main characters enter a fiercely competitive contest with ridiculous self-imposed stakes.",
            "A surprise visit from an eccentric rival forces the cast into an elaborate web of lies."
        ];
        const randomPitch = pitches[Math.floor(Math.random() * pitches.length)];
        promptInput.value = randomPitch;
    }

    // Auto-scroll toggle
    autoScrollToggle.addEventListener('click', () => {
        autoScroll = !autoScroll;
        autoScrollToggle.innerHTML = autoScroll ? '<span>📜</span> Auto-Scroll: On' : '<span>📜</span> Auto-Scroll: Off';
    });

    // Clear script button
    clearScriptBtn.addEventListener('click', () => {
        scriptContentArea.innerHTML = '';
    });

    // Inspector toggle
    inspectorHeader.addEventListener('click', () => {
        inspectorOpen = !inspectorOpen;
        inspectorBody.style.display = inspectorOpen ? 'flex' : 'none';
        inspectorToggleText.textContent = inspectorOpen ? 'Click to Collapse ▲' : 'Click to Expand ▼';
    });

    // Backend URL configuration (e.g. for Netlify frontend + Render/Fly backend)
    function getBackendOrigin() {
        const customUrl = localStorage.getItem('sitcom_backend_url');
        if (customUrl && customUrl.trim()) {
            return customUrl.trim().replace(/\/+$/, '');
        }
        return '';
    }

    function resolveAssetUrl(url) {
        if (!url) return '';
        if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
        const origin = getBackendOrigin();
        if (origin) {
            return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
        }
        return url;
    }

    function getWsUrl() {
        const origin = getBackendOrigin();
        if (origin) {
            const wsProto = origin.startsWith('https:') ? 'wss:' : 'ws:';
            const host = origin.replace(/^https?:\/\//, '');
            return `${wsProto}//${host}/ws/episode`;
        }
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws/episode`;
    }

    const serverConfigBtn = document.getElementById('serverConfigBtn');
    const serverConfigIcon = document.getElementById('serverConfigIcon');
    const serverConfigLabel = document.getElementById('serverConfigLabel');

    function updateServerStatusUI(connected) {
        if (!serverConfigLabel) return;
        const origin = getBackendOrigin();
        if (connected) {
            serverConfigIcon.textContent = '🟢';
            serverConfigLabel.textContent = origin ? 'Remote API' : 'Connected';
            serverConfigBtn.title = `Backend Connected: ${origin || window.location.origin}`;
        } else {
            serverConfigIcon.textContent = '🔌';
            serverConfigLabel.textContent = origin ? 'Reconnecting' : (window.location.hostname.includes('netlify.app') ? 'Set Backend' : 'Offline');
            serverConfigBtn.title = 'Click to configure backend server URL';
        }
    }

    if (serverConfigBtn) {
        serverConfigBtn.addEventListener('click', () => {
            const current = getBackendOrigin();
            const input = prompt(
                "Sitcom Studio Backend URL\n\nIf you deployed the Python backend to Render, Railway, or Fly.io, enter its HTTPS URL here (e.g. https://sitcom-studio.onrender.com).\n\nLeave blank to use the default same-origin server:",
                current
            );
            if (input !== null) {
                const cleaned = input.trim().replace(/\/+$/, '');
                if (cleaned) {
                    localStorage.setItem('sitcom_backend_url', cleaned);
                } else {
                    localStorage.removeItem('sitcom_backend_url');
                }
                if (socket) {
                    try { socket.close(); } catch(e) {}
                }
                connectWebSocket();
            }
        });
    }

    // WebSocket connection
    function connectWebSocket() {
        const wsUrl = getWsUrl();
        try {
            socket = new WebSocket(wsUrl);
        } catch(err) {
            console.error("Failed to initialize WebSocket:", err);
            updateServerStatusUI(false);
            return;
        }

        socket.onopen = () => {
            console.log("Connected to Sitcom Studio backend WebSocket:", wsUrl);
            updateServerStatusUI(true);
        };

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleServerEvent(message);
        };

        socket.onclose = () => {
            console.log("WebSocket connection closed. Reconnecting in 2s...");
            updateServerStatusUI(false);
            setTimeout(connectWebSocket, 2000);
        };

        socket.onerror = (err) => {
            console.error("WebSocket error:", err);
            updateServerStatusUI(false);
        };
    }

    connectWebSocket();

    // Produce Episode Button Click
    produceBtn.addEventListener('click', () => {
        const show = showInput.value.trim();
        if (!show) {
            alert("Please enter or select a TV show name!");
            return;
        }

        closeWatchTheater();
        const premise = promptInput.value.trim();
        produceBtn.disabled = true;
        produceBtn.innerHTML = '<span>⏳</span> Directing Episode...';

        // Reset UI for new production
        scriptContentArea.innerHTML = '';
        storyboardTrack.innerHTML = '';
        storyboardPanels = [];
        storyboardCountText.textContent = '0 Panels';
        stageEmptyState.style.display = 'none';
        activeStoryboardContainer.style.display = 'block';
        activeStoryboardContainer.innerHTML = `
            <div class="storyboard-vector-card">
                <div class="storyboard-vector-badge">WRITERS' ROOM ACTIVE</div>
                <div class="storyboard-vector-caption">Claude 3.5 Sonnet is pitching episode beats & character dossiers...</div>
            </div>
        `;

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                action: "start_episode",
                show_name: show,
                episode_prompt: premise,
                lines_per_scene: 12,
                guest_name: document.getElementById("guestInput").value.trim()
            }));
        }
    });

    // Event Handler for Streaming Multi-Agent Events
    function handleServerEvent(msg) {
        const type = msg.type;
        const data = msg.data;

        switch (type) {
            case 'status':
                showToast(msg.message);
                logAgentThought("System Floor Manager", msg.message, "#64748b");
                break;

            case 'show_bible_ready':
                handleShowBible(data);
                break;

            case 'scene_start':
                handleSceneStart(data);
                break;

            case 'agent_thinking':
                handleAgentThinking(data);
                break;

            case 'showrunner_cut':
                handleShowrunnerCut(data);
                break;

            case 'dialogue_line':
                handleDialogueLine(data);
                break;

            case 'storyboard_ready':
                handleStoryboardReady(data);
                break;

            case 'storyboard_updated':
                handleStoryboardUpdated(data);
                break;

            case 'scene_end':
                handleSceneEnd(data);
                break;

            case 'artwork_complete':
                produceBtn.disabled = false;
                produceBtn.innerHTML = '<span>🎬</span> Produce Episode';
                break;

            case 'episode_complete':
                handleEpisodeComplete(data);
                break;

            case 'error':
                showToast(`Error: ${msg.message}`);
                produceBtn.disabled = false;
                produceBtn.innerHTML = '<span>🎬</span> Produce Episode';
                break;
        }
    }

    function handleShowBible(bible) {
        window.sitcomAudio.playBassSlap();

        currentShowBible = bible;
        recordedEpisodeLines = [];
        storyboardPanels = [];
        storyboardTrack.innerHTML = '';
        storyboardCountText.textContent = '0 Panels';
        if (watchStoryboardBtn) watchStoryboardBtn.style.display = 'none';

        tvEpisodeTitleBar.textContent = `${bible.show_title}: "${bible.episode_title}"`;
        scriptShowName.textContent = bible.show_title.toUpperCase();
        scriptEpisodeTitle.textContent = `"${bible.episode_title}"`;
        scriptLogline.textContent = bible.logline;
        scriptFormatPill.textContent = bible.format_style || "Multi-Cam";

        // Render cast grid
        castGrid.innerHTML = '';
        castMap = {};
        const characters = bible.characters || [];
        characters.forEach(char => {
            castMap[char.id] = char;
            const card = document.createElement('div');
            card.className = 'cast-card';
            card.id = `cast_card_${char.id}`;
            card.style.borderTop = `3px solid ${char.avatar_color || '#3b82f6'}`;
            const voiceTag = char.voice_id ? `<span style="font-size:10px; color:#38bdf8; margin-top:2px;">🎙️ Voice: ${char.voice_id}</span>` : '';
            card.innerHTML = `
                <div class="cast-name" title="${char.name}">${char.name}</div>
                <div class="cast-archetype" title="${char.personality}">${char.actor_archetype}</div>
                ${voiceTag}
                <div class="cast-thinking-badge">
                    <span>⚡</span> <span>Thinking...</span>
                </div>
            `;
            if (char.cast_role === 'guest') {
            card.classList.add('special-guest');
            const badge = document.createElement('div');
            badge.className = 'guest-badge';
            badge.textContent = `🌟 SPECIAL GUEST${char.era ? ' · ' + char.era : ''}`;
            card.prepend(badge);
        }
        castGrid.appendChild(card);
        });

        const modelUsed = bible.model_used || "Claude 3.7 Sonnet";
        logAgentThought(
            `Showrunner (${modelUsed})`,
            `Assembled cast (${characters.map(c => c.name).join(', ')}). Episode locked: "${bible.episode_title}". Starting Scene 1.`,
            "#8b5cf6"
        );
    }

    function handleSceneStart(scene) {
        window.sitcomAudio.playBassSlap();
        currentActiveScene = scene.scene_number;

        tvChannelBadge.textContent = `SCENE ${scene.scene_number} • ${scene.location.toUpperCase()}`;

        // Add slugline to screenplay
        const slug = document.createElement('div');
        slug.className = 'scene-slugline';
        slug.textContent = `SCENE ${scene.scene_number}: ${scene.title.toUpperCase()} - ${scene.location.toUpperCase()}`;
        scriptContentArea.appendChild(slug);

        if (scene.director_notes) {
            const notes = document.createElement('div');
            notes.className = 'scene-action-note';
            notes.textContent = `[DIRECTOR'S NOTE: ${scene.director_notes}]`;
            scriptContentArea.appendChild(notes);
        }

        scrollTeleprompter();
    }

    function handleAgentThinking(agentData) {
        // Unhighlight previous
        document.querySelectorAll('.cast-card').forEach(c => {
            c.classList.remove('thinking');
            c.classList.remove('speaking');
        });

        const activeCard = document.getElementById(`cast_card_${agentData.agent_id}`);
        if (activeCard) {
            activeCard.classList.add('thinking');
        }

        spotlightAvatar.style.backgroundColor = agentData.avatar_color || '#4f46e5';
        spotlightAvatar.textContent = (agentData.agent_name || 'A')[0];
        spotlightName.textContent = agentData.agent_name;
        spotlightStatus.textContent = "Formulating line...";
        tvLowerThird.style.display = 'flex';
    }

    function handleShowrunnerCut(data) {
        const card = document.createElement('aside');
        card.className = 'showrunner-cut';
        const title = document.createElement('strong');
        title.textContent = `🎬 CUT! ${data.speaker_name} — take ${data.take}`;
        const rejected = document.createElement('blockquote');
        rejected.textContent = data.rejected_speech;
        const note = document.createElement('p');
        note.textContent = `${data.reason} ${data.direction}`;
        const status = document.createElement('small');
        status.textContent = data.final_attempt ? 'Moving on — this line stays on the cutting-room floor.' : 'Back to your mark. Let’s try that again…';
        card.append(title, rejected, note, status);
        scriptContentArea.appendChild(card);
        spotlightName.textContent = 'Showrunner';
        spotlightStatus.textContent = data.final_attempt ? 'Moving to the next beat' : 'Calling for a retake';
        scrollTeleprompter();
    }

    function handleDialogueLine(line) {
        // Cast highlight
        document.querySelectorAll('.cast-card').forEach(c => c.classList.remove('thinking'));
        const activeCard = document.getElementById(`cast_card_${line.speaker_id}`);
        if (activeCard) {
            activeCard.classList.add('speaking');
        }

        // TV Lower Third
        spotlightAvatar.style.backgroundColor = line.avatar_color || '#4f46e5';
        spotlightAvatar.textContent = (line.speaker_name || 'A')[0];
        spotlightName.textContent = line.speaker_name;
        spotlightStatus.textContent = "Speaking on set";
        tvLowerThird.style.display = 'flex';

        // Sound trigger
        const cue = line.audience_reaction || '[None]';
        if (cue.includes('Big') || cue.includes('Cheers')) {
            window.sitcomAudio.playLaughter('big');
        } else if (cue.includes('Mild')) {
            window.sitcomAudio.playLaughter('mild');
        } else if (cue.includes('Ooooh') || cue.includes('Groan')) {
            window.sitcomAudio.playGasp();
        } else if (cue.includes('Awkward') || cue.includes('Rimshot')) {
            window.sitcomAudio.playRimshot();
        }

        // Screenplay Dialogue Entry
        const entry = document.createElement('div');
        entry.className = 'dialogue-entry';
        if (line.take > 1) {
            const takeBadge = document.createElement('div');
            takeBadge.className = 'approved-take';
            takeBadge.textContent = `✓ Take ${line.take} — that’s a keeper`;
            scriptContentArea.appendChild(takeBadge);
        }

        let innerHtml = `
            <div class="dialogue-character-heading" style="color: ${line.avatar_color || '#38bdf8'}">
                <span>●</span> ${line.speaker_name.toUpperCase()}
            </div>
        `;

        if (line.stage_direction && line.stage_direction.trim()) {
            innerHtml += `<div class="dialogue-stage-direction">${line.stage_direction}</div>`;
        }

        innerHtml += `<div class="dialogue-line-speech">"${line.speech}"</div>`;

        if (cue !== '[None]') {
            innerHtml += `<div class="audience-cue-badge">👏 ${cue.replace(/[\[\]]/g, '')}</div>`;
        }

        entry.innerHTML = innerHtml;
        scriptContentArea.appendChild(entry);
        scrollTeleprompter();

        // Log agent's private thought to the Inspector!
        if (line.inner_thought) {
            logAgentThought(line.speaker_name, line.inner_thought, line.avatar_color || '#38bdf8');
        }

        // Record line for screenplay export & Watch Storyboard Animatic
        const voice = line.voice_id || (castMap[line.speaker_id]?.voice_id) || 'fable';
        recordedEpisodeLines.push({
            speaker_id: line.speaker_id,
            speaker_name: line.speaker_name,
            avatar_color: line.avatar_color,
            voice_id: voice,
            stage_direction: line.stage_direction,
            speech: line.speech,
            audience_reaction: cue,
            scene_number: currentActiveScene
        });

        // Speak character line live in character!
        if (soundEnabled && line.speech && watchTheaterModal.style.display !== 'flex') {
            window.sitcomAudio.speakLine(
                line.speech,
                voice,
                line.speaker_name, null, (message) => {
                    if (!document.getElementById("liveAudioError")) {
                        const notice = document.createElement("div");
                        notice.id = "liveAudioError"; notice.className = "art-status"; notice.textContent = message;
                        scriptContentArea.prepend(notice);
                    }
                }
            );
        }
    }

    function artMessage(panel) {
        return panel.error || (panel.pending ? 'Creating scene artwork…' : panel.is_fallback ? 'Scene placeholder' : 'Scene artwork ready');
    }

    function showPanel(container, panel, thumbnail = false) {
        container.replaceChildren();
        const image = document.createElement('img');
        image.className = thumbnail ? '' : 'active-storyboard-img';
        image.alt = panel.caption || panel.scene_title || 'Scene artwork';
        const status = document.createElement('div');
        status.className = thumbnail ? 'thumb-scene-pill' : 'art-status';
        status.textContent = thumbnail ? `SC ${panel.scene_number}${panel.error ? ' · unavailable' : panel.pending ? ' · drawing' : ''}` : artMessage(panel);
        image.onerror = () => { image.style.display = 'none'; status.textContent = 'Scene image could not be loaded.'; };
        if (panel.image_url) image.src = resolveAssetUrl(panel.image_url);
        container.append(image, status);
    }

    function handleStoryboardReady(panel) { handleStoryboardUpdated(panel); }

    function handleStoryboardUpdated(panel) {
        const index = storyboardPanels.findIndex(p => p.scene_number === panel.scene_number);
        if (index < 0) storyboardPanels.push(panel); else storyboardPanels[index] = panel;
        storyboardCountText.textContent = `${storyboardPanels.filter(p => !p.is_fallback).length} artwork / ${storyboardPanels.length} scenes`;
        stageEmptyState.style.display = 'none';
        activeStoryboardContainer.style.display = 'flex';
        if (panel.scene_number === currentActiveScene) showPanel(activeStoryboardContainer, panel);
        let thumb = document.getElementById(`thumb_scene_${panel.scene_number}`);
        if (!thumb) {
            thumb = document.createElement('div');
            thumb.id = `thumb_scene_${panel.scene_number}`;
            thumb.className = 'storyboard-thumb-card';
            thumb.addEventListener('click', () => {
                const latest = storyboardPanels.find(p => p.scene_number === panel.scene_number);
                showPanel(activeStoryboardContainer, latest);
            });
            storyboardTrack.appendChild(thumb);
        }
        showPanel(thumb, panel, true);
        if (watchTheaterModal.style.display === 'flex') updateTheaterArt();
    }

    function updateTheaterArt() {
        const line = recordedEpisodeLines[watchCurrentLineIndex];
        const panel = storyboardPanels.find(p => p.scene_number === line?.scene_number);
        const status = document.getElementById('theaterArtStatus');
        status.textContent = panel ? artMessage(panel) : 'Scene artwork is not available yet. The table read can still play.';
        theaterStoryboardImg.style.display = panel?.image_url ? 'block' : 'none';
        theaterStoryboardImg.onerror = () => {
            theaterStoryboardImg.style.display = 'none';
            status.textContent = 'Scene image could not be loaded. The table read can still play.';
        };
        if (panel?.image_url) theaterStoryboardImg.src = resolveAssetUrl(panel.image_url);
        else theaterStoryboardImg.removeAttribute('src');
    }

    function handleSceneEnd(scene) {
        window.sitcomAudio.playBassSlap();
        const endCue = document.createElement('div');
        endCue.className = 'scene-action-note';
        endCue.style.textAlign = 'center';
        endCue.style.marginTop = '16px';
        endCue.textContent = `[END OF SCENE ${scene.scene_number} - SLAP BASS TRANSITION]`;
        scriptContentArea.appendChild(endCue);
        scrollTeleprompter();
    }

    function handleEpisodeComplete(data) {
        window.sitcomAudio.playRimshot();

        const fadeOut = document.createElement('div');
        fadeOut.className = 'script-title-block';
        fadeOut.style.marginTop = '40px';
        fadeOut.innerHTML = `
            <div style="font-size: 20px; font-weight: 800; color: #facc15;">FADE OUT.</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">
                EXECUTIVE PRODUCERS: THE AI MULTI-AGENT ENSEMBLE
            </div>
        `;
        scriptContentArea.appendChild(fadeOut);
        scrollTeleprompter();

        produceBtn.disabled = true;
        produceBtn.textContent = "Finishing artwork…";
        if (watchStoryboardBtn) watchStoryboardBtn.style.display = 'inline-flex';
        showToast(`🎉 Episode "${data.episode_title}" Complete! Click "Listen to Table Read" for voices and audience reactions!`);
    }

    // Download Hollywood Screenplay (.txt)
    function downloadScreenplay() {
        if (!currentShowBible || recordedEpisodeLines.length === 0) {
            showToast("No completed episode to download yet!");
            return;
        }

        const title = (currentShowBible.episode_title || "Untitled Episode").toUpperCase();
        const show = (currentShowBible.show_title || "TV SHOW").toUpperCase();
        const logline = currentShowBible.logline || "";
        const format = (currentShowBible.format_style || "Half-Hour Sitcom").toUpperCase();

        let script = "";
        script += "=".repeat(78) + "\n";
        script += `                                 ${show}\n`;
        script += `                             "${title}"\n`;
        script += "=".repeat(78) + "\n\n";
        script += `FORMAT: ${format}\n`;
        script += `WRITTEN BY: ScriptCraft Multi-Agent Writers' Room\n`;
        script += `SHOWRUNNER: Claude 3.7 Sonnet | CAST ENSEMBLE: OpenAI GPT-4o\n\n`;
        script += `LOGLINE:\n${logline}\n\n`;
        script += "CAST OF CHARACTERS:\n";
        (currentShowBible.characters || []).forEach(c => {
            script += `  * ${c.name.toUpperCase()} (${c.actor_archetype || "Lead"}): ${c.personality}\n`;
        });
        script += "\n" + "=".repeat(78) + "\n\n";

        let lastSceneNum = null;
        recordedEpisodeLines.forEach((item) => {
            if (item.scene_number !== lastSceneNum) {
                lastSceneNum = item.scene_number;
                const sData = (currentShowBible.scenes || []).find(s => s.scene_number === lastSceneNum);
                const sLoc = sData ? sData.location.toUpperCase() : "MAIN STAGE";
                const sTitle = sData ? sData.title.toUpperCase() : `SCENE ${lastSceneNum}`;
                script += `\n\nSCENE ${lastSceneNum}: ${sTitle} - ${sLoc}\n`;
                script += "-".repeat(60) + "\n";
                if (sData && sData.director_notes) {
                    script += `[DIRECTOR'S NOTE: ${sData.director_notes}]\n\n`;
                }
            }

            script += `\n                        ${item.speaker_name.toUpperCase()}\n`;
            if (item.stage_direction && item.stage_direction.trim()) {
                script += `                 (${item.stage_direction.replace(/[\[\]]/g, '')})\n`;
            }
            script += `        ${item.speech}\n`;
            if (item.audience_reaction && item.audience_reaction !== '[None]') {
                script += `\n            [AUDIENCE: ${item.audience_reaction.replace(/[\[\]]/g, '')}]\n`;
            }
        });

        script += "\n\n                                  FADE OUT.\n\n";
        script += "                                  END OF EPISODE\n";

        const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const safeShow = show.replace(/[^A-Z0-9]/gi, '_');
        const safeTitle = title.replace(/[^A-Z0-9]/gi, '_');
        a.href = url;
        a.download = `${safeShow}_${safeTitle}_Screenplay.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Screenplay downloaded: ${safeTitle}.txt`);
    }

    if (downloadScriptBtn) {
        downloadScriptBtn.addEventListener('click', downloadScreenplay);
    }

    // Completed episode playback: voice, audience reaction, then next line.
    function stopWatchLine() {
        playbackVersion++;
        clearTimeout(watchPlaybackTimer);
        window.sitcomAudio.stopSpeech();
    }

    function openWatchTheater() {
        if (!recordedEpisodeLines.length) { showToast('No dialogue to play yet.'); return; }
        window.sitcomAudio.init();
        window.sitcomAudio.setMuted(false);
        soundEnabled = true;
        soundLabel.textContent = 'Sound On';
        soundIcon.textContent = '🔊';
        watchTheaterModal.style.display = 'flex';
        watchIsPlaying = true;
        replayFinished = false;
        theaterTitle.textContent = `${currentShowBible?.episode_title || 'Episode'} — Table Read`;
        playWatchLine(0);
    }

    function closeWatchTheater() {
        watchIsPlaying = false;
        stopWatchLine();
        watchTheaterModal.style.display = 'none';
    }

    function playWatchLine(index) {
        stopWatchLine();
        if (index >= recordedEpisodeLines.length) {
            replayFinished = true;
            watchIsPlaying = false;
            theaterPlayPauseBtn.textContent = '▶ Replay';
            return;
        }
        if (index < 0) return;
        replayFinished = false;
        watchCurrentLineIndex = index;
        const line = recordedEpisodeLines[index];
        const version = playbackVersion;
        theaterPlayPauseBtn.textContent = watchIsPlaying ? '⏸ Pause' : '▶ Play';
        theaterProgress.textContent = `Line ${index + 1} / ${recordedEpisodeLines.length}`;
        theaterAvatar.style.backgroundColor = line.avatar_color || '#6366f1';
        theaterAvatar.textContent = (line.speaker_name || 'A')[0];
        theaterSpeakerName.textContent = line.speaker_name;
        theaterSpeechText.textContent = line.speech;
        updateTheaterArt();
        if (!watchIsPlaying) return;
        document.getElementById("theaterAudioStatus").textContent = "AI-generated character voices";
        window.sitcomAudio.speakLine(line.speech, line.voice_id, line.speaker_name, () => {
            if (!watchIsPlaying || version !== playbackVersion) return;
            const delay = document.getElementById('laughTrackToggle').checked
                ? window.sitcomAudio.playAudienceCue(line.audience_reaction) : 250;
            watchPlaybackTimer = setTimeout(() => {
                if (watchIsPlaying && version === playbackVersion) playWatchLine(index + 1);
            }, delay + 250);
        }, (message) => {
            if (version !== playbackVersion) return;
            watchIsPlaying = false;
            stopWatchLine();
            theaterPlayPauseBtn.textContent = '▶ Retry AI voice';
            document.getElementById('theaterAudioStatus').textContent = message;
        });
    }

    function toggleWatchPlayback() {
        if (watchIsPlaying) {
            watchIsPlaying = false;
            stopWatchLine();
            theaterPlayPauseBtn.textContent = '▶ Resume line';
        } else {
            watchIsPlaying = true;
            window.sitcomAudio.setMuted(false);
            playWatchLine(replayFinished ? 0 : watchCurrentLineIndex);
        }
    }
    watchStoryboardBtn?.addEventListener('click', openWatchTheater);
    closeTheaterBtn?.addEventListener('click', closeWatchTheater);
    theaterPlayPauseBtn?.addEventListener('click', toggleWatchPlayback);
    theaterPrevBtn?.addEventListener('click', () => playWatchLine(Math.max(0, watchCurrentLineIndex - 1)));
    theaterNextBtn?.addEventListener('click', () => playWatchLine(Math.min(recordedEpisodeLines.length - 1, watchCurrentLineIndex + 1)));

    function logAgentThought(agentName, thought, color = '#06b6d4') {
        const entry = document.createElement('div');
        entry.className = 'thought-log-entry';
        entry.style.borderLeftColor = color;
        entry.innerHTML = `
            <div class="thought-agent-badge" style="color: ${color};">${agentName}:</div>
            <div class="thought-text">"${thought}"</div>
        `;
        inspectorBody.prepend(entry);
    }

    function scrollTeleprompter() {
        if (autoScroll) {
            teleprompterBody.scrollTop = teleprompterBody.scrollHeight;
        }
    }

    function showToast(text) {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `<span>📢</span> ${text}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3500);
    }
});
