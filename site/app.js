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
      laadStatus();
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

  // ---------- Inhoud (stap 2: alleen een verbindingstest) ----------
  function laadStatus() {
    sb.from('pr_projecten').select('id', { count: 'exact', head: true }).then(function (res) {
      var tekst = res.error
        ? 'Kon de database niet lezen.'
        : 'Verbonden met de database. Projecten: ' + (res.count || 0) + '.';
      $$('[data-status]').forEach(function (el) { el.textContent = tekst; });
    });
  }

  function wisInhoud() {
    $$('[data-status]').forEach(function (el) { el.textContent = ''; });
    $('#gebruiker').textContent = '';
  }
})();
