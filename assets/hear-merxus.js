(() => {
  'use strict';
  const roots = [...document.querySelectorAll('[data-call-demos]')];
  if (!roots.length) return;
  const metadataUrl = '/audio/demos/merxus-bilingual-demo-transcripts.json';
  const descriptions = {
    'real-estate': { label: 'Real Estate', title: 'You were showing another house. Merxus just captured your next buyer.', flow: ['Spanish inquiry', 'Property information', 'Showing request', 'English confirmation', 'Lead captured'] },
    office: { label: 'Business / Office', title: 'Two customers. Two languages. One call.', flow: ['Appointment change', 'Spanish-speaking family member', 'New appointment', 'English follow-up'] },
  };
  const safeAudio = (value) => /^\/audio\/demos\/[a-z0-9-]+\.mp3$/.test(value || '') ? value : '';
  const formatTime = (seconds) => {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };
  const activeAudio = new Set();

  function renderCard(demo) {
    const copy = descriptions[demo.id];
    const card = document.createElement('article');
    card.className = 'demo-card';
    const heading = document.createElement('div');
    heading.innerHTML = '<p class="eyebrow"></p><h3></h3><p class="demo-summary"></p>';
    heading.querySelector('.eyebrow').textContent = copy?.label || demo.title;
    heading.querySelector('h3').textContent = copy?.title || demo.title;
    heading.querySelector('.demo-summary').textContent = demo.summary || '';
    card.append(heading);

    if (copy?.flow?.length) {
      const flow = document.createElement('div');
      flow.className = 'demo-flow';
      for (const step of copy.flow) {
        const chip = document.createElement('span');
        chip.textContent = step;
        flow.append(chip);
      }
      card.append(flow);
    }

    const audioPath = safeAudio(demo.audioUrl);
    if (!audioPath) return null;
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = audioPath;
    card.append(audio);
    activeAudio.add(audio);

    const controls = document.createElement('div');
    controls.className = 'demo-controls';
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'demo-play';
    play.textContent = '▶';
    play.setAttribute('aria-label', `Play ${copy?.label || demo.title} demonstration`);
    const progress = document.createElement('div');
    progress.className = 'demo-progress';
    const wave = document.createElement('div');
    wave.className = 'demo-waveform';
    wave.setAttribute('aria-hidden', 'true');
    const peaks = (Array.isArray(demo.waveform) && demo.waveform.length ? demo.waveform : Array.from({ length: 64 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 0.61)) * 0.6));
    const bars = peaks.map((peak) => {
      const bar = document.createElement('span');
      bar.style.height = `${Math.max(10, Math.min(58, Number(peak) * 58))}px`;
      wave.append(bar);
      return bar;
    });
    const seek = document.createElement('input');
    seek.type = 'range';
    seek.min = '0';
    seek.max = String(demo.durationSeconds || 0);
    seek.step = '0.05';
    seek.value = '0';
    seek.setAttribute('aria-label', `Seek through ${copy?.label || demo.title} demonstration`);
    const times = document.createElement('div');
    times.className = 'demo-times';
    const current = document.createElement('span');
    current.textContent = '0:00';
    const total = document.createElement('span');
    total.textContent = formatTime(demo.durationSeconds);
    times.append(current, total);
    progress.append(wave, seek, times);
    controls.append(play, progress);
    card.append(controls);
    const status = document.createElement('p');
    status.className = 'demo-status';
    status.setAttribute('role', 'status');
    card.append(status);

    const transcriptHeading = document.createElement('div');
    transcriptHeading.className = 'demo-transcript-heading';
    const title = document.createElement('strong');
    title.textContent = 'Follow the conversation';
    const languageSwitch = document.createElement('div');
    languageSwitch.setAttribute('role', 'group');
    languageSwitch.setAttribute('aria-label', 'Transcript display language');
    let mode = 'original';
    const modes = [
      ['original', 'Original'], ['english', 'English Translation'],
    ];
    const modeButtons = modes.map(([id, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-pressed', String(id === mode));
      button.addEventListener('click', () => {
        mode = id;
        modeButtons.forEach((item, index) => item.setAttribute('aria-pressed', String(modes[index][0] === mode)));
        updateTranscript();
      });
      languageSwitch.append(button);
      return button;
    });
    transcriptHeading.append(title, languageSwitch);
    card.append(transcriptHeading);

    const transcript = document.createElement('div');
    transcript.className = 'demo-transcript';
    transcript.setAttribute('role', 'region');
    transcript.setAttribute('aria-label', `${copy?.label || demo.title} transcript`);
    const lines = (demo.transcript || []).map((turn) => {
      const line = document.createElement('button');
      line.type = 'button';
      line.className = 'demo-line';
      const speaker = document.createElement('span');
      speaker.className = 'demo-speaker';
      speaker.textContent = `${turn.role === 'assistant' ? 'MERXUS' : turn.speaker} · ${String(turn.language || '').toLowerCase().startsWith('es') ? 'ESPAÑOL' : 'ENGLISH'}`;
      const words = document.createElement('span');
      words.className = 'demo-words';
      line.append(speaker, words);
      line.addEventListener('click', () => { audio.currentTime = Number(turn.startSeconds) || 0; updateProgress(); });
      transcript.append(line);
      return { line, words, turn };
    });
    card.append(transcript);

    function updateTranscript() {
      for (const { words, turn } of lines) words.textContent = mode === 'english' ? (turn.englishTranslation || turn.originalText || '') : (turn.originalText || turn.englishTranslation || '');
    }
    function updateProgress() {
      const duration = Number.isFinite(audio.duration) ? audio.duration : Number(demo.durationSeconds) || 0;
      const now = audio.currentTime || 0;
      seek.max = String(duration);
      seek.value = String(now);
      current.textContent = formatTime(now);
      total.textContent = formatTime(duration);
      const fraction = duration > 0 ? now / duration : 0;
      bars.forEach((bar, index) => bar.classList.toggle('played', (index + 0.5) / bars.length <= fraction));
      let active = 0;
      for (let index = 0; index < lines.length; index++) {
        if (now >= Number(lines[index].turn.startSeconds || 0)) active = index;
      }
      lines.forEach(({ line }, index) => line.setAttribute('aria-current', String(index === active)));
      if (!audio.paused && lines[active]) lines[active].line.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    updateTranscript();
    updateProgress();
    let tracked = false;
    play.addEventListener('click', async () => {
      status.textContent = '';
      if (!audio.paused) { audio.pause(); return; }
      for (const other of activeAudio) if (other !== audio && !other.paused) other.pause();
      if (audio.duration && audio.currentTime >= audio.duration - 0.15) audio.currentTime = 0;
      try {
        await audio.play();
        if (!tracked) {
          tracked = true;
          window.MerxusMarketingTrack?.demoPlayed?.(demo.id, demo.tenantType);
        }
      } catch (_) { status.textContent = 'Playback could not start. Please try again.'; }
    });
    seek.addEventListener('input', () => { audio.currentTime = Number(seek.value); updateProgress(); });
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('play', () => { play.textContent = 'Ⅱ'; play.setAttribute('aria-label', `Pause ${copy?.label || demo.title} demonstration`); });
    audio.addEventListener('pause', () => { play.textContent = '▶'; play.setAttribute('aria-label', `Play ${copy?.label || demo.title} demonstration`); });
    audio.addEventListener('ended', () => { play.textContent = '↺'; updateProgress(); });
    audio.addEventListener('error', () => { status.textContent = 'This demonstration is temporarily unavailable.'; });
    return card;
  }

  fetch(metadataUrl)
    .then((response) => { if (!response.ok) throw new Error('Metadata unavailable'); return response.json(); })
    .then((payload) => {
      const demos = Array.isArray(payload.demos) ? payload.demos : [];
      for (const root of roots) {
        const ids = String(root.dataset.callDemos || '').split(',').map((value) => value.trim());
        const cards = demos.filter((demo) => ids.includes(demo.id)).map(renderCard).filter(Boolean);
        if (cards.length) root.replaceChildren(...cards);
        else root.textContent = 'The call demonstrations are temporarily unavailable.';
      }
    })
    .catch(() => roots.forEach((root) => { root.textContent = 'The call demonstrations could not be loaded. Please try again shortly.'; }));
})();
