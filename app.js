/**
 * KREYNTIX MOTION STUDIO — INTERACTIVE CLIENT ENGINE
 * Pure vanilla ES6+ architecture for high-performance canvas scrubbing & generative cinema.
 */

(function () {
  'use strict';

  /* ==========================================================================
     CONFIGURATION CONSTANTS
     ========================================================================== */
  const TOTAL_FRAMES = 600;
  const FRAME_DIR = 'sequence/';
  const FRAME_PREFIX = 'frame_';
  const FRAME_EXT = '.jpg';

  /* ==========================================================================
     APPLICATION STATE
     ========================================================================== */
  const state = {
    currentFrame: 1,
    targetFrame: 1,
    images: new Map(),
    loadedCount: 0,
    isImagesReady: false,
    scrollProgress: 0,
    audioActive: false,
    audioCtx: null,
    audioNodes: null,
    videosData: [],
    activeCategory: 'all',
    activeModalVideo: null,
    inspectorVideo: null
  };

  /* ==========================================================================
     DOM CACHE
     ========================================================================== */
  const dom = {
    canvas: document.getElementById('motion-canvas'),
    heroSection: document.getElementById('kinetic-hero'),
    hudFrameCount: document.getElementById('hud-frame-count'),
    hudVelocity: document.getElementById('hud-velocity'),
    hudRpm: document.getElementById('hud-rpm'),
    hudGear: document.getElementById('hud-gear'),
    cards: [
      document.getElementById('card-seq-1'),
      document.getElementById('card-seq-2'),
      document.getElementById('card-seq-3')
    ],
    seqButtons: document.querySelectorAll('.seq-btn'),
    manualSlider: document.getElementById('manual-frame-slider'),
    scrubTrackFill: document.getElementById('scrub-track-progress'),
    audioToggleBtn: document.getElementById('audio-toggle-btn'),
    audioBtnLabel: document.getElementById('audio-btn-label'),
    marqueeRowA: document.getElementById('marquee-row-a'),
    marqueeRowB: document.getElementById('marquee-row-b'),
    cinemaGrid: document.getElementById('cinema-grid'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    // Modal elements
    modal: document.getElementById('cinema-modal'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalVideo: document.getElementById('modal-video-element'),
    modalTitle: document.getElementById('modal-title'),
    modalCategory: document.getElementById('modal-category'),
    modalPlayBtn: document.getElementById('modal-play-btn'),
    modalScrub: document.getElementById('modal-scrub-input'),
    modalTimeTag: document.getElementById('modal-time-tag'),
    rateBtns: document.querySelectorAll('.rate-btn'),
    // Inspector elements
    inspectorVideo: document.getElementById('inspector-video-player'),
    inspectorPlayBtn: document.getElementById('inspector-play-btn'),
    inspectorTimeline: document.getElementById('inspector-timeline'),
    inspectorTimeReadout: document.getElementById('inspector-time-readout'),
    inspectorBadge: document.getElementById('inspector-badge-label'),
    inspectorSelect: document.getElementById('inspector-select-dropdown'),
    specTitle: document.getElementById('spec-title'),
    specCategory: document.getElementById('spec-category')
  };

  const ctx = dom.canvas.getContext('2d', { alpha: false });

  /* ==========================================================================
     FRAME SEQUENCE PRELOADER & CANVAS ENGINE
     ========================================================================== */
  function getFrameUrl(index) {
    const padded = String(index).padStart(4, '0');
    return `${FRAME_DIR}${FRAME_PREFIX}${padded}${FRAME_EXT}`;
  }

  function preloadFrames() {
    // Priority: preload frame 1 first for immediate render
    const initialImg = new Image();
    initialImg.src = getFrameUrl(1);
    initialImg.onload = () => {
      state.images.set(1, initialImg);
      renderFrame(1);
      // Preload the remaining frames progressively
      loadRemainingFrames();
    };
  }

  function loadRemainingFrames() {
    for (let i = 2; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFrameUrl(i);
      img.onload = () => {
        state.images.set(i, img);
        state.loadedCount++;
        if (state.loadedCount >= TOTAL_FRAMES - 1) {
          state.isImagesReady = true;
        }
      };
    }
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = dom.canvas.getBoundingClientRect();
    dom.canvas.width = rect.width * dpr;
    dom.canvas.height = rect.height * dpr;
    renderFrame(Math.round(state.currentFrame));
  }

  function renderFrame(frameIndex) {
    const clampedIndex = Math.min(Math.max(Math.round(frameIndex), 1), TOTAL_FRAMES);
    const img = state.images.get(clampedIndex);
    if (!img || !img.complete) return;

    const cw = dom.canvas.width;
    const ch = dom.canvas.height;
    const iw = img.naturalWidth || 1280;
    const ih = img.naturalHeight || 720;

    // Cover scale calculation
    const hRatio = cw / iw;
    const vRatio = ch / ih;
    const ratio = Math.max(hRatio, vRatio);

    const centerShiftX = (cw - iw * ratio) / 2;
    const centerShiftY = (ch - ih * ratio) / 2;

    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, iw, ih, centerShiftX, centerShiftY, iw * ratio, ih * ratio);
  }

  /* ==========================================================================
     SCROLL INTERACTION & LERP SMOOTHING
     ========================================================================== */
  function onScroll() {
    if (!dom.heroSection) return;
    const rect = dom.heroSection.getBoundingClientRect();
    const scrollDistance = dom.heroSection.offsetHeight - window.innerHeight;
    if (scrollDistance <= 0) return;

    // Calculate progress within hero section (0.0 to 1.0)
    const scrolled = -rect.top;
    const rawProgress = Math.min(Math.max(scrolled / scrollDistance, 0), 1);
    state.scrollProgress = rawProgress;
    state.targetFrame = 1 + rawProgress * (TOTAL_FRAMES - 1);
  }

  function updateTelemetry(frameNum) {
    // Telemetry calculations
    const normalized = (frameNum - 1) / (TOTAL_FRAMES - 1);
    const speed = Math.round(normalized * 348);
    const rpm = Math.round(1100 + normalized * 7300);
    const gear = Math.min(Math.max(Math.ceil(normalized * 7), 1), 7);

    // Update HUD metrics
    if (dom.hudFrameCount) {
      dom.hudFrameCount.textContent = `${String(Math.round(frameNum)).padStart(4, '0')} / 0240`;
    }
    if (dom.hudVelocity) {
      dom.hudVelocity.textContent = `${String(speed).padStart(3, '0')} KM/H`;
    }
    if (dom.hudRpm) {
      dom.hudRpm.textContent = `${rpm} RPM`;
    }
    if (dom.hudGear) {
      dom.hudGear.textContent = `GEAR ${gear}`;
    }

    // Update narrative cards
    let activeSeqIndex = 0;
    if (frameNum >= 160) {
      activeSeqIndex = 2;
    } else if (frameNum >= 80) {
      activeSeqIndex = 1;
    }

    dom.cards.forEach((card, idx) => {
      if (card) {
        if (idx === activeSeqIndex) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      }
    });

    // Update sequence nav buttons
    dom.seqButtons.forEach((btn, idx) => {
      if (idx === activeSeqIndex) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update manual scrubber slider
    if (dom.manualSlider) {
      dom.manualSlider.value = Math.round(frameNum);
    }
    if (dom.scrubTrackFill) {
      const pct = (normalized * 100).toFixed(2);
      dom.scrubTrackFill.style.width = `${pct}%`;
    }

    // Audio pitch modulation if active
    if (state.audioActive && state.audioNodes) {
      updateAudioPitch(rpm);
    }
  }

  // Linear Interpolation Render Loop (60 FPS)
  function animationLoop() {
    const diff = state.targetFrame - state.currentFrame;
    if (Math.abs(diff) > 0.05) {
      // Lerp smoothing coefficient
      state.currentFrame += diff * 0.12;
      renderFrame(state.currentFrame);
      updateTelemetry(state.currentFrame);
    }
    requestAnimationFrame(animationLoop);
  }

  /* ==========================================================================
     MANUAL SCRUBBER & KEYFRAME JUMPING
     ========================================================================== */
  function initHeroControls() {
    if (dom.manualSlider) {
      dom.manualSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.targetFrame = val;
        // Optionally sync window scroll position
        const scrollDistance = dom.heroSection.offsetHeight - window.innerHeight;
        const targetScrollY = dom.heroSection.offsetTop + ((val - 1) / (TOTAL_FRAMES - 1)) * scrollDistance;
        window.scrollTo({ top: targetScrollY, behavior: 'auto' });
      });
    }

    dom.seqButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetFrame = parseInt(btn.dataset.targetFrame, 10);
        const scrollDistance = dom.heroSection.offsetHeight - window.innerHeight;
        const targetScrollY = dom.heroSection.offsetTop + ((targetFrame - 1) / (TOTAL_FRAMES - 1)) * scrollDistance;
        window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
      });
    });
  }

  /* ==========================================================================
     WEB AUDIO SYNTHESIS ENGINE (REV & EXHAUST HARMONICS)
     ========================================================================== */
  function initAudioEngine() {
    if (dom.audioToggleBtn) {
      dom.audioToggleBtn.addEventListener('click', toggleAudio);
    }
  }

  function toggleAudio() {
    if (!state.audioActive) {
      startAudioSynthesis();
    } else {
      stopAudioSynthesis();
    }
  }

  function startAudioSynthesis() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new AudioContext();

      // Master gain
      const masterGain = state.audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.18, state.audioCtx.currentTime);
      masterGain.connect(state.audioCtx.destination);

      // Low bass rumble oscillator
      const oscLow = state.audioCtx.createOscillator();
      oscLow.type = 'sawtooth';
      oscLow.frequency.setValueAtTime(55, state.audioCtx.currentTime);

      // High harmonic oscillator
      const oscHigh = state.audioCtx.createOscillator();
      oscHigh.type = 'triangle';
      oscHigh.frequency.setValueAtTime(110, state.audioCtx.currentTime);

      // Resonant Lowpass Filter
      const filter = state.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, state.audioCtx.currentTime);
      filter.Q.setValueAtTime(3.5, state.audioCtx.currentTime);

      oscLow.connect(filter);
      oscHigh.connect(filter);
      filter.connect(masterGain);

      oscLow.start();
      oscHigh.start();

      state.audioNodes = { oscLow, oscHigh, filter, masterGain };
      state.audioActive = true;

      dom.audioToggleBtn.classList.add('active');
      dom.audioToggleBtn.setAttribute('aria-pressed', 'true');
      dom.audioBtnLabel.textContent = 'AUDIO ENGINE: ACTIVE';
    } catch (err) {
      console.warn('Web Audio synthesis initialisation deferred:', err);
    }
  }

  function stopAudioSynthesis() {
    if (state.audioNodes && state.audioCtx) {
      state.audioNodes.masterGain.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + 0.3);
      setTimeout(() => {
        state.audioCtx.close();
        state.audioCtx = null;
        state.audioNodes = null;
      }, 350);
    }
    state.audioActive = false;
    dom.audioToggleBtn.classList.remove('active');
    dom.audioToggleBtn.setAttribute('aria-pressed', 'false');
    dom.audioBtnLabel.textContent = 'AUDIO ENGINE: OFF';
  }

  function updateAudioPitch(rpm) {
    if (!state.audioNodes || !state.audioCtx) return;
    const baseFreq = 40 + (rpm / 8400) * 160;
    state.audioNodes.oscLow.frequency.setTargetAtTime(baseFreq, state.audioCtx.currentTime, 0.05);
    state.audioNodes.oscHigh.frequency.setTargetAtTime(baseFreq * 2, state.audioCtx.currentTime, 0.05);
    state.audioNodes.filter.frequency.setTargetAtTime(350 + (rpm / 8400) * 1400, state.audioCtx.currentTime, 0.05);
  }

  /* ==========================================================================
     VIDEO SHOWCASE & STREAM REEL (20 VIDEOS)
     ========================================================================== */
  async function loadVideosCatalog() {
    try {
      const resp = await fetch('videos.json');
      state.videosData = await resp.json();
      buildMarqueeRibbons();
      renderCinemaGrid();
      populateInspectorDropdown();
      // Load initial inspector item
      if (state.videosData.length > 0) {
        setInspectorClip(state.videosData[0]);
      }
    } catch (err) {
      console.error('Failed to load videos catalog:', err);
    }
  }

  function buildMarqueeRibbons() {
    if (!state.videosData || state.videosData.length === 0) return;

    // Split 20 videos: first 10 for row A, next 10 for row B
    const rowAItems = state.videosData.slice(0, 10);
    const rowBItems = state.videosData.slice(10, 20);

    function createCards(items) {
      return items.map((item) => `
        <div class="stream-card" data-video-id="${item.id}" role="button" tabindex="0" aria-label="Open ${item.title}">
          <video class="stream-video" src="${item.file}" muted loop playsinline></video>
          <div class="stream-card-overlay">
            <span class="stream-tag">${item.category.toUpperCase()}</span>
            <span class="stream-title">${item.title}</span>
          </div>
        </div>
      `).join('');
    }

    // Duplicate content in track for seamless infinite loop
    if (dom.marqueeRowA) {
      dom.marqueeRowA.innerHTML = createCards(rowAItems) + createCards(rowAItems);
    }
    if (dom.marqueeRowB) {
      dom.marqueeRowB.innerHTML = createCards(rowBItems) + createCards(rowBItems);
    }

    // Autoplay marquee videos on hover / visibility
    document.querySelectorAll('.stream-card').forEach((card) => {
      const vid = card.querySelector('video');
      card.addEventListener('mouseenter', () => {
        if (vid) vid.play().catch(() => {});
      });
      card.addEventListener('mouseleave', () => {
        if (vid) {
          vid.pause();
          vid.currentTime = 0;
        }
      });
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.videoId, 10);
        const item = state.videosData.find((v) => v.id === id);
        if (item) openCinemaModal(item);
      });
    });
  }

  function renderCinemaGrid() {
    if (!dom.cinemaGrid) return;

    const filtered = state.activeCategory === 'all'
      ? state.videosData
      : state.videosData.filter((v) => v.category === state.activeCategory);

    dom.cinemaGrid.innerHTML = filtered.map((item) => `
      <article class="video-card" data-video-id="${item.id}" role="button" tabindex="0" aria-label="Play ${item.title}">
        <div class="video-card-thumb-wrap">
          <img class="video-card-thumb" src="${item.thumbnail}" alt="${item.title}" loading="lazy">
          <video class="video-card-hover-video" src="${item.file}" muted loop playsinline></video>
          <span class="card-badge-category">${item.category.toUpperCase()}</span>
          <span class="card-badge-duration">${item.duration}</span>
        </div>
        <div class="video-card-body">
          <h3 class="video-card-title">${item.title}</h3>
          <div class="video-card-specs">
            <span>${item.resolution}</span>
            <span>&bull;</span>
            <span>${item.fps} FPS</span>
            <span>&bull;</span>
            <span>${item.aspectRatio}</span>
          </div>
        </div>
      </article>
    `).join('');

    // Attach hover video autoplay & click modal trigger
    dom.cinemaGrid.querySelectorAll('.video-card').forEach((card) => {
      const vid = card.querySelector('.video-card-hover-video');
      card.addEventListener('mouseenter', () => {
        if (vid) vid.play().catch(() => {});
      });
      card.addEventListener('mouseleave', () => {
        if (vid) {
          vid.pause();
          vid.currentTime = 0;
        }
      });
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.videoId, 10);
        const item = state.videosData.find((v) => v.id === id);
        if (item) openCinemaModal(item);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = parseInt(card.dataset.videoId, 10);
          const item = state.videosData.find((v) => v.id === id);
          if (item) openCinemaModal(item);
        }
      });
    });
  }

  function initCategoryFilters() {
    dom.filterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        dom.filterTabs.forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        state.activeCategory = tab.dataset.filter;
        renderCinemaGrid();
      });
    });
  }

  /* ==========================================================================
     CINEMA THEATER MODAL ENGINE
     ========================================================================== */
  function initCinemaModal() {
    if (dom.modalBackdrop) {
      dom.modalBackdrop.addEventListener('click', closeCinemaModal);
    }
    if (dom.modalCloseBtn) {
      dom.modalCloseBtn.addEventListener('click', closeCinemaModal);
    }

    if (dom.modalPlayBtn) {
      dom.modalPlayBtn.addEventListener('click', toggleModalPlay);
    }

    if (dom.modalVideo) {
      dom.modalVideo.addEventListener('timeupdate', updateModalTimeline);
      dom.modalVideo.addEventListener('ended', () => {
        dom.modalPlayBtn.textContent = 'REPLAY';
      });
    }

    if (dom.modalScrub) {
      dom.modalScrub.addEventListener('input', (e) => {
        if (!dom.modalVideo || !dom.modalVideo.duration) return;
        const pct = parseFloat(e.target.value);
        dom.modalVideo.currentTime = (pct / 100) * dom.modalVideo.duration;
      });
    }

    dom.rateBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        dom.rateBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const rate = parseFloat(btn.dataset.rate);
        if (dom.modalVideo) dom.modalVideo.playbackRate = rate;
      });
    });

    // Keyboard support: Escape closes, Space pauses/plays
    window.addEventListener('keydown', (e) => {
      if (dom.modal.classList.contains('open')) {
        if (e.key === 'Escape') {
          closeCinemaModal();
        } else if (e.key === ' ' && e.target.tagName !== 'INPUT') {
          e.preventDefault();
          toggleModalPlay();
        }
      }
    });
  }

  function openCinemaModal(item) {
    state.activeModalVideo = item;
    dom.modalTitle.textContent = item.title;
    dom.modalCategory.textContent = item.category.toUpperCase();
    dom.modalVideo.src = item.file;
    dom.modalVideo.playbackRate = 1.0;

    // Reset rate buttons
    dom.rateBtns.forEach((btn) => {
      if (btn.dataset.rate === '1') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    dom.modal.classList.add('open');
    dom.modal.setAttribute('aria-hidden', 'false');
    dom.modalVideo.play().catch(() => {});
    dom.modalPlayBtn.textContent = 'PAUSE';
  }

  function closeCinemaModal() {
    dom.modal.classList.remove('open');
    dom.modal.setAttribute('aria-hidden', 'true');
    if (dom.modalVideo) {
      dom.modalVideo.pause();
      dom.modalVideo.src = '';
    }
  }

  function toggleModalPlay() {
    if (!dom.modalVideo) return;
    if (dom.modalVideo.paused) {
      dom.modalVideo.play().catch(() => {});
      dom.modalPlayBtn.textContent = 'PAUSE';
    } else {
      dom.modalVideo.pause();
      dom.modalPlayBtn.textContent = 'PLAY';
    }
  }

  function updateModalTimeline() {
    if (!dom.modalVideo || !dom.modalVideo.duration) return;
    const cur = dom.modalVideo.currentTime;
    const dur = dom.modalVideo.duration;
    const pct = (cur / dur) * 100;
    dom.modalScrub.value = pct;

    const curSec = String(Math.floor(cur % 60)).padStart(2, '0');
    const curMin = String(Math.floor(cur / 60)).padStart(2, '0');
    const durSec = String(Math.floor(dur % 60)).padStart(2, '0');
    const durMin = String(Math.floor(dur / 60)).padStart(2, '0');
    dom.modalTimeTag.textContent = `${curMin}:${curSec} / ${durMin}:${durSec}`;
  }

  /* ==========================================================================
     FRAME INSPECTOR LAB ENGINE
     ========================================================================== */
  function populateInspectorDropdown() {
    if (!dom.inspectorSelect) return;
    dom.inspectorSelect.innerHTML = state.videosData.map((item) => `
      <option value="${item.id}">Clip ${String(item.id).padStart(2, '0')}: ${item.title} (${item.category})</option>
    `).join('');

    dom.inspectorSelect.addEventListener('change', (e) => {
      const id = parseInt(e.target.value, 10);
      const item = state.videosData.find((v) => v.id === id);
      if (item) setInspectorClip(item);
    });

    if (dom.inspectorPlayBtn) {
      dom.inspectorPlayBtn.addEventListener('click', toggleInspectorPlay);
    }

    if (dom.inspectorVideo) {
      dom.inspectorVideo.addEventListener('timeupdate', updateInspectorTimeline);
    }

    if (dom.inspectorTimeline) {
      dom.inspectorTimeline.addEventListener('input', (e) => {
        if (!dom.inspectorVideo || !dom.inspectorVideo.duration) return;
        const pct = parseFloat(e.target.value);
        dom.inspectorVideo.currentTime = (pct / 100) * dom.inspectorVideo.duration;
      });
    }
  }

  function setInspectorClip(item) {
    if (!dom.inspectorVideo) return;
    dom.inspectorVideo.src = item.file;
    dom.inspectorBadge.textContent = `CLIP ${String(item.id).padStart(2, '0')} // LOADED`;
    dom.specTitle.textContent = item.title;
    dom.specCategory.textContent = item.category;
    dom.inspectorVideo.play().catch(() => {});
  }

  function toggleInspectorPlay() {
    if (!dom.inspectorVideo) return;
    if (dom.inspectorVideo.paused) {
      dom.inspectorVideo.play().catch(() => {});
      dom.inspectorPlayBtn.textContent = 'PAUSE';
    } else {
      dom.inspectorVideo.pause();
      dom.inspectorPlayBtn.textContent = 'PLAY';
    }
  }

  function updateInspectorTimeline() {
    if (!dom.inspectorVideo || !dom.inspectorVideo.duration) return;
    const cur = dom.inspectorVideo.currentTime;
    const dur = dom.inspectorVideo.duration;
    const pct = (cur / dur) * 100;
    dom.inspectorTimeline.value = pct;

    const curSec = String(Math.floor(cur % 60)).padStart(2, '0');
    const curMin = String(Math.floor(cur / 60)).padStart(2, '0');
    const durSec = String(Math.floor(dur % 60)).padStart(2, '0');
    const durMin = String(Math.floor(dur / 60)).padStart(2, '0');
    dom.inspectorTimeReadout.textContent = `${curMin}:${curSec} / ${durMin}:${durSec}`;
  }

  /* ==========================================================================
     INITIALIZATION LIFECYCLE
     ========================================================================== */
  function init() {
    preloadFrames();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', onScroll, { passive: true });

    initHeroControls();
    initAudioEngine();
    initCategoryFilters();
    initCinemaModal();
    loadVideosCatalog();

    // Launch RAF interpolation loop
    requestAnimationFrame(animationLoop);
  }

  // DOM ready trigger
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
