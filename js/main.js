/* =========================================================
   AJUSTA — main.js
   ========================================================= */
(() => {
  'use strict';

  const hasGSAP = typeof window.gsap !== 'undefined';
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  const perf = {
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
    mobile: matchMedia('(max-width: 640px)').matches,
    hover: matchMedia('(hover: hover) and (pointer: fine)').matches,
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Smooth scroll (Lenis) ---------- */
  let lenis = null;
  if (hasGSAP && window.Lenis && !perf.reduce && !perf.mobile) {
    lenis = new Lenis({ duration: 1.15, easing: t => 1 - Math.pow(1 - t, 4) });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Âncoras internas passam pelo Lenis
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      if (lenis) lenis.scrollTo(target, { offset: 0 });
      else target.scrollIntoView({ behavior: perf.reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Nav: estado de scroll ---------- */
  const nav = document.getElementById('nav');
  let lastY = window.scrollY;
  const onScrollNav = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 80);
    const goingDown = y > lastY;
    nav.classList.toggle('is-hidden', goingDown && y > 600 && !document.body.classList.contains('menu-open'));
    lastY = y;
  };
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  /* ---------- Menu mobile ---------- */
  const burger = document.querySelector('.nav-burger');
  const menu = document.getElementById('menu-mobile');
  function openMenu() {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fechar menu');
    document.body.classList.add('menu-open');
    if (lenis) lenis.stop();
  }
  function closeMenu({ focusButton = false } = {}) {
    if (!menu || menu.hidden) return;
    menu.classList.remove('is-open');
    menu.hidden = true;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menu');
    document.body.classList.remove('menu-open');
    if (lenis) lenis.start();
    if (focusButton) burger.focus();
  }
  burger?.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  // Guia: fecha no Escape com o foco voltando ao botão
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu({ focusButton: true }); });

  /* ---------- Scramble (eyebrows) ---------- */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/—';
  function scramble(el, duration = 700) {
    const final = el.textContent;
    if (perf.reduce) return;
    const start = performance.now();
    const tick = now => {
      const p = clamp((now - start) / duration, 0, 1);
      const settled = Math.floor(p * final.length);
      let out = '';
      for (let i = 0; i < final.length; i++) {
        const ch = final[i];
        out += i < settled || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = final;
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Reveal genérico ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      if (en.target.hasAttribute('data-scramble')) scramble(en.target);
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  // O hero é disparado pela intro; o resto pelo observer
  document.querySelectorAll('.reveal, [data-split], [data-scramble]').forEach(el => {
    if (!el.closest('.hero')) io.observe(el);
  });

  /* ---------- Magnet (CTA) ---------- */
  if (hasGSAP && perf.hover && !perf.reduce) {
    document.querySelectorAll('.magnet').forEach(el => {
      const xTo = gsap.quickTo(el, 'x', { duration: .6, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: .6, ease: 'power3.out' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        xTo(((e.clientX - r.left) / r.width - .5) * 16);
        yTo(((e.clientY - r.top) / r.height - .5) * 12);
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, .4)' });
      });
    });
  }

  /* =========================================================
     HERO — laser antes/depois
     ========================================================= */
  const hero = document.querySelector('.hero');
  const media = document.getElementById('hero-compare');
  const range = document.getElementById('hero-range');
  const hint = document.querySelector('.hero-hint');

  if (hero && media) {
    const state = { pos: 100, target: 50, interactive: false, raf: 0 };

    const render = () => {
      media.style.setProperty('--pos', state.pos.toFixed(2) + '%');
      media.classList.toggle('hide-before', state.pos < 9);
      media.classList.toggle('hide-after', state.pos > 91);
      if (range) range.value = Math.round(state.pos);
    };

    // Loop de suavização: só roda enquanto houver distância a percorrer
    const loop = () => {
      state.pos = lerp(state.pos, state.target, .12);
      if (Math.abs(state.pos - state.target) < .05) {
        state.pos = state.target;
        render();
        state.raf = 0;
        return;
      }
      render();
      state.raf = requestAnimationFrame(loop);
    };
    const setTarget = v => {
      // Interação do visitante interrompe a varredura de abertura
      if (state.intro) { state.intro.kill(); state.intro = null; state.interactive = true; }
      state.target = clamp(v, 0, 100);
      if (!state.raf) state.raf = requestAnimationFrame(loop);
    };
    const xToPct = clientX => {
      const r = media.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 100;
    };
    let hinted = false;
    const dismissHint = () => {
      if (hinted) return;
      hinted = true;
      hint?.classList.add('is-gone');
    };

    // Mouse: o laser segue o cursor em qualquer ponto do hero
    if (perf.hover) {
      hero.addEventListener('pointermove', e => {
        if (!state.interactive || e.pointerType !== 'mouse') return;
        setTarget(xToPct(e.clientX));
        dismissHint();
      });
    }

    // Toque / caneta: arrastar sobre a foto
    let dragging = false;
    media.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      dragging = true;
      media.classList.add('is-dragging');
      state.interactive = true;
      setTarget(xToPct(e.clientX));
      dismissHint();
    });
    media.addEventListener('pointermove', e => {
      if (dragging) setTarget(xToPct(e.clientX));
    });
    const endDrag = () => { dragging = false; media.classList.remove('is-dragging'); };
    media.addEventListener('pointerup', endDrag);
    media.addEventListener('pointercancel', endDrag);

    // Teclado
    range?.addEventListener('input', () => {
      state.interactive = true;
      setTarget(Number(range.value));
      dismissHint();
    });

    /* ---------- Intro ---------- */
    const heroSplit = hero.querySelector('[data-split]');
    const heroReveals = hero.querySelectorAll('.reveal');
    const heroScramble = hero.querySelector('[data-scramble]');

    const showText = () => {
      heroSplit?.classList.add('is-in');
      heroReveals.forEach(el => el.classList.add('is-in'));
      if (heroScramble) scramble(heroScramble, 900);
    };

    if (perf.reduce || !hasGSAP) {
      state.pos = 50; state.target = 50; state.interactive = true;
      render(); showText();
    } else {
      render();
      // O laser entra pela direita, varre a foto inteira revelando o "depois"
      // e volta para o meio — a partir daí, o controle é do visitante.
      const sweep = (delay = 0) => state.intro = gsap.timeline({ delay })
        .to(state, { pos: 0, duration: 1.9, ease: 'power2.inOut', onUpdate: render })
        .to(state, { pos: 50, duration: 1.3, ease: 'power3.inOut', onUpdate: render }, '+=.25')
        .add(() => { state.target = state.pos; state.interactive = true; state.intro = null; });

      const start = () => {
        showText();
        // No desktop a foto está na primeira dobra: varre logo.
        // No tablet/celular ela fica abaixo do texto: varre quando entrar na tela.
        if (matchMedia('(min-width: 1025px)').matches) return sweep(.45);
        const obs = new IntersectionObserver(([en]) => {
          if (!en.isIntersecting || state.interactive) return;
          obs.disconnect();
          sweep(.15);
        }, { threshold: .45 });
        obs.observe(media);
      };
      // Espera a foto carregar para a varredura não acontecer sobre o vazio
      const imgs = [...media.querySelectorAll('img')];
      const ready = imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; }));
      Promise.race([Promise.all(ready), new Promise(r => setTimeout(r, 2500))])
        .then(() => document.fonts?.ready)
        .then(start);
    }

    /* ---------- Scroll: parallax e saída do hero ---------- */
    if (hasGSAP && window.ScrollTrigger && !perf.reduce) {
      gsap.to('.hero-media-inner', {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      });
      // Só no desktop: texto e foto dividem a mesma tela
      if (matchMedia('(min-width: 1025px)').matches) {
        gsap.to('.hero-content', {
          y: -60, opacity: 0, ease: 'none',
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 20%', scrub: true },
        });
      }
    }
  }

  /* =========================================================
     O PROBLEMA — pilha de fotos bagunçadas → grade alinhada → laser ajusta uma a uma
     ========================================================= */
  const problem = document.getElementById('problema');
  if (problem) {
    const shots = [...problem.querySelectorAll('.shot')];
    const numEl = problem.querySelector('.pc-num');
    const totalEl = problem.querySelector('.pc-total');
    const outro = problem.querySelector('.problem-outro');
    const stage = problem.querySelector('.problem-stage');

    // Deslocamento de cada foto até a posição final (px numa largura de referência de 1300px):
    // todas puxadas para o centro, tortas e em escalas diferentes, como uma pilha jogada na mesa.
    const PILE = [
      { x: 420, y: 150, r: -13, s: .78 },
      { x: 150, y: 175, r: 9, s: .84 },
      { x: -140, y: 150, r: -7, s: .88 },
      { x: -420, y: 120, r: 14, s: .76 },
      { x: 390, y: -110, r: 8, s: .82 },
      { x: 130, y: -140, r: -11, s: .9 },
      { x: -120, y: -120, r: 6, s: .86 },
      { x: -400, y: -150, r: -15, s: .8 },
    ];

    const visibleShots = () => shots.filter(s => s.offsetParent !== null);
    const updateCount = () => {
      const list = visibleShots();
      let done = 0;
      list.forEach(s => {
        const isDone = parseFloat(s.style.getPropertyValue('--pp')) < 50;
        s.classList.toggle('is-done', isDone);
        if (isDone) done++;
      });
      if (numEl) numEl.textContent = done;
      if (totalEl) totalEl.textContent = list.length;
      if (outro && hasGSAP) gsap.to(outro, { opacity: done === list.length ? 1 : 0, y: done === list.length ? 0 : 10, duration: .5, overwrite: true });
    };

    if (perf.reduce || !hasGSAP || !window.ScrollTrigger) {
      shots.forEach(s => { s.style.setProperty('--pp', 0); });
      updateCount();
    } else {
      const mm = gsap.matchMedia();
      mm.add({ desktop: '(min-width: 1025px)', compact: '(max-width: 1024px)' }, ctx => {
        const { desktop } = ctx.conditions;
        const list = visibleShots();
        const k = stage.getBoundingClientRect().width / 1300;   // escala da pilha ao tamanho real do palco

        gsap.set(list, {
          x: i => PILE[i].x * k, y: i => PILE[i].y * k,
          rotation: i => PILE[i].r, scale: i => PILE[i].s,
          zIndex: i => 10 - i, '--pp': 100,
        });
        updateCount();

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: desktop
            ? { trigger: problem, start: 'top top', end: '+=170%', pin: true, scrub: 1, anticipatePin: 1 }
            : { trigger: stage, start: 'top 88%', end: 'bottom 35%', scrub: 1 },
          onUpdate: updateCount,
        });

        // 1. A pilha se espalha e cada foto encaixa no seu lugar, reta
        tl.to(list, {
          x: 0, y: 0, rotation: 0, scale: 1,
          duration: 1, ease: 'power3.inOut',
          stagger: { each: .07, from: 'random' },
        });
        // 2. O laser passa em cada foto, uma a uma, revelando a versão tratada
        tl.to(list, {
          '--pp': 0, duration: .45, ease: 'power2.inOut',
          stagger: .12,
        }, '-=.15');
        // Respiro no fim para o "8/8" ser lido antes de soltar o pin
        if (desktop) tl.to({}, { duration: .35 });

        // Parallax sutil do palco seguindo o mouse (só desktop com mouse)
        if (desktop && perf.hover) {
          gsap.set(stage, { transformPerspective: 1600 });
          const rx = gsap.quickTo(stage, 'rotationX', { duration: .8, ease: 'power3.out' });
          const ry = gsap.quickTo(stage, 'rotationY', { duration: .8, ease: 'power3.out' });
          const onMove = e => {
            rx(((e.clientY / innerHeight) - .5) * -5);
            ry(((e.clientX / innerWidth) - .5) * 7);
          };
          problem.addEventListener('pointermove', onMove);
          return () => problem.removeEventListener('pointermove', onMove);
        }
      });
    }
  }

  /* =========================================================
     TRÊS ESTÁGIOS — Antes → Tratada → Com mobília
     Desktop: seção fixa, o scroll arrasta os dois lasers.
     Tablet/celular: abas (ARIA) com varredura animada.
     ========================================================= */
  const stagesEl = document.getElementById('estagios');
  if (stagesEl && stagesEl.classList.contains('stages')) {
    const frame = stagesEl.querySelector('.stage-frame');
    const tabs = [...stagesEl.querySelectorAll('.stage-tab')];
    const panels = [...stagesEl.querySelectorAll('.stage-panel')];
    const TARGETS = [{ p1: 100, p2: 100 }, { p1: 0, p2: 100 }, { p1: 0, p2: 0 }];
    const sv = { p1: 100, p2: 100 };
    let active = 0;

    const setActive = i => {
      if (i === active) return;
      active = i;
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach((p, k) => p.classList.toggle('is-active', k === i));
    };
    const render = () => {
      frame.style.setProperty('--p1', sv.p1.toFixed(2));
      frame.style.setProperty('--p2', sv.p2.toFixed(2));
      stagesEl.style.setProperty('--sp', ((200 - sv.p1 - sv.p2) / 200).toFixed(3));
      setActive(sv.p1 > 50 ? 0 : sv.p2 > 50 ? 1 : 2);
    };

    let goTo = i => { Object.assign(sv, TARGETS[i]); render(); };   // sem animação (reduced motion / sem GSAP)
    let autoplay = null;

    // Teclado nas abas: setas, Home e End (ativação automática)
    tabs.forEach((t, k) => {
      t.addEventListener('click', () => { autoplay?.kill(); goTo(k); });
      t.addEventListener('keydown', e => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let n = null;
        if (e.key in keys) n = (k + keys[e.key] + tabs.length) % tabs.length;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        tabs[n].focus();
        autoplay?.kill();
        goTo(n);
      });
    });

    if (hasGSAP && window.ScrollTrigger && !perf.reduce) {
      const mm = gsap.matchMedia();

      // Desktop: pin + scrub, com pausas para cada estágio ser lido
      mm.add('(min-width: 1025px)', () => {
        Object.assign(sv, TARGETS[0]); render();
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: stagesEl, start: 'top top', end: '+=220%', pin: true, scrub: .8, anticipatePin: 1 },
          onUpdate: render,
        });
        tl.addLabel('s0')
          .to({}, { duration: .35 })
          .to(sv, { p1: 0, duration: 1, ease: 'power1.inOut' })
          .addLabel('s1')
          .to({}, { duration: .45 })
          .to(sv, { p2: 0, duration: 1, ease: 'power1.inOut' })
          .addLabel('s2')
          .to({}, { duration: .35 });

        // Clique na aba rola até o ponto daquele estágio
        const at = { 0: 's0', 1: 's1', 2: 's2' };
        goTo = i => {
          const st = tl.scrollTrigger;
          const y = st.start + (st.end - st.start) * (tl.labels[at[i]] / tl.duration()) + (i === 2 ? 2 : 0);
          if (lenis) lenis.scrollTo(y, { duration: 1.2 });
          else window.scrollTo({ top: y, behavior: 'smooth' });
        };
        return () => { goTo = i => { Object.assign(sv, TARGETS[i]); render(); }; };
      });

      // Tablet/celular: abas com varredura animada + demonstração automática na primeira vez
      mm.add('(max-width: 1024px)', () => {
        Object.assign(sv, TARGETS[0]); render();
        goTo = i => gsap.to(sv, { ...TARGETS[i], duration: 1.1, ease: 'power2.inOut', overwrite: true, onUpdate: render });
        const io2 = new IntersectionObserver(([en]) => {
          if (!en.isIntersecting) return;
          io2.disconnect();
          autoplay = gsap.timeline({ delay: .6 })
            .to(sv, { ...TARGETS[1], duration: 1.2, ease: 'power2.inOut', onUpdate: render })
            .to(sv, { ...TARGETS[2], duration: 1.2, ease: 'power2.inOut', onUpdate: render }, '+=1.4');
        }, { threshold: .55 });
        io2.observe(frame);
        return () => { io2.disconnect(); autoplay?.kill(); };
      });
    } else {
      render();
    }
  }

  /* =========================================================
     O QUE AJUSTAMOS — demos que rodam ao entrar na tela e repetem no hover
     ========================================================= */
  const adjCards = [...document.querySelectorAll('.adj-card')];
  if (adjCards.length) {
    const play = card => card.classList.add('is-played');
    // Volta ao "antes" sem animar e toca de novo
    const replay = card => {
      if (card._busy) return;
      card._busy = true;
      card.classList.add('no-anim');
      card.classList.remove('is-played');
      void card.offsetWidth;                    // força o navegador a aplicar o "antes"
      card.classList.remove('no-anim');
      requestAnimationFrame(() => requestAnimationFrame(() => play(card)));
      setTimeout(() => { card._busy = false; }, 2200);
    };

    if (perf.reduce) {
      adjCards.forEach(play);
    } else {
      const ioAdj = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          ioAdj.unobserve(en.target);
          setTimeout(() => play(en.target), 350);
        });
      }, { threshold: .45 });
      adjCards.forEach(c => ioAdj.observe(c));

      if (perf.hover) {
        adjCards.forEach(c => c.addEventListener('pointerenter', () => {
          if (c.classList.contains('is-played')) replay(c);
        }));
      }
    }
  }

  /* ---------- SpotlightCard: brilho segue o mouse (throttle por rAF) ---------- */
  if (perf.hover) {
    document.querySelectorAll('.card').forEach(card => {
      let raf = 0, ex = 0, ey = 0;
      card.addEventListener('pointermove', e => {
        ex = e.clientX; ey = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', (ex - r.left) + 'px');
          card.style.setProperty('--my', (ey - r.top) + 'px');
          raf = 0;
        });
      });
    });
  }

  /* =========================================================
     PORTFÓLIO — comparadores arrastáveis (mouse, toque e teclado)
     ========================================================= */
  document.querySelectorAll('.compare').forEach(cmp => {
    const range = cmp.querySelector('.cmp-range');
    let pos = 50, target = 50, raf = 0, dragging = false;
    const render = () => {
      cmp.style.setProperty('--pos', pos.toFixed(2) + '%');
      cmp.classList.toggle('hide-before', pos < 12);
      cmp.classList.toggle('hide-after', pos > 88);
      if (range) range.value = Math.round(pos);
    };
    const loop = () => {
      pos = lerp(pos, target, .2);
      if (Math.abs(pos - target) < .05) { pos = target; render(); raf = 0; return; }
      render(); raf = requestAnimationFrame(loop);
    };
    const setTarget = v => { target = clamp(v, 0, 100); if (!raf) raf = requestAnimationFrame(loop); };
    const pct = x => { const r = cmp.getBoundingClientRect(); return ((x - r.left) / r.width) * 100; };

    cmp.addEventListener('pointerdown', e => {
      dragging = true; cmp.classList.add('is-dragging');
      cmp.setPointerCapture?.(e.pointerId);
      setTarget(pct(e.clientX));
    });
    cmp.addEventListener('pointermove', e => { if (dragging) setTarget(pct(e.clientX)); });
    const end = () => { dragging = false; cmp.classList.remove('is-dragging'); };
    cmp.addEventListener('pointerup', end);
    cmp.addEventListener('pointercancel', end);
    range?.addEventListener('input', () => setTarget(Number(range.value)));

    // Dica de interação: na primeira vez que aparece, o laser dá uma varrida curta
    if (!perf.reduce) {
      const o = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        o.disconnect();
        setTimeout(() => {
          if (dragging) return;
          setTarget(22);
          setTimeout(() => { if (!dragging) setTarget(50); }, 900);
        }, 400);
      }, { threshold: .6 });
      o.observe(cmp);
    }
  });

  // Faixa de texto: acelera quando a rolagem é rápida
  const marquee = document.querySelector('.marquee-track');
  if (marquee && !perf.reduce && marquee.getAnimations) {
    const anim = marquee.getAnimations()[0];
    let lastScroll = window.scrollY, rate = 1;
    const tick = () => {
      const v = Math.abs(window.scrollY - lastScroll);
      lastScroll = window.scrollY;
      rate = lerp(rate, 1 + Math.min(v / 12, 4), .08);
      if (anim) anim.playbackRate = rate;
      requestAnimationFrame(tick);
    };
    if (anim) requestAnimationFrame(tick);
  }

  /* =========================================================
     COMO FUNCIONA — a linha de laser acende os passos com a rolagem
     ========================================================= */
  const howSteps = document.querySelector('.how-steps');
  if (howSteps) {
    const steps = [...howSteps.querySelectorAll('.how-step')];
    const light = p => {
      howSteps.style.setProperty('--hp', p.toFixed(3));
      steps.forEach((s, i) => s.classList.toggle('is-lit', p >= (steps.length > 1 ? i / (steps.length - 1) : 0) - .02));
    };
    if (perf.reduce || !hasGSAP || !window.ScrollTrigger) light(1);
    else {
      light(0);
      ScrollTrigger.create({
        trigger: howSteps, start: 'top 75%', end: 'bottom 55%', scrub: .6,
        onUpdate: self => light(self.progress),
      });
    }
  }

  /* ---------- Preços: contagem ao aparecer ---------- */
  // O valor real fica no HTML: a contagem só roda quando o número entra na tela,
  // e começa do zero nesse instante. Se nada disparar, o preço certo continua lá.
  document.querySelectorAll('.count').forEach(el => {
    const to = Number(el.dataset.to);
    if (perf.reduce || !hasGSAP) return;
    const o = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      o.disconnect();
      const obj = { v: 0 };
      el.textContent = '0';
      gsap.to(obj, { v: to, duration: 1.2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(obj.v); } });
    }, { threshold: .9 });
    o.observe(el);
  });

  /* =========================================================
     CONTATO — formulário → mensagem pronta para o WhatsApp
     Guia Kairo: NÃO abre o WhatsApp sozinho; a pessoa vê o aviso e escolhe.
     Sem servidor, quem não clicar em "Abrir WhatsApp" não vira contato.
     ========================================================= */
  const WHATSAPP_NUMERO = ''; // TODO: número com DDI e DDD, só dígitos. Ex.: '5511900000000'
  const form = document.getElementById('form-contato');
  if (form) {
    const done = form.querySelector('.form-done');
    const wa = form.querySelector('.form-wa');
    const setError = (input, msg) => {
      const field = input.closest('.field');
      field.classList.toggle('has-error', !!msg);
      const out = field.querySelector('.field-error');
      if (out) out.textContent = msg || '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const nome = form.nome, whats = form.whatsapp;
      const digits = whats.value.replace(/\D/g, '');
      let ok = true;
      if (nome.value.trim().length < 2) { setError(nome, 'Escreva seu nome.'); ok = false; } else setError(nome, '');
      if (digits.length < 10) { setError(whats, 'Confira o número com DDD.'); ok = false; } else setError(whats, '');
      if (!ok) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }

      const linhas = [
        'Olá, AJUSTA! Quero ajustar as fotos do meu anúncio.',
        `Nome: ${nome.value.trim()}`,
        `WhatsApp: ${whats.value.trim()}`,
        form.quantidade.value ? `Quantidade de fotos: ${form.quantidade.value}` : null,
        `Estágio: ${form.estagio.value}`,
        form.link.value.trim() ? `Anúncio: ${form.link.value.trim()}` : null,
      ].filter(Boolean);
      wa.href = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(linhas.join('\n'))}`;
      done.hidden = false;
      wa.focus({ preventScroll: true });
      done.scrollIntoView({ behavior: perf.reduce ? 'auto' : 'smooth', block: 'nearest' });
    });
  }

  /* ---------- Barra fixa do celular: aparece depois do hero, some no contato ---------- */
  const mobileCta = document.querySelector('.mobile-cta');
  const contact = document.getElementById('contato');
  if (mobileCta && hero && contact) {
    let pastHero = false, atContact = false;
    const upd = () => mobileCta.classList.toggle('is-visible', pastHero && !atContact);
    new IntersectionObserver(([en]) => { pastHero = !en.isIntersecting; upd(); }).observe(hero);
    new IntersectionObserver(([en]) => { atContact = en.isIntersecting; upd(); }, { threshold: .15 }).observe(contact);
  }

  /* ---------- Rodapé: o laser se estende ao chegar no fim ---------- */
  const footEnd = document.querySelector('.footer-end');
  if (footEnd) {
    new IntersectionObserver(([en], o) => {
      if (!en.isIntersecting) return;
      footEnd.classList.add('is-in');
      o.disconnect();
    }, { threshold: 1 }).observe(footEnd);
  }

  /* ---------- Progresso de leitura (laser lateral) ---------- */
  if (hasGSAP && window.ScrollTrigger) {
    gsap.to('.progress-laser', {
      scaleY: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: .3 },
    });
  }
})();
