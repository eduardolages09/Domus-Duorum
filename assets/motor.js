/* site-fabrica — o motor da versão animada (a proposta escolhida). Sem build: abre por duplo-clique.
   Mesma marcação dos protótipos; o <html> tem a classe .anima, que liga no CSS as secções presas.
   Tudo o que mexe com o scroll é calculado num só ciclo, no evento do Lenis (primeiro mede-se tudo,
   depois escreve-se só o que mudou).
   - [data-palavras]  frase que sai de uma névoa, palavra a palavra, com o scroll
   - [data-entra]     fotos que se abrem ao entrar e sobem e se esvaem ao sair
   - [data-vel]       velocidades diferentes no scroll
   - [data-revela]    texto que aparece uma vez, em escada
   - [data-ext]       exterior preso: as fotos sobem umas por cima das outras na mesma moldura
   - [data-qp]        quartos em painel (Casa do Poço): um passo de scroll por foto; a moldura toma o formato dela
   - [data-qb]        quartos a ecrã inteiro (Boa Vida): um ecrã de scroll por quarto
   - [data-gesto]     o gesto da casa: moldura-abre, traco-paragens, portadas, ombreira, escadaria, rota
   - .galeria         espaços comuns: separadores + fila de fotos que se arrasta e entra da direita
   - .lugar / .af     região: o texto corre e a foto presa troca
   - .carta           região num mapa (mapa.py): o mapa preso muda de vista e acende o passo ou o lugar
   - [data-comod]     comodidades: a fila que anda sozinha, pára com o rato e se arrasta
   - #visor           visor por espaço, sempre com o ficheiro original */
