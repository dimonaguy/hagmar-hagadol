(function () {
  'use strict';

  const OVERLAY_DIR = 'assets/overlays/';
  const STAT_KEYS = [
    { key: 'popularity', el: 'stat-popularity' },
    { key: 'alliances', el: 'stat-alliances' },
    { key: 'sanity', el: 'stat-sanity' }
  ];

  /** Fallback map if a node lacks background field */
  const BG_FALLBACK = {
    node_start: 'assets/bg/bg_start_3way.jpg',
    node_romance_path: 'assets/bg/bg_romance_2way.jpg',
    node_villain_path: 'assets/bg/bg_villain_2way.jpg',
    node_victim_path: 'assets/bg/bg_victim_2way.jpg',
    node_end_winner_hated: 'assets/bg/bg_end_winner.jpg',
    node_end_runner_up: 'assets/bg/bg_end_runner.jpg',
    node_end_ejected: 'assets/bg/bg_end_ejected.jpg',
    node_end_voted_out: 'assets/bg/bg_end_voted.jpg',
    node_end_self_eviction: 'assets/bg/bg_end_self.jpg',
    node_end_mastermind_win: 'assets/bg/bg_end_mastermind.jpg'
  };

  let gameData = null;
  let currentState = {};
  let currentNodeId = null;

  const titleEl = document.getElementById('node-title');
  const descEl = document.getElementById('node-desc');
  const stageBgEl = document.getElementById('stage-bg');
  const overlayContainer = document.getElementById('overlay-container');
  const creatorEl = document.getElementById('creator-credit');
  const mobileChoicesEl = document.getElementById('mobile-choices');
  const loadErrorEl = document.getElementById('load-error');

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function assetUrl(path) {
    if (window.ASSET_DATA && window.ASSET_DATA[path]) {
      return window.ASSET_DATA[path];
    }
    // also try without leading assets/ variants
    return encodeURI(path);
  }

  function overlayUrl(filename) {
    return assetUrl(OVERLAY_DIR + filename);
  }

  function updateStats(prev) {
    STAT_KEYS.forEach(({ key, el }) => {
      const node = document.getElementById(el);
      if (!node) return;
      const val = currentState[key];
      const old = prev ? prev[key] : val;
      node.textContent = String(val);
      node.classList.remove('flash-up', 'flash-down');
      if (prev && val !== old) {
        void node.offsetWidth;
        node.classList.add(val > old ? 'flash-up' : 'flash-down');
      }
    });
  }

  function applyModifiers(mods) {
    if (!mods) return;
    const prev = { ...currentState };
    Object.keys(mods).forEach((k) => {
      if (typeof currentState[k] === 'number') {
        currentState[k] = clamp(currentState[k] + mods[k], 0, 100);
      }
    });
    updateStats(prev);
  }

  function setBackground(node) {
    const src = node.background || BG_FALLBACK[node.id] || '';
    if (!src) {
      stageBgEl.style.backgroundImage = 'none';
      stageBgEl.style.background =
        'radial-gradient(circle at center, #4c1d95 0%, #0a0612 100%)';
      return;
    }
    stageBgEl.style.background = '';
    stageBgEl.style.backgroundImage = `url("${assetUrl(src)}")`;
  }

  function clearChoices() {
    overlayContainer.innerHTML = '';
    mobileChoicesEl.innerHTML = '';
  }

  function chooseOption(option) {
    applyModifiers(option.stateModifiers);
    if (option.targetNode) {
      renderNode(option.targetNode);
    }
  }

  function restartGame() {
    const init = gameData.gameSettings.initialState;
    currentState = {
      popularity: init.popularity,
      alliances: init.alliances,
      sanity: init.sanity
    };
    updateStats(null);
    renderNode('node_start');
  }

  function renderEnding(node) {
    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'restart-btn';
    restartBtn.textContent = 'התחל עונה מחדש';
    restartBtn.addEventListener('click', restartGame);
    overlayContainer.appendChild(restartBtn);

    const mobileRestart = document.createElement('button');
    mobileRestart.type = 'button';
    mobileRestart.className = 'mobile-choice-btn';
    mobileRestart.textContent = 'התחל עונה מחדש';
    mobileRestart.addEventListener('click', restartGame);
    mobileChoicesEl.appendChild(mobileRestart);
  }

  function renderChoices(options) {
    const count = options.length;
    options.forEach((option, index) => {
      const wrapper = document.createElement('button');
      wrapper.type = 'button';
      wrapper.className = `choice-wrapper pos-${count}-${index}`;
      wrapper.setAttribute('aria-label', option.label);

      const text = document.createElement('span');
      text.className = 'choice-text';
      text.textContent = option.label;

      const img = document.createElement('img');
      img.className = 'choice-sprite';
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'eager';
      if (option.overlay_image) {
        img.src = overlayUrl(option.overlay_image);
      }

      wrapper.appendChild(text);
      wrapper.appendChild(img);
      wrapper.addEventListener('click', () => chooseOption(option));
      overlayContainer.appendChild(wrapper);

      const mob = document.createElement('button');
      mob.type = 'button';
      mob.className = 'mobile-choice-btn';
      mob.textContent = option.label;
      mob.addEventListener('click', () => chooseOption(option));
      mobileChoicesEl.appendChild(mob);
    });
  }

  function renderNode(nodeId) {
    const node = gameData.nodes[nodeId];
    if (!node) {
      loadErrorEl.hidden = false;
      loadErrorEl.textContent = 'שגיאה: צומת לא נמצא — ' + nodeId;
      return;
    }
    currentNodeId = nodeId;
    titleEl.textContent = node.title || '';
    descEl.textContent = node.description || '';
    setBackground(node);
    clearChoices();

    const options = Array.isArray(node.options) ? node.options : [];
    if (options.length === 0) {
      renderEnding(node);
    } else {
      renderChoices(options);
    }
  }

  async function boot() {
    try {
      const res = await fetch('game.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      gameData = await res.json();
      creatorEl.textContent = gameData.gameSettings.creator || '';
      document.title = gameData.gameSettings.title || document.title;
      restartGame();
    } catch (err) {
      loadErrorEl.hidden = false;
      loadErrorEl.textContent = 'לא ניתן לטעון את המשחק. נסו לרענן.';
      console.error(err);
    }
  }

  boot();
})();
