(() => {
  'use strict';
  const consentKey = 'merxus.marketingConsent.v1';
  const campaignKey = 'merxus.marketingCampaign.v1';
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const clickKeys = ['gclid', 'fbclid', 'rdt_cid'];
  const config = window.MERXUS_MARKETING_ANALYTICS || {};
  const gpc = navigator.globalPrivacyControl === true;
  const incoming = new URLSearchParams(location.search);
  const cleanValue = (value) => value && value.length <= 200 && /^[\w .:/+-]+$/.test(value) && !/\d{10,}/.test(value) ? value : null;
  const captured = {};
  for (const key of [...utmKeys, ...clickKeys]) {
    const value = cleanValue(incoming.get(key));
    if (value) captured[key] = value;
  }
  let previous = {};
  try { previous = JSON.parse(sessionStorage.getItem(campaignKey) || '{}'); } catch (_) {}
  const campaign = { ...previous };
  for (const key of utmKeys) if (captured[key]) campaign[key] = captured[key];
  try { sessionStorage.setItem(campaignKey, JSON.stringify(campaign)); } catch (_) {}

  // Remove campaign and arbitrary query values before a measurement library can read the URL.
  // Preserve only the public pricing selector used by this site.
  const safeUrl = new URL(location.href);
  for (const key of [...safeUrl.searchParams.keys()]) {
    if (key !== 'type' || !['office', 'real_estate', 'restaurant'].includes(safeUrl.searchParams.get(key))) safeUrl.searchParams.delete(key);
  }
  if (safeUrl.href !== location.href) history.replaceState(null, '', safeUrl.pathname + safeUrl.search + safeUrl.hash);

  let consent = null;
  try { consent = JSON.parse(localStorage.getItem(consentKey) || 'null'); } catch (_) {}
  const normalize = (value) => ({ analytics: value?.analytics === true, advertising: !gpc && value?.advertising === true });
  const allowed = normalize(consent);
  const trackingUrl = `${location.origin}${location.pathname}`;
  // Third-party libraries can inspect document.referrer on their own. If it
  // carries query data or a probable identifier, omit measurement on this page.
  const referrerIsSafe = (() => {
    if (!document.referrer) return true;
    try {
      const ref = new URL(document.referrer);
      return !ref.search && !ref.hash && !/@|\d{10,}/.test(ref.pathname);
    } catch (_) { return false; }
  })();
  let gaSent = false;
  let metaSent = false;
  const demoEvents = new Set();

  function startTracking() {
    if (referrerIsSafe && allowed.analytics && !gaSent && /^G-[A-Z0-9]+$/.test(config.ga4Id || '')) {
      gaSent = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      gtag('consent', 'update', { analytics_storage: 'granted' });
      gtag('js', new Date());
      gtag('config', config.ga4Id, { send_page_view: false, page_referrer: '', allow_google_signals: false, allow_ad_personalization_signals: false });
      gtag('event', 'page_view', { page_location: trackingUrl, page_path: location.pathname, page_title: document.title, page_referrer: '' });
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4Id)}`;
      document.head.append(script);
    }
    if (referrerIsSafe && allowed.advertising && !metaSent && /^\d{8,20}$/.test(config.metaPixelId || '')) {
      metaSent = true;
      const fbq = window.fbq = window.fbq || function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
      fbq.queue = fbq.queue || [];
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq('init', config.metaPixelId);
      fbq('track', 'PageView');
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.append(script);
    }
  }

  function parameters() {
    const result = {};
    for (const key of utmKeys) if (campaign[key]) result[key] = campaign[key];
    if (allowed.advertising) {
      for (const key of clickKeys) if (captured[key] || campaign[key]) result[key] = captured[key] || campaign[key];
    }
    return result;
  }

  function save(analytics, advertising) {
    const wasTracking = (gaSent && !analytics) || (metaSent && (!advertising || gpc));
    allowed.analytics = analytics;
    allowed.advertising = !gpc && advertising;
    try { localStorage.setItem(consentKey, JSON.stringify({ ...allowed, capturedAt: new Date().toISOString() })); } catch (_) {}
    if (allowed.advertising) {
      for (const key of clickKeys) if (captured[key]) campaign[key] = captured[key];
      try { sessionStorage.setItem(campaignKey, JSON.stringify(campaign)); } catch (_) {}
    } else {
      for (const key of clickKeys) delete campaign[key];
      try { sessionStorage.setItem(campaignKey, JSON.stringify(campaign)); } catch (_) {}
    }
    document.getElementById('privacy-choices')?.setAttribute('hidden', '');
    window.MerxusMarketingAttribution?.refreshLinks?.();
    if (wasTracking) { location.reload(); return; }
    startTracking();
  }

  window.MerxusMarketingAttribution = { parameters, refreshLinks: null };
  window.MerxusMarketingTrack = {
    demoPlayed(demoId, tenantType) {
      const id = String(demoId || '');
      if (!allowed.advertising || !metaSent || !/^(office|real-estate)$/.test(id) || demoEvents.has(id)) return false;
      demoEvents.add(id);
      window.fbq('trackCustom', 'MerxusCallDemoPlayed', {
        demo_id: id,
        tenant_type: String(tenantType || '').slice(0, 24),
        page_path: location.pathname,
      });
      return true;
    },
  };
  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('privacy-choices');
    if (!panel) return;
    if (!consent) panel.removeAttribute('hidden');
    document.getElementById('privacy-open')?.addEventListener('click', () => panel.removeAttribute('hidden'));
    document.getElementById('privacy-essential')?.addEventListener('click', () => save(false, false));
    document.getElementById('privacy-analytics')?.addEventListener('click', () => save(true, false));
    const adButton = document.getElementById('privacy-advertising');
    if (gpc && adButton) {
      adButton.disabled = true;
      adButton.title = 'Advertising measurement is disabled by your Global Privacy Control setting';
    }
    adButton?.addEventListener('click', () => save(true, true));
    startTracking();
  });
})();