(() => {
  const raiz = document.documentElement;
  raiz.classList.add('anima');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const limita = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const suave = (t) => t * t * (3 - 2 * t);
  let vh = innerHeight;
  // escreve só o que mudou (cada escrita igual à anterior ainda custava um recálculo de estilos)
  const poe = (el, k, v) => { const c = el._c || (el._c = {}); if (c[k] !== v) { c[k] = v; el.style.setProperty(k, v); } };
  // camada própria só enquanto mexe (sem will-change fixo: tira nitidez); parada, volta a ser pintada nítida
  const camada = (el, sim, cls = 'mexe') => { const m = el._m || (el._m = {}); if (m[cls] !== sim) { m[cls] = sim; el.classList.toggle(cls, sim); } };
  const ao_alto = () => innerWidth <= 760 && innerHeight > innerWidth;

  /* ---------- scroll suave ---------- */
  let lenis = null;
  if (!reduz && window.Lenis) {
    /* O trackpad (e o Magic Mouse) já tem inércia própria: suavizá-lo outra vez punha a página a
       arrastar-se atrás do dedo. Esses gestos ficam com o scroll nativo; só a roda do rato, aos
       saltos, é suavizada. Reconhece-se o trackpad pelos passos pequenos ou fracionários e pelo
       movimento de lado; fica assim enquanto o gesto (e a inércia dele) durar. */
    let tpAte = 0;
    const eTrackpad = (e) => {
      if (e.deltaMode !== 0) return false;
      const y = Math.abs(e.deltaY);
      return e.deltaX !== 0 || y < 4 || !Number.isInteger(e.deltaY);
    };
    lenis = new Lenis({
      lerp: 0.12, wheelMultiplier: 1, smoothWheel: true,
      virtualScroll: ({ event }) => {
        if (event.type !== 'wheel') return true;
        const agora = performance.now();
        const era = agora < tpAte;
        if (eTrackpad(event) || era) {
          tpAte = agora + 250;
          if (!era && lenis.isScrolling === 'smooth') lenis.scrollTo(lenis.animatedScroll, { immediate: true, force: true });
          return false;
        }
        return true;
      },
    });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const irPara = (y, imediato = false) => {
    if (lenis) lenis.scrollTo(y, { immediate: imediato, force: true, duration: 1.4 });
    else scrollTo({ top: y, behavior: imediato || reduz ? 'auto' : 'smooth' });
  };
  const topoDe = (el) => el.getBoundingClientRect().top + scrollY;
  const progresso = (r) => limita(-r.top / Math.max(1, r.height - vh));   // 0 → 1 enquanto a secção presa anda

  /* ---------- palavras (névoa ligada ao scroll) e letras do nome ---------- */
  const nevoas = $$('[data-palavras]');
  nevoas.forEach((el) => {
    let i = 0;
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = el.textContent.trim().split(/\s+/).map((p) => `<span class="p" aria-hidden="true" style="--i:${i++}">${p}</span>`).join(' ');
    el._np = i;
  });
  const titulo = $('.hero__titulo');
  let li = 0;
  if (titulo) $$(':scope > span', titulo).forEach((pal) => {
    pal.innerHTML = [...pal.textContent].map((c) => `<span class="l" style="--i:${li++}">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  });

  /* ---------- hero pronto: a foto assenta e o nome sai do desfoque, letra a letra ---------- */
  const hero = $('.hero');
  const heroImg = $('.hero__foto img');
  const pronto = () => requestAnimationFrame(() => hero.classList.add('pronto'));
  if (heroImg.complete) pronto(); else { heroImg.addEventListener('load', pronto); setTimeout(pronto, 1600); }

  /* ---------- elementos ---------- */
  const topo = $('.topo');
  const barra = $('.barra');
  const fecho = $('.fecho');
  const vels = $$('[data-vel]');
  const entram = $$('[data-entra]');

  const vigia = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visivel'); vigia.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('[data-revela]').forEach((el) => { if (reduz) el.classList.add('visivel'); else vigia.observe(el); });

  /* as fotos das secções presas carregam antes de a secção chegar (nunca lazy fora da moldura) */
  $$('.xf img, .qp__foto img, .qb__foto img, .af img, [data-gesto] img').forEach((im) => { im.loading = 'eager'; });

  const pintores = [];   // cada secção presa regista aqui: { el, mede: () => rect, pinta(r), claro(r) }

  /* ---------- EXTERIOR: secção presa; a foto seguinte sobe por cima da anterior na mesma moldura ----------
     Cada foto tem um passo de scroll: meio passo a subir, meio parada. O nome do espaço muda quando
     muda o espaço, e o traço dele enche com as fotos desse espaço. */
  $$('[data-ext]').forEach((ext) => {
    const xfs = $$('.xf', ext);
    const xEsp = $$('.ext__espaco', ext);
    const xBot = $$('.ext__indice button', ext);
    const xTra = xBot.map((b) => $('.ext__traco span', b));
    const xMold = $('.ext__moldura', ext);
    const xPista = $('.ext__pista', ext);
    const N = xfs.length;
    const ini = [];
    xfs.forEach((f, k) => { const e = +f.dataset.e; if (ini[e] === undefined) ini[e] = k; });
    ini.push(N);
    let atual = 0, espaco = 0;
    pintores.push({ el: xPista, pinta: (r) => {
      if (r.top > vh || r.bottom < 0) return;
      const P = reduz ? 0 : progresso(r) * N;
      let cur = 0;
      xfs.forEach((f, i) => {
        if (!i) return;
        const a = reduz ? 0 : suave(limita((P - i + 0.25) / 0.5));
        poe(f, '--a', a.toFixed(4));
        camada(f, a > 0 && a < 1);
        if (a > 0.5) cur = i;
      });
      if (cur !== atual) {
        atual = cur;
        xMold.dataset.indice = xfs[cur].dataset.i;
        const e = +xfs[cur].dataset.e;
        if (e !== espaco) {
          espaco = e;
          xEsp.forEach((t, k) => t.classList.toggle('ativo', k === e));
          xBot.forEach((b, k) => b.setAttribute('aria-pressed', k === e ? 'true' : 'false'));
        }
      }
      xTra.forEach((t, k) => poe(t, '--b', limita((P - ini[k]) / (ini[k + 1] - ini[k])).toFixed(3)));
    } });
    xBot.forEach((b, k) => b.addEventListener('click', () => irPara(topoDe(xPista) + (ini[k] + 0.55) / N * (xPista.offsetHeight - vh))));
  });

  /* ---------- QUARTOS em painel (Casa do Poço): um passo de scroll por foto ----------
     O quarto e, a seguir, a sua casa de banho; o nome muda quando muda o quarto e o traço do
     separador enche com as fotos dele. A foto nova esvai-se por cima da anterior e assenta;
     a moldura toma o formato da foto nova (nunca maior do que ela aguenta). */
  $$('[data-qp]').forEach((qp) => {
    const qMoldura = $('.qp__moldura', qp);
    const qFotos = $$('.qp__foto', qp);
    const qTextos = $$('.qp__quarto', qp);
    const qTabs = $$('.qp__linha button', qp);
    const qTracos = qTabs.map((b) => $('.qp__traco span', b) || b);
    const qN = qFotos.length;
    const qIni = [];
    qFotos.forEach((f, k) => { const q = +f.dataset.q; if (qIni[q] === undefined) qIni[q] = k; });
    qIni.push(qN);
    let qAtual = 0, qQuarto = 0;
    const qPronta = (f) => { const im = $('img', f); return im.complete ? Promise.resolve() : im.decode().catch(() => {}); };
    const mostraFoto = (k) => {
      if (k === qAtual) return;
      const nova = qFotos[k];
      qAtual = k;
      qMoldura.dataset.visor = nova.dataset.serie; qMoldura.dataset.indice = nova.dataset.i;
      const q = +nova.dataset.q;
      if (q !== qQuarto) {
        qQuarto = q;
        qTextos.forEach((t, i) => t.classList.toggle('ativo', i === q));
        qTabs.forEach((b, i) => b.setAttribute('aria-pressed', i === q ? 'true' : 'false'));
      }
      qPronta(nova).then(() => {
        if (qAtual !== k) return;
        poe(qMoldura, '--ar', nova.dataset.ar); poe(qMoldura, '--wmax', nova.dataset.w);
        qFotos.forEach((f) => { if (f !== nova && f.classList.contains('ativo')) { f.classList.remove('ativo'); f.classList.add('sai'); clearTimeout(f._t); f._t = setTimeout(() => f.classList.remove('sai'), 1300); } });
        clearTimeout(nova._t); nova.classList.remove('sai'); nova.classList.add('ativo');
      });
    };
    pintores.push({ el: qp, pinta: (r) => {
      if (r.top > vh || r.bottom < 0) return;
      const P = progresso(r) * qN;
      mostraFoto(Math.min(qN - 1, Math.floor(P)));
      qTracos.forEach((b, i) => poe(b, '--b', (reduz ? (i <= qQuarto ? 1 : 0) : limita((P - qIni[i]) / (qIni[i + 1] - qIni[i]))).toFixed(3)));
    } });
    qTabs.forEach((b, i) => b.addEventListener('click', () => irPara(topoDe(qp) + (qIni[i] + 0.5) / qN * (qp.offsetHeight - vh))));
  });

  /* ---------- QUARTOS a ecrã inteiro (Boa Vida): um ecrã de scroll por quarto ----------
     A foto do quarto novo entra por cima da anterior (que só se esvai depois) e assenta de 1,08 a 1;
     o nome sobe; o traço do separador enche com o scroll; o topo fica transparente por cima. */
  $$('[data-qb]').forEach((qb) => {
    const fotos = $$('.qb__foto', qb), textos = $$('.qb__quarto', qb), tabs = $$('.qb__linha button', qb), wcs = $$('.qb__wc', qb);
    const tracos = tabs.map((b) => $('.qb__traco span', b));
    const area = $('.qb__fotos', qb);
    const serie = textos.map((t) => $('.qb__ver', t).dataset.visor);
    const N = fotos.length;
    let atual = 0;
    const mostra = (k) => {
      if (k === atual) return;
      atual = k;
      fotos.forEach((f, i) => {
        if (i === k) { clearTimeout(f._t); f.classList.remove('sai'); f.classList.add('ativo'); }
        else if (f.classList.contains('ativo')) { f.classList.remove('ativo'); f.classList.add('sai'); clearTimeout(f._t); f._t = setTimeout(() => f.classList.remove('sai'), 1300); }
      });
      textos.forEach((t, i) => t.classList.toggle('ativo', i === k));
      tabs.forEach((b, i) => b.setAttribute('aria-pressed', i === k ? 'true' : 'false'));
      wcs.forEach((w) => w.classList.toggle('ativo', +w.dataset.q === k));
      area.dataset.visor = serie[k];
    };
    pintores.push({ el: qb, pinta: (r) => {
      if (r.top > vh || r.bottom < 0) return;
      const P = progresso(r) * N;
      mostra(Math.min(N - 1, Math.floor(P)));
      tracos.forEach((t, i) => poe(t, '--b', (reduz ? (i <= atual ? 1 : 0) : limita(P - i)).toFixed(3)));
    }, claro: (r) => !ao_alto() && r.top <= 34 && r.bottom >= vh - 2 });
    tabs.forEach((b, i) => b.addEventListener('click', () => irPara(topoDe(qb) + (i + 0.5) / N * (qb.offsetHeight - vh))));
  });

  /* ---------- GESTOS ---------- */
  $$('[data-gesto]').forEach((g) => {
    const tipo = g.dataset.gesto;
    if (tipo === 'moldura-abre') {
      /* linha do tempo em ecrãs de scroll (u): a moldura abre-se de 0,05 a 0,95; com mais fotos, o título
         claro esvai-se (1,15 → 1,6) e cada foto seguinte sobe 0,9 ecrãs depois da anterior */
      const preso = $('.g-ma__preso', g), fotosEl = $('.g-ma__fotos', g);
      const ffs = $$('.g-ma__f', g), pars = $$('.g-ma__paragem', g), pts = $$('.g-ma__caminho li', g), cam = $('.g-ma__caminho', g);
      const nf = ffs.length;
      let aberta = false, etapa = -1, ponto = -2;
      const mede = () => { poe(preso, '--Wpx', `${preso.clientWidth}px`); poe(preso, '--Hpx', `${preso.clientHeight}px`); };
      mede(); addEventListener('resize', mede);
      pintores.push({ el: g, pinta: (r) => {
        if (r.top > vh * 1.2 || r.bottom < -vh * 0.2) return;
        const T = Math.max(1, (r.height - vh) / vh);
        const u = reduz ? T : progresso(r) * T;
        const o = suave(limita((u - 0.05) / 0.9));
        aberta = o > 0.94;
        poe(preso, '--o', o.toFixed(4));
        camada(preso, o > 0 && o < 1, 'mexe-g');
        let e = 0;
        for (let i = 1; i < nf; i++) {
          const a = suave(limita((u - 0.35 - 0.9 * i) / 0.6));
          poe(ffs[i], '--a', a.toFixed(4)); camada(ffs[i], a > 0 && a < 1);
          if (a > 0.5) e = i;
        }
        if (nf > 1) poe(preso, '--t', limita((u - 1.15) / 0.45).toFixed(3));
        if (cam) { poe(cam, '--v', limita((u - 0.8) / 0.25).toFixed(3)); poe(cam, '--c', limita((u - 0.95) / Math.max(.5, 0.9 * (nf - 1) + 0.1)).toFixed(4)); }
        if (e !== etapa) {
          etapa = e;
          pars.forEach((p, k) => p.classList.toggle('ativo', k + 1 === e));
          fotosEl.dataset.indice = ffs[e].dataset.i;
        }
        const pt = u < 0.85 ? -1 : e;
        if (pt !== ponto) { ponto = pt; pts.forEach((l, k) => l.classList.toggle('ativo', k <= pt)); }
      }, claro: (r) => aberta && !ao_alto() && r.top <= 34 && r.bottom >= vh - 2 });
    } else if (tipo === 'traco-paragens') {
      const pars = $$('.g-tp__paragem', g);
      pintores.push({ el: g, pinta: (r) => {
        if (r.top > vh || r.bottom < 0) return;
        poe(g, '--p', (reduz ? 1 : limita((vh * 0.75 - r.top) / Math.max(1, r.height - vh * 0.5))).toFixed(4));
        let ativo = 0, melhor = Infinity;
        pars.forEach((p, i) => { const q = p.getBoundingClientRect(); const d = Math.abs(q.top + q.height / 2 - vh / 2); if (d < melhor) { melhor = d; ativo = i; } });
        pars.forEach((p, i) => { if (p._a !== (i === ativo)) { p._a = i === ativo; p.classList.toggle('ativo', p._a); } });
      } });
    } else if (tipo === 'portadas' || tipo === 'ombreira' || tipo === 'rota') {
      const alvo = tipo === 'ombreira' ? $('.g-om__preso', g) : g;
      const ini = tipo === 'rota' ? .08 : .12, dur = tipo === 'rota' ? .8 : .72;
      pintores.push({ el: g, pinta: (r) => {
        if (r.top > vh * 1.2 || r.bottom < -vh * 0.2) return;
        const p = reduz ? 1 : suave(limita((progresso(r) - ini) / dur));
        poe(alvo, '--p', p.toFixed(4));
        camada(alvo, p > 0 && p < 1, 'mexe-g');
        g._p = p;
      }, claro: tipo === 'ombreira' ? (r) => g._p > 0.75 && r.top <= 34 && r.bottom >= vh - 2 : null });
    } else if (tipo === 'escadaria') {
      const fs = $$('.g-es__f', g), linhas = $$('.g-es__linha', g), mold = $('.g-es__moldura', g);
      const N = fs.length;
      let atual = 0;
      pintores.push({ el: g, pinta: (r) => {
        if (r.top > vh || r.bottom < 0) return;
        const P = reduz ? 0 : progresso(r) * N;
        let cur = 0;
        fs.forEach((f, i) => {
          if (!i) return;
          const a = reduz ? 0 : suave(limita((P - i + 0.25) / 0.5));
          poe(f, '--a', a.toFixed(4)); camada(f, a > 0 && a < 1);
          if (a > 0.5) cur = i;
        });
        if (cur !== atual) { atual = cur; linhas.forEach((l, i) => l.classList.toggle('ativo', i === cur)); mold.dataset.indice = cur; }
      } });
    }
  });

  /* ---------- região num mapa (mapa.py): o mapa preso muda de vista (zoom) e acende o passo ou o lugar
     que está a meio da zona livre do ecrã; com o rato, o que está por baixo dele ---------- */
  const carta = $('.carta');
  if (carta) {
    const svg = $('.carta__svg', carta), preso = $('.carta__preso', carta);
    const itens = $$('[data-vista]', carta), camadas = $$('.carta__camada', carta);
    const rotasC = $$('.carta__rota', carta), lugaresC = $$('.carta__lugar', carta);
    const V = JSON.parse(carta.dataset.vistas);
    let vb = svg.getAttribute('viewBox').split(/[ ,]+/).map(Number), anim = 0, atual = null, rato = false;
    const desenha = (b) => {
      svg.setAttribute('viewBox', b.map((v) => v.toFixed(2)).join(' '));
      const r = svg.getBoundingClientRect();
      if (r.width) svg.style.setProperty('--u', Math.min(b[2] / r.width, b[3] / r.height).toFixed(4));
      camadas.forEach((c, i) => { if (i) c.style.opacity = limita((+c.getAttribute('width') * 1.6 - b[2]) / (+c.getAttribute('width') * 0.6)).toFixed(3); });
    };
    const vai = (k) => {
      const b1 = V[k];
      if (!b1) return;
      const b0 = vb.slice(), t0 = performance.now(), dur = reduz ? 0 : 1300;
      cancelAnimationFrame(anim);
      // o zoom em escala logarítmica e o centro a acompanhar (não parece que o mapa foge)
      const c0 = [b0[0] + b0[2] / 2, b0[1] + b0[3] / 2], c1 = [b1[0] + b1[2] / 2, b1[1] + b1[3] / 2];
      const passo = (t) => {
        const p = dur ? limita((t - t0) / dur) : 1;
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const w = b0[2] * Math.pow(b1[2] / b0[2], e), h = b0[3] * Math.pow(b1[3] / b0[3], e);
        const z = (b0[2] - w) / ((b0[2] - b1[2]) || 1);
        const q = Math.abs(b0[2] - b1[2]) > 1 ? limita(z) : e;
        const cx = c0[0] + (c1[0] - c0[0]) * q, cy = c0[1] + (c1[1] - c0[1]) * q;
        vb = [cx - w / 2, cy - h / 2, w, h];
        desenha(vb);
        if (p < 1) anim = requestAnimationFrame(passo);
      };
      anim = requestAnimationFrame(passo);
    };
    const ativa = (el) => {
      if (el === atual) return;
      const antes = atual;
      atual = el;
      itens.forEach((it) => it.classList.toggle('ativo', it === el));
      const ps = el.dataset.passo, lu = el.dataset.lugar;
      carta.dataset.passo = ps || '';
      carta.classList.toggle('v-linha', !!ps);   // o trajeto do metro desenha-se logo no primeiro passo
      carta.classList.toggle('v-pe', ps === 'pe');
      carta.classList.toggle('v-lugares', lu !== undefined);
      rotasC.forEach((r) => r.classList.toggle('ativa', r.dataset.k === lu));
      lugaresC.forEach((r) => r.classList.toggle('ativo', r.dataset.k === lu));
      if (!antes || antes.dataset.vista !== el.dataset.vista) vai(el.dataset.vista);
    };
    if (matchMedia('(hover: hover)').matches) {
      itens.forEach((it) => it.addEventListener('mouseenter', () => { rato = true; ativa(it); }));
      $('.carta__lista', carta).addEventListener('mouseleave', () => { rato = false; });
    }
    addEventListener('resize', () => desenha(vb));
    pintores.push({ el: carta, pinta: (r) => {
      if (r.top > vh || r.bottom < 0 || rato) return;
      const alvo = ao_alto() || innerWidth <= 760 ? preso.getBoundingClientRect().bottom + (vh - preso.getBoundingClientRect().bottom) * 0.42 : vh * 0.5;
      let melhor = null, d = Infinity;
      itens.forEach((it) => { const q = it.getBoundingClientRect(); const x = Math.abs(q.top + q.height / 2 - alvo); if (x < d) { d = x; melhor = it; } });
      if (melhor) ativa(melhor);
    } });
    desenha(vb);
  }

  /* ---------- região: a foto presa troca quando o texto seguinte chega ---------- */
  const lugares = $$('.lugar');
  const afs = $$('.af');

  /* ---------- ESPAÇOS COMUNS: separadores + fila que se arrasta ---------- */
  /* filtro da lista de quartos: os separadores mostram só um tipo */
  $$('[data-filtro]').forEach((sec) => {
    const seps = $$('.separadores [role="tab"]', sec), filete = $('.separadores__filete', sec), itens = $$('.ql__q', sec);
    const poeFilete = () => { const b = seps.find((x) => x.getAttribute('aria-selected') === 'true'); if (b && filete) { filete.style.width = b.offsetWidth + 'px'; filete.style.transform = `translate3d(${b.offsetLeft}px, 0, 0)`; } };
    seps.forEach((b) => b.addEventListener('click', () => {
      seps.forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
      itens.forEach((q) => { q.hidden = b.dataset.div !== 'tudo' && q.dataset.div !== b.dataset.div; });
      poeFilete();
    }));
    addEventListener('resize', poeFilete); if (document.fonts) document.fonts.ready.then(poeFilete); poeFilete();
  });

  $$('.fotos').forEach((sec) => {
    const gFila = $('.galeria__fila', sec);
    if (!gFila) return;
    const gSeps = $$('.separadores [role="tab"]', sec);
    const gFilete = $('.separadores__filete', sec);
    const gFotos = $$('.gf', gFila);
    const gBarra = $('.galeria__barra', sec);
    const gPolegar = $('i', gBarra);
    let gDiv = 'tudo', gPedido = 0;
    const poeFilete = () => {
      const b = gSeps.find((x) => x.dataset.div === gDiv);
      gFilete.style.width = `${b.offsetWidth}px`;
      gFilete.style.transform = `translate3d(${b.offsetLeft}px, 0, 0)`;
    };
    const pintaBarra = () => {
      const w = gFila.scrollWidth, c = gFila.clientWidth;
      gBarra.hidden = c / w > 0.995;
      gPolegar.style.width = `${(c / w * 100).toFixed(2)}%`;
      gPolegar.style.left = `${(gFila.scrollLeft / w * 100).toFixed(2)}%`;
    };
    const numera = () => { let k = 0; gFotos.forEach((g) => { if (!g.hidden) { g.style.setProperty('--k', k); g.style.setProperty('--j', k); k++; } }); };
    const escolheDiv = (d) => {
      if (d === gDiv) return;
      gDiv = d; const meu = ++gPedido;
      gSeps.forEach((x) => { const sim = x.dataset.div === d; x.setAttribute('aria-selected', sim ? 'true' : 'false'); x.tabIndex = sim ? 0 : -1; });
      poeFilete();
      // as fotos saem e as novas chegam da direita, uma a uma
      gFila.classList.remove('chega'); gFila.classList.add('sai');
      setTimeout(() => {
        if (meu !== gPedido) return;
        gFotos.forEach((g) => { g.hidden = d !== 'tudo' && g.dataset.div !== d; });
        numera();
        gFila.scrollLeft = 0;
        gFila.classList.remove('sai'); void gFila.offsetWidth; gFila.classList.add('chega');
        pintaBarra();
      }, reduz ? 0 : 260);
    };
    gSeps.forEach((x, i) => {
      x.tabIndex = i ? -1 : 0;
      x.addEventListener('click', () => escolheDiv(x.dataset.div));
      x.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        const n = gSeps[(i + d + gSeps.length) % gSeps.length];
        n.focus(); escolheDiv(n.dataset.div);
      });
    });
    let gAgarra = null, gArrastou = false;
    gFila.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      gAgarra = { x: e.clientX, s: gFila.scrollLeft, id: e.pointerId }; gArrastou = false;
    });
    gFila.addEventListener('pointermove', (e) => {
      if (!gAgarra) return;
      const dx = e.clientX - gAgarra.x;
      if (!gArrastou && Math.abs(dx) > 6) { gArrastou = true; gFila.classList.add('agarrada'); gFila.setPointerCapture(gAgarra.id); }
      if (gArrastou) gFila.scrollLeft = gAgarra.s - dx;
    });
    const gLarga = () => { if (!gAgarra) return; gAgarra = null; gFila.classList.remove('agarrada'); };
    gFila.addEventListener('pointerup', gLarga);
    gFila.addEventListener('pointercancel', gLarga);
    gFila.addEventListener('click', (e) => { if (gArrastou) { e.preventDefault(); e.stopPropagation(); gArrastou = false; } }, true);
    gFila.addEventListener('dragstart', (e) => e.preventDefault());
    gFila.addEventListener('scroll', pintaBarra, { passive: true });
    numera(); poeFilete(); pintaBarra();
    addEventListener('resize', () => { poeFilete(); pintaBarra(); });
    if (document.fonts) document.fonts.ready.then(() => { poeFilete(); pintaBarra(); });
    addEventListener('load', pintaBarra);
  });

  /* ---------- ciclo ---------- */
  const mede = (el) => el.getBoundingClientRect();
  const ciclo = () => {
    // 1. medir
    const y = scrollY;
    const hh = hero.offsetHeight;
    const rf = mede(fecho);
    const rP = pintores.map((p) => mede(p.el));
    const rNev = nevoas.map(mede);
    const rVel = reduz ? [] : vels.map(mede);
    const rEnt = entram.map(mede);
    const rLug = lugares.map(mede);

    // 2. escrever
    poe(hero, '--hs', limita(y / hh).toFixed(4));
    pintores.forEach((p, i) => p.pinta(rP[i]));

    // topo: transparente sobre o hero, o fecho e as fotos a ecrã inteiro (gesto aberto, quartos a ecrã inteiro)
    let sobreFoto = y < hh - 70 || (rf.top <= 34 && rf.bottom > 70);
    pintores.forEach((p, i) => { if (p.claro && p.claro(rP[i])) sobreFoto = true; });
    topo.classList.toggle('solido', !sobreFoto);
    if (barra) barra.classList.toggle('visivel', y > hh * 0.7 && rf.top > vh * 0.9);

    // a névoa: cada palavra sai do desfoque, em onda, conforme a frase sobe no ecrã
    nevoas.forEach((el, k) => {
      const r = rNev[k];
      if (r.bottom < -100 || r.top > vh + 100) return;
      const t = reduz ? 1 : limita((vh * 0.95 - r.top) / (vh * 0.42));
      poe(el, '--n', (t * (el._np + 4)).toFixed(2));
      if (el._limpa !== (t >= 1)) { el._limpa = t >= 1; el.classList.toggle('limpa', t >= 1); }
    });

    // velocidades: a posição natural é a medida menos o desvio já aplicado
    vels.forEach((el, k) => {
      const r = rVel[k];
      if (!r) return;
      const d0 = el._d || 0;
      const topo0 = r.top - d0;
      if (r.bottom - d0 < -200 || topo0 > vh + 200) { camada(el, false, 'mexe-v'); return; }
      const d = Math.round((topo0 + r.height / 2 - vh / 2) * parseFloat(el.dataset.vel) * 2) / 2;
      el._d = d;
      poe(el, 'translate', `0 ${d}px`);
      camada(el, true, 'mexe-v');
    });

    entram.forEach((el, k) => {
      const r = rEnt[k];
      if (!r.height) { poe(el, '--e', '1'); return; }
      if (r.bottom < -50 || r.top > vh + 50) { camada(el, false); return; }
      const e = reduz ? 1 : suave(limita((vh - r.top) / (vh * 0.55)));
      const s = reduz ? 0 : limita(1 - r.bottom / (vh * 0.4));
      poe(el, '--e', e.toFixed(4));
      poe(el, '--s', s.toFixed(4));
      camada(el, e < 1 || s > 0);
    });

    // região: o lugar mais perto do meio do ecrã fica aceso; a foto dele sobe por cima da anterior
    let ativo = 0, melhor = Infinity;
    lugares.forEach((l, i) => {
      const r = rLug[i];
      const d = Math.abs(r.top + r.height / 2 - vh / 2);
      if (d < melhor) { melhor = d; ativo = i; }
      if (i > 0 && afs[i]) {
        const a = reduz ? (r.top < vh * 0.7 ? 1 : 0) : suave(limita((vh * 0.88 - r.top) / (vh * 0.42)));
        poe(afs[i], '--a', a.toFixed(4));
        camada(afs[i], a > 0 && a < 1);
      }
    });
    lugares.forEach((l, i) => { if (l._a !== (i === ativo)) { l._a = i === ativo; l.classList.toggle('ativo', l._a); } });
  };

  let pedido = false;
  const agenda = () => { if (!pedido) { pedido = true; requestAnimationFrame(() => { pedido = false; ciclo(); }); } };
  // com o Lenis, só no evento dele (no mesmo frame do scroll); sem ele, no scroll nativo
  if (lenis) lenis.on('scroll', ciclo);
  else addEventListener('scroll', agenda, { passive: true });
  addEventListener('resize', () => { vh = innerHeight; agenda(); });
  addEventListener('load', agenda);
  requestAnimationFrame(ciclo);

  /* ---------- ligações internas ---------- */
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const alvo = $(a.getAttribute('href'));
    if (!alvo) return;
    e.preventDefault();
    const extra = alvo.matches('[data-sem-folga], .hero, .quartos, .ext, [data-gesto]') ? 0 : 70;
    irPara(topoDe(alvo) - extra);
  }));

  /* ---------- COMODIDADES: a fila anda sozinha, devagar, e não acaba ---------- */
  const pista = $('[data-comod]');
  if (pista) {
    const lista = $('.comod__lista', pista);
    $$(':scope > li', lista).forEach((c) => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); lista.appendChild(k); });
    if (!reduz) {
      const VEL = 24;
      let pos = 0, anterior = null, pausa = 0, sobre = false, visivel = true, aCorrer = false;
      let volta = lista.scrollWidth / 2;
      const andar = (agora) => {
        if (!visivel) { aCorrer = false; return; }
        if (anterior === null) anterior = agora;
        const ms = Math.min(agora - anterior, 100); anterior = agora;
        if (sobre || pausa > 0) { if (pausa > 0) pausa -= ms; pos = pista.scrollLeft; }
        else {
          pos += VEL * ms / 1000;
          if (volta > 0) { if (pos >= volta) pos -= volta; else if (pos < 0) pos += volta; }
          pista.scrollLeft = pos;
        }
        requestAnimationFrame(andar);
      };
      const liga = () => { if (aCorrer) return; aCorrer = true; anterior = null; requestAnimationFrame(andar); };
      new IntersectionObserver((e) => { visivel = e[0].isIntersecting; if (visivel) { volta = lista.scrollWidth / 2; liga(); } }).observe(pista);
      addEventListener('resize', () => { volta = lista.scrollWidth / 2; });
      const suspende = () => { pausa = 1500; };
      pista.addEventListener('wheel', suspende, { passive: true });
      pista.addEventListener('touchstart', suspende, { passive: true });
      pista.addEventListener('touchmove', suspende, { passive: true });
      pista.addEventListener('touchend', () => { pausa = 2500; }, { passive: true });
      pista.addEventListener('mouseenter', () => { sobre = true; });
      pista.addEventListener('mouseleave', () => { sobre = false; });
      pista.addEventListener('focus', () => { sobre = true; });
      pista.addEventListener('blur', () => { sobre = false; });
      let agarrado = false, x0 = 0, s0 = 0;
      pista.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        agarrado = true; x0 = e.clientX; s0 = pista.scrollLeft;
        pista.classList.add('agarrada'); pista.setPointerCapture(e.pointerId);
      });
      pista.addEventListener('pointermove', (e) => { if (agarrado) { e.preventDefault(); pista.scrollLeft = s0 - (e.clientX - x0); } });
      const larga = (e) => { if (!agarrado) return; agarrado = false; pista.classList.remove('agarrada'); try { pista.releasePointerCapture(e.pointerId); } catch (_) {} };
      pista.addEventListener('pointerup', larga);
      pista.addEventListener('pointercancel', larga);
      liga();
    }
  }

  /* ---------- VISOR: abre só o espaço clicado ----------
     Carrega sempre o ficheiro original e nunca o mostra maior do que ele é. */
  const visor = $('#visor');
  const vImg = $('.visor__palco img');
  const vTit = $('.visor__titulo');
  const vConta = $('.visor__conta');
  const vMinis = $('.visor__minis');
  let serie = null, vi = 0, ultimoFoco = null, pedidoV = 0;
  const pinta = () => {
    const f = serie.fotos[vi], meu = ++pedidoV;
    const tinha = !!vImg.getAttribute('src');
    vImg.classList.add('troca');
    const im = new Image();
    im.onload = () => setTimeout(() => {
      if (meu !== pedidoV) return;
      vImg.src = im.src; vImg.alt = f.alt;
      vImg.style.maxWidth = `min(100%, ${f.w}px)`; vImg.style.maxHeight = `min(100%, ${f.h}px)`;
      requestAnimationFrame(() => vImg.classList.remove('troca'));
    }, tinha ? 180 : 0);
    im.src = f.src;
    vConta.textContent = `${vi + 1} / ${serie.fotos.length}`;
    $$('button', vMinis).forEach((b, i) => {
      b.classList.toggle('ativo', i === vi);
      if (i === vi) vMinis.scrollTo({ left: b.parentNode.offsetLeft - (vMinis.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' });
    });
  };
  function abre(k, i) {
    serie = window.SERIES[k]; if (!serie || !serie.fotos.length) return;
    vi = Math.min(i || 0, serie.fotos.length - 1); ultimoFoco = document.activeElement;
    vTit.textContent = serie.titulo;
    vImg.removeAttribute('src');
    vMinis.innerHTML = serie.fotos.map((f, j) => `<li><button type="button" aria-label="${f.leg || 'Fotografia ' + (j + 1)}"><img src="${f.mini}" alt="" decoding="async"></button></li>`).join('');
    $$('button', vMinis).forEach((b, j) => b.addEventListener('click', () => { vi = j; pinta(); }));
    visor.hidden = false; requestAnimationFrame(() => visor.classList.add('aberto'));
    if (lenis) lenis.stop(); document.body.style.overflow = 'hidden'; document.body.classList.add('com-visor');
    pinta(); $('.visor__fechar').focus();
  }
  const fecha = () => {
    visor.classList.remove('aberto');
    setTimeout(() => { visor.hidden = true; }, 350);
    if (lenis) lenis.start(); document.body.style.overflow = ''; document.body.classList.remove('com-visor');
    if (ultimoFoco) ultimoFoco.focus({ preventScroll: true });
  };
  const anda = (d) => { vi = (vi + d + serie.fotos.length) % serie.fotos.length; pinta(); };
  // lê o data-visor e o data-indice no clique: as molduras presas mudam de foto
  $$('[data-visor]').forEach((b) => {
    b.addEventListener('click', () => abre(b.dataset.visor, +b.dataset.indice || 0));
    if (b.getAttribute('role') === 'button') b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abre(b.dataset.visor, +b.dataset.indice || 0); } });
  });
  $('.visor__fechar').addEventListener('click', fecha);
  $('.visor__seta--ant').addEventListener('click', () => anda(-1));
  $('.visor__seta--seg').addEventListener('click', () => anda(1));
  visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__palco')) fecha(); });
  addEventListener('keydown', (e) => {
    if (visor.hidden) return;
    if (e.key === 'Escape') fecha();
    if (e.key === 'ArrowLeft') anda(-1);
    if (e.key === 'ArrowRight') anda(1);
  });
  let vx = null;
  $('.visor__palco').addEventListener('touchstart', (e) => { vx = e.touches[0].clientX; }, { passive: true });
  $('.visor__palco').addEventListener('touchend', (e) => {
    if (vx === null) return;
    const dx = e.changedTouches[0].clientX - vx; vx = null;
    if (Math.abs(dx) > 40) anda(dx < 0 ? 1 : -1);
  });
})();
