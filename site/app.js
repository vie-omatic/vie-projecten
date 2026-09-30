// VIE Projecten: inloggen, toegangscheck en de twee pagina's.
// Alle inhoud komt uit Supabase en is alleen leesbaar voor accounts op de gastenlijst (RLS).
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var SCHERMEN = ['laden', 'inloggen', 'verstuurd', 'geen-toegang', 'app'];
  function toon(naam) {
    SCHERMEN.forEach(function (s) { $('#scherm-' + s).hidden = (s !== naam); });
  }

  // ---------- Config controleren ----------
  var cfg = window.VIE_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseKey || cfg.supabaseUrl.indexOf('JOUW-') !== -1 || cfg.supabaseKey.indexOf('JOUW-') !== -1) {
    $('#laden-tekst').textContent = 'config.js is nog niet ingevuld.';
    return;
  }

  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: {
      flowType: 'implicit',       // link werkt ook als je de mail op een ander apparaat opent
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  // ---------- Foutmelding uit een verlopen link ----------
  var linkFout = null;
  (function leesLinkFout() {
    var bron = window.location.hash.indexOf('error') !== -1 ? window.location.hash.slice(1)
             : window.location.search.indexOf('error') !== -1 ? window.location.search.slice(1) : '';
    if (!bron) return;
    var p = new URLSearchParams(bron);
    if (p.get('error') || p.get('error_code')) {
      linkFout = p.get('error_code') === 'otp_expired'
        ? 'Deze inloglink is verlopen of al gebruikt. Vraag hieronder een nieuwe aan.'
        : 'Inloggen via de link lukte niet. Vraag hieronder een nieuwe aan.';
      history.replaceState(null, '', window.location.pathname);
    }
  })();

  function meldInlog(tekst) {
    var el = $('#inlog-melding');
    el.textContent = tekst || '';
    el.hidden = !tekst;
  }

  // ---------- Scherm bepalen na elke auth-wijziging ----------
  var seq = 0; // voorkomt dat een oudere controle een nieuwere overschrijft
  function bepaalScherm(session) {
    var mijn = ++seq;
    if (!session) {
      wisInhoud();
      meldInlog(linkFout);
      linkFout = null;
      toon('inloggen');
      return;
    }
    sb.rpc('pr_heeft_toegang').then(function (res) {
      if (mijn !== seq) return;
      if (res.error || res.data !== true) {
        if (res.error) console.warn('Toegangscheck mislukt:', res.error.message);
        wisInhoud();
        $('#geen-toegang-email').textContent = session.user.email;
        toon('geen-toegang');
        return;
      }
      $('#gebruiker').textContent = session.user.email;
      toon('app');
      route();
      laadInhoud();
    });
  }

  // Supabase raadt aan geen andere Supabase-calls direct in deze callback te doen.
  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
    setTimeout(function () { bepaalScherm(session); }, 0);
  });

  // ---------- Inloggen ----------
  var bezig = false;
  $('#inlog-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (bezig) return;
    var email = $('#email').value.trim().toLowerCase();
    if (!email || email.indexOf('@') === -1) { meldInlog('Vul een geldig e-mailadres in.'); return; }

    bezig = true;
    var knop = $('#inlog-knop');
    knop.disabled = true;
    knop.textContent = 'Bezig...';
    meldInlog('');

    sb.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false, // de site maakt nooit zelf accounts aan
        emailRedirectTo: window.location.origin + '/'
      }
    }).then(function (res) {
      var err = res.error;
      if (err && err.status === 429) {
        meldInlog('Te veel pogingen. Probeer het over een paar minuten opnieuw.');
        return;
      }
      if (err && (!err.status || err.name === 'AuthRetryableFetchError')) {
        console.warn('Verbindingsfout:', err.message);
        meldInlog('Er ging iets mis met de verbinding. Probeer het opnieuw.');
        return;
      }
      // Ook bij een onbekend adres dezelfde melding: we verraden niet wie toegang heeft.
      if (err) console.info('Inloglink niet verstuurd:', err.message);
      $('#verstuurd-email').textContent = email;
      toon('verstuurd');
    }).finally(function () {
      bezig = false;
      knop.disabled = false;
      knop.textContent = 'Stuur inloglink';
    });
  });

  $('#opnieuw-knop').addEventListener('click', function () {
    $('#email').value = '';
    meldInlog('');
    toon('inloggen');
  });

  // ---------- Uitloggen ----------
  $$('[data-uitloggen]').forEach(function (knop) {
    knop.addEventListener('click', function () {
      knop.disabled = true;
      sb.auth.signOut().finally(function () {
        knop.disabled = false;
        bepaalScherm(null);
      });
    });
  });

  // ---------- Pagina's ----------
  var ROUTES = ['bouwen', 'roadmap'];
  function route() {
    if ($('#scherm-app').hidden) return;
    var h = window.location.hash;
    var naam = h.indexOf('#/') === 0 ? h.slice(2) : '';
    if (ROUTES.indexOf(naam) === -1) naam = 'bouwen';
    ROUTES.forEach(function (r) { $('#pagina-' + r).hidden = (r !== naam); });
    $$('nav a').forEach(function (a) {
      a.classList.toggle('actief', a.getAttribute('data-route') === naam);
    });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ---------- Hulpjes voor veilige weergave ----------
  // Alle tekst uit de database gaat eerst door esc(). Daarna pas een paar opmaakregels.
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function inline(s) { // s is al ge-escaped
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  var RE_KOP = /^(#{1,3})\s+(.*)$/, RE_LIJST = /^\s*[-*]\s+/, RE_TABEL = /^\s*\|/;
  function cellen(regel) {
    return regel.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }
  function mdTabel(regels) {
    var rijen = regels.filter(function (r) { return !/^[\s|:\-]+$/.test(r); }).map(cellen);
    if (!rijen.length) return '';
    var kop = rijen.shift();
    var h = '<table class="tabel stapel"><thead><tr>' + kop.map(function (k) { return '<th>' + inline(esc(k)) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rijen.forEach(function (r) {
      h += '<tr>' + r.map(function (c, i) { return '<td data-label="' + esc(kop[i] || '') + '">' + inline(esc(c)) + '</td>'; }).join('') + '</tr>';
    });
    return h + '</tbody></table>';
  }
  function md(tekst) {
    if (!tekst) return '';
    var r = String(tekst).replace(/\r\n/g, '\n').split('\n'), uit = [], i = 0, m;
    while (i < r.length) {
      if (!r[i].trim()) { i++; continue; }
      if ((m = r[i].match(RE_KOP))) {
        var tag = m[1].length === 3 ? 'h5' : 'h4';
        uit.push('<' + tag + '>' + inline(esc(m[2])) + '</' + tag + '>'); i++; continue;
      }
      if (RE_LIJST.test(r[i])) {
        var items = [];
        while (i < r.length && RE_LIJST.test(r[i])) { items.push('<li>' + inline(esc(r[i].replace(RE_LIJST, ''))) + '</li>'); i++; }
        uit.push('<ul>' + items.join('') + '</ul>'); continue;
      }
      if (RE_TABEL.test(r[i])) {
        var tr = [];
        while (i < r.length && RE_TABEL.test(r[i])) { tr.push(r[i]); i++; }
        uit.push(mdTabel(tr)); continue;
      }
      var alinea = [];
      while (i < r.length && r[i].trim() && !RE_KOP.test(r[i]) && !RE_LIJST.test(r[i]) && !RE_TABEL.test(r[i])) { alinea.push(r[i].trim()); i++; }
      uit.push('<p>' + inline(esc(alinea.join(' '))) + '</p>');
    }
    return uit.join('');
  }

  // ---------- Inhoud laden ----------
  var laadSeq = 0;
  function laadInhoud() {
    var mijn = ++laadSeq;
    var fout = $('[data-laadfout]');
    fout.hidden = true;
    var intro = $('[data-tekst="intro"]');
    if (!intro.innerHTML) intro.innerHTML = '<p class="zacht">Inhoud laden...</p>';
    Promise.all([
      sb.from('pr_projecten').select('*').order('volgorde'),
      sb.from('pr_modules').select('*').order('volgorde'),
      sb.from('pr_teksten').select('*').order('volgorde'),
      sb.from('pr_roadmap').select('*').order('volgorde')
    ]).then(function (res) {
      if (mijn !== laadSeq || $('#scherm-app').hidden) return;
      var err = res.filter(function (r) { return r.error; })[0];
      if (err) {
        console.warn('Laden mislukt:', err.error.message);
        fout.textContent = 'De inhoud kon niet worden geladen. Herlaad de pagina of probeer het later opnieuw.';
        fout.hidden = false;
        return;
      }
      var projecten = res[0].data || [], modules = res[1].data || [], teksten = res[2].data || [], roadmap = res[3].data || [];
      var perSleutel = {};
      teksten.forEach(function (t) { perSleutel[t.sleutel] = t; });
      $$('[data-tekst]').forEach(function (el) {
        var t = perSleutel[el.getAttribute('data-tekst')];
        el.innerHTML = t ? md(t.inhoud) : '';
      });
      renderProjecten(projecten);
      renderModules(modules);
      renderRoadmap(roadmap);
      var laatst = projecten.concat(modules, teksten, roadmap).map(function (r) { return r.bijgewerkt_op; }).filter(Boolean).sort().pop();
      var tekst = laatst
        ? 'Laatst bijgewerkt op ' + new Date(laatst).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) + '.'
        : '';
      $$('[data-bijgewerkt]').forEach(function (el) { el.textContent = tekst; });
    });
  }

  var CATEGORIEEN = [
    ['platform', 'Klantplatform'],
    ['intern', 'Platforms'],
    ['bot', 'Bots en automatisering'],
    ['agent', 'Agents'],
    ['website', 'Websites en kleine tools']
  ];
  var GELANCEERD = { ja: ['Ja', 'badge-ja'], nee: ['Nee', 'badge-nee'], nvt: ['n.v.t.', 'badge-nvt'] };

  function veld(label, inhoud, isMd) {
    if (!inhoud) return '';
    return '<div class="veld"><div class="veld-label">' + esc(label) + '</div><div class="veld-inhoud">' + (isMd ? md(inhoud) : esc(inhoud)) + '</div></div>';
  }

  function renderProjecten(rijen) {
    var kop = ['Project', 'Status', 'Gelanceerd', 'AI', 'Supabase', 'Netlify', 'Git'];
    var h = '<table class="tabel projecten stapel"><thead><tr>' + kop.map(function (k) { return '<th>' + k + '</th>'; }).join('') + '</tr></thead>';
    CATEGORIEEN.forEach(function (cat) {
      var groep = rijen.filter(function (p) { return p.categorie === cat[0]; });
      if (!groep.length) return;
      h += '<tbody><tr class="groep"><th colspan="7">' + esc(cat[1]) + '</th></tr>';
      groep.forEach(function (p) {
        var g = GELANCEERD[p.gelanceerd] || GELANCEERD.nee;
        h += '<tr class="project" tabindex="0" role="button" aria-expanded="false" data-slug="' + esc(p.slug) + '">' +
          '<td data-label="Project"><span class="pijl" aria-hidden="true"></span><strong>' + esc(p.naam) + '</strong><span class="sub">' + esc(p.omschrijving) + '</span></td>' +
          '<td data-label="Status">' + esc(p.status) + '</td>' +
          '<td data-label="Gelanceerd"><span class="badge ' + g[1] + '">' + g[0] + '</span></td>' +
          '<td data-label="AI">' + (p.ai ? '<span class="badge badge-ai">AI</span>' : '<span class="zacht">Nee</span>') + '</td>' +
          '<td data-label="Supabase">' + esc(p.supabase) + '</td>' +
          '<td data-label="Netlify">' + esc(p.netlify) + '</td>' +
          '<td data-label="Git">' + esc(p.git) + '</td></tr>';
        h += '<tr class="detail" hidden><td colspan="7"><div class="detail-binnen">' +
          veld('Doel', p.doel, true) +
          veld('Opbouw', p.opbouw, true) +
          veld('Adres', p.adres, false) +
          veld('AI', p.ai_toelichting, true) +
          veld('Open punten', p.open_punten, true) +
          '</div></td></tr>';
      });
      h += '</tbody>';
    });
    $('#projecten').innerHTML = h + '</table>';
  }

  function klapUit(rij) {
    var detail = rij.nextElementSibling;
    var open = rij.getAttribute('aria-expanded') === 'true';
    rij.setAttribute('aria-expanded', open ? 'false' : 'true');
    detail.hidden = open;
  }
  $('#projecten').addEventListener('click', function (e) {
    var rij = e.target.closest('tr.project');
    if (rij) klapUit(rij);
  });
  $('#projecten').addEventListener('keydown', function (e) {
    var rij = e.target.closest('tr.project');
    if (rij && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); klapUit(rij); }
  });

  function renderModules(rijen) {
    var h = '<table class="tabel stapel"><thead><tr><th>Module</th><th>Status</th><th>AI</th><th>Volgende stap</th></tr></thead><tbody>';
    rijen.forEach(function (m) {
      h += '<tr><td data-label="Module"><strong>' + esc(m.naam) + '</strong></td>' +
        '<td data-label="Status">' + esc(m.status) + '</td>' +
        '<td data-label="AI">' + esc(m.ai) + '</td>' +
        '<td data-label="Volgende stap">' + esc(m.volgende_stap) + '</td></tr>';
    });
    $('#modules').innerHTML = h + '</tbody></table>';
  }

  // ---------- Roadmap ----------
  function item(r, metPeriode) {
    return '<li><strong>' + esc(r.titel) + '</strong>' +
      (metPeriode && r.periode ? ' <span class="zacht">' + esc(r.periode) + '</span>' : '') +
      (r.toelichting ? '<span class="sub">' + esc(r.toelichting) + '</span>' : '') + '</li>';
  }

  function renderRoadmap(rijen) {
    // Planning: periodes in volgorde van eerste voorkomen, drie kolommen per periode
    var perioden = [], perPeriode = {};
    rijen.filter(function (r) { return r.fase === 'nu' || r.fase === 'volgende'; }).forEach(function (r) {
      var p = r.periode || 'Zonder periode';
      if (!perPeriode[p]) { perPeriode[p] = { nu: false, minimaal: [], meezit: [], klaar: [] }; perioden.push(p); }
      if (r.fase === 'nu') perPeriode[p].nu = true;
      (perPeriode[p][r.soort] || perPeriode[p].minimaal).push(r);
    });
    var h = '<table class="tabel planning stapel"><thead><tr><th>Periode</th><th>Dit moet af</th><th>Als het meezit</th><th>Klaar als</th></tr></thead><tbody>';
    perioden.forEach(function (p) {
      var d = perPeriode[p];
      var lijst = function (arr) { return arr.length ? '<ul class="items">' + arr.map(function (r) { return item(r, false); }).join('') + '</ul>' : '<span class="zacht">-</span>'; };
      h += '<tr' + (d.nu ? ' class="nu"' : '') + '>' +
        '<td data-label="Periode" class="periode"><span><strong>' + esc(p) + '</strong>' + (d.nu ? ' <span class="badge badge-nu">Nu</span>' : '') + '</span></td>' +
        '<td data-label="Dit moet af">' + lijst(d.minimaal) + '</td>' +
        '<td data-label="Als het meezit">' + lijst(d.meezit) + '</td>' +
        '<td data-label="Klaar als">' + (d.klaar.length ? d.klaar.map(function (r) { return '<p class="klaar">' + esc(r.titel) + '</p>'; }).join('') : '<span class="zacht">-</span>') + '</td></tr>';
    });
    $('#planning').innerHTML = perioden.length ? h + '</tbody></table>' : '<p class="zacht">Nog geen planning.</p>';

    var af = rijen.filter(function (r) { return r.fase === 'afgerond'; });
    $('#afgerond').innerHTML = af.length ? af.map(function (r) { return item(r, true); }).join('') : '<li class="zacht">Nog niets.</li>';
    var gp = rijen.filter(function (r) { return r.fase === 'geparkeerd'; });
    $('#geparkeerd').innerHTML = gp.length ? gp.map(function (r) { return item(r, false); }).join('') : '<li class="zacht">Niets geparkeerd.</li>';
  }

  // Sectiemenu: scrollen zonder de #/route te verstoren
  $$('[data-spring]').forEach(function (knop) {
    knop.addEventListener('click', function () {
      var doel = document.getElementById(knop.getAttribute('data-spring'));
      if (doel) doel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  function wisInhoud() {
    laadSeq++;
    $$('[data-tekst]').forEach(function (el) { el.innerHTML = ''; });
    $('#projecten').innerHTML = '';
    $('#modules').innerHTML = '';
    $('#planning').innerHTML = '';
    $('#afgerond').innerHTML = '';
    $('#geparkeerd').innerHTML = '';
    $$('[data-bijgewerkt]').forEach(function (el) { el.textContent = ''; });
    $('[data-laadfout]').hidden = true;
    $('#gebruiker').textContent = '';
  }
})();
