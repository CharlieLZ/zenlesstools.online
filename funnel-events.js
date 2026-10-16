/* funnel-events v1 (2026-10-16): standard GA4 funnel events. Options via data-* on this <script>:
   data-skip="purchase,begin_checkout" skips events the app already sends itself.
   Elements can force an event with data-funnel="<event_name>". */
(function () {
  if (window.__funnelEvents) return; window.__funnelEvents = 1;
  var s = document.currentScript, skip = ((s && s.getAttribute('data-skip')) || '').split(',');
  window.dataLayer = window.dataLayer || [];
  var g = window.gtag || function () { window.dataLayer.push(arguments); };
  function send(name, p) {
    if (skip.indexOf(name) >= 0) return;
    p = p || {}; p.page_path = location.pathname; p.funnel_src = 'fe1';
    try { (window.gtag || g)('event', name, p); } catch (e) {}
  }
  window.funnelTrack = send;
  var RX = {
    login_click: /(^|\/)(login|log-in|signin|sign-in|sign_in|auth\/|api\/auth\/signin)|google.*oauth|accounts\.google\.com/i,
    view_pricing: /(^|\/)(pricing|plans|price|credits|upgrade|subscribe|premium)(\/|$|\?|#)/i,
    begin_checkout: /checkout\.stripe\.com|buy\.stripe\.com|paypal\.com\/(checkoutnow|pay)|creem\.io|lemonsqueezy|\/checkout|\/api\/(stripe|payment|pay|billing)/i
  };
  var TX = {
    login_click: /^(log ?in|sign ?in|sign in with google|continue with google|登录|ログイン)$/i,
    paywall_cta_click: /(upgrade|buy|get credits|unlock|go pro|get pro|subscribe|purchase|top ?up|choose plan|get started.*\$|\$\s?\d)/i,
    try_start: /^(generate|try( it)?( now| free| for free)?|start( now| free)?|create|play( now)?|upscale|convert|run|make|animate|start quiz|take (the )?quiz|开始|生成)\b/i
  };
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('a,button,[role=button],[data-funnel],input[type=submit]');
    if (!el) return;
    var forced = el.getAttribute('data-funnel'); if (forced) return send(forced);
    var href = el.getAttribute('href') || el.getAttribute('formaction') || '';
    var txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 60);
    var p = { link_text: txt.slice(0, 40) };
    if (RX.begin_checkout.test(href)) return send('begin_checkout', p);
    if (RX.login_click.test(href) || TX.login_click.test(txt)) return send('login_click', p);
    if (TX.paywall_cta_click.test(txt) || RX.view_pricing.test(href)) return send('paywall_cta_click', p);
    if (TX.try_start.test(txt)) return send('try_start', p);
  }, true);
  function onload() {
    var q = new URLSearchParams(location.search), path = location.pathname;
    if (RX.view_pricing.test(path)) send('view_pricing');
    if (q.get('login') === 'success' || q.get('signed_in') === '1') send('login', { method: 'oauth' });
    if (q.get('signup') === 'success' || q.get('new_user') === '1') send('sign_up', { method: 'oauth' });
    var sid = q.get('session_id') || q.get('checkout_id') || q.get('order_id') || q.get('token');
    if (sid && /(success|thank|paid|payment|complete|order)/i.test(path + location.search)) {
      var k = 'fe_purchase_' + sid;
      try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) {}
      var v = parseFloat(q.get('value') || q.get('amount') || '0') || undefined;
      send('purchase', { transaction_id: sid, value: v, currency: (q.get('currency') || 'USD').toUpperCase() });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onload); else onload();
})();
