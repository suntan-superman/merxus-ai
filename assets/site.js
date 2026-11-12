(() => {
  'use strict';

  // Keep paid-campaign context when the public site hands a visitor to the
  // operational application on a different domain.
  const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'rdt_cid'];
  const campaignParameters = () => window.MerxusMarketingAttribution?.parameters() || {};
  function decorate(anchor) {
    const url = new URL(anchor.href);
    if (url.hostname !== 'merxusllc.com' && url.hostname !== 'www.merxusllc.com') return;
    const params = campaignParameters();
    for (const key of attributionKeys) {
      url.searchParams.delete(key);
      const value = params[key];
      if (value && value.length <= 300 && !url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    anchor.href = url.toString();
  }
  const refreshLinks = () => document.querySelectorAll('a[data-app-link]').forEach(decorate);
  if (window.MerxusMarketingAttribution) window.MerxusMarketingAttribution.refreshLinks = refreshLinks;
  refreshLinks();

  const pricingRoot = document.getElementById('pricing-plans');
  if (!pricingRoot) return;

  const status = document.getElementById('pricing-status');
  const tabs = [...document.querySelectorAll('[data-price-type]')];
  const allowedTypes = ['office', 'real_estate', 'restaurant'];
  const requestedType = new URLSearchParams(window.location.search).get('type');
  let selectedType = allowedTypes.includes(requestedType) ? requestedType : 'office';
  let catalog = null;
  let catalogSource = 'live';

  const money = (minorUnits, currency = 'usd') => {
    if (!Number.isFinite(Number(minorUnits))) return null;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: String(currency).toUpperCase(),
        maximumFractionDigits: Number(minorUnits) % 100 === 0 ? 0 : 2,
      }).format(Number(minorUnits) / 100);
    } catch (_) {
      return null;
    }
  };

  function render() {
    tabs.forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.priceType === selectedType)));
    pricingRoot.replaceChildren();
    if (!catalog) return;

    const plans = catalog.displayPlans?.[selectedType] || [];
    if (!plans.length) {
      status.textContent = 'Current plans are available in the Merxus web application.';
      return;
    }
    const sourceLabel = catalogSource === 'live'
      ? 'Live Merxus catalog'
      : `Pricing snapshot from ${catalog.snapshotDate || 'the last site build'}`;
    status.textContent = Number.isFinite(Number(catalog.trialDays))
      ? `${sourceLabel} · ${Number(catalog.trialDays)}-day trial details confirmed at checkout`
      : `${sourceLabel} · trial details confirmed at checkout`;

    for (const plan of plans) {
      const card = document.createElement('article');
      card.className = 'card';
      const label = document.createElement('span');
      label.className = 'eyebrow';
      label.textContent = String(plan.tier || 'Plan');
      const title = document.createElement('h3');
      title.textContent = String(plan.label || plan.name || 'Merxus plan');
      const price = document.createElement('p');
      price.className = 'price';
      price.textContent = money(plan.subscriptionUnitAmount, plan.currency) || 'See current price';
      const interval = document.createElement('small');
      interval.textContent = ' / month';
      price.append(interval);
      const setup = document.createElement('p');
      setup.textContent = plan.onboardingUnitAmount == null
        ? 'Setup fee confirmed at checkout'
        : `${money(plan.onboardingUnitAmount, plan.currency)} one-time setup`;
      const features = document.createElement('ul');
      features.className = 'check-list';
      for (const feature of (Array.isArray(plan.features) ? plan.features : []).slice(0, 4)) {
        const item = document.createElement('li');
        item.textContent = String(feature);
        features.append(item);
      }
      const link = document.createElement('a');
      link.className = 'text-link';
      link.href = `https://merxusllc.com/pricing?type=${encodeURIComponent(selectedType)}`;
      link.textContent = 'Compare in the web application';
      link.setAttribute('data-app-link', '');
      decorate(link);
      card.append(label, title, price, setup, features, link);
      pricingRoot.append(card);
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      selectedType = tab.dataset.priceType;
      const url = new URL(window.location.href);
      url.searchParams.set('type', selectedType);
      window.history.replaceState(null, '', url);
      render();
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  fetch('https://api.merxus.ai/api/billing/pricing', { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error('Pricing unavailable');
      return response.json();
    })
    .catch(async () => {
      catalogSource = 'snapshot';
      const response = await fetch('/pricing/catalog.json');
      if (!response.ok) throw new Error('Pricing snapshot unavailable');
      return response.json();
    })
    .then((data) => { catalog = data; render(); })
    .catch(() => {
      status.textContent = 'Pricing is temporarily unavailable here. Open the full pricing page in the Merxus web application.';
      const fallback = document.createElement('a');
      fallback.href = 'https://merxusllc.com/pricing';
      fallback.className = 'button button-primary';
      fallback.textContent = 'View current pricing';
      pricingRoot.append(fallback);
    })
    .finally(() => clearTimeout(timeout));
  render();
})();
