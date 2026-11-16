const NecessityAuditor = (function () {
  'use strict';

  function purgeHtml(rawHtml) {
    const startTime = performance.now();
    const rawBytes = new Blob([rawHtml]).size;

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const rawNodes = doc.body.querySelectorAll('*').length;

    // 1. Remove dangerous script elements and event handlers (Security Fix)
    doc.body.querySelectorAll('script').forEach(s => s.remove());
    doc.body.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
        if (attr.name === 'href' && attr.value.trim().toLowerCase().startsWith('javascript:')) {
          el.removeAttribute('href');
        }
      });
    });

    // 2. Deprecated <font> -> <span>
    let deprecatedTags = 0;
    doc.body.querySelectorAll('font').forEach(function (fontEl) {
      const span = doc.createElement('span');
      span.innerHTML = fontEl.innerHTML;
      fontEl.replaceWith(span);
      deprecatedTags++;
    });

    // 3. Strip inline styles and legacy attributes (Keep Classes!)
    let strippedStyles = 0;
    doc.body.querySelectorAll('*').forEach(function (el) {
      if (el.hasAttribute('style')) { el.removeAttribute('style'); strippedStyles++; }
      ['align', 'bgcolor', 'border', 'cellpadding', 'cellspacing'].forEach(function (attr) {
        if (el.hasAttribute(attr)) el.removeAttribute(attr);
      });
    });

    // 4. Collapse empty wrapper divs
    let unwrappedDivs = 0;
    let collapsed = true;
    while (collapsed) {
      collapsed = false;
      doc.body.querySelectorAll('div').forEach(function (div) {
        if (div.attributes.length === 0 && div.children.length === 1 && div.innerHTML.trim() === div.children[0].outerHTML.trim()) {
          div.replaceWith(div.children[0]);
          unwrappedDivs++;
          collapsed = true;
        }
      });
    }

    // 5. Serialize safely
    const purgedHtml = doc.body.innerHTML
      .replace(/>\s+</g, '><')
      .trim();

    const purgedBytes = new Blob([purgedHtml]).size;
    const purgedNodes = parser.parseFromString(purgedHtml, 'text/html').body.querySelectorAll('*').length;
    const reductionPercent = rawBytes > 0 ? Math.max(0, Math.round(((rawBytes - purgedBytes) / rawBytes) * 100)) : 0;

    return {
      purged_html: purgedHtml,
      raw_bytes: rawBytes,
      purged_bytes: purgedBytes,
      reduction_percent: reductionPercent,
      raw_nodes: rawNodes,
      purged_nodes: purgedNodes,
      latency_ms: Number(Math.max(0.1, performance.now() - startTime).toFixed(2)),
      audit: { stripped_styles: strippedStyles, unwrapped_divs: unwrappedDivs, deprecated_tags: deprecatedTags }
    };
  }

  return { 
    invoke: function(input) { return purgeHtml(input.html || input); }, 
    purgeHtml: purgeHtml 
  };
})();

window.NecessityAuditor = NecessityAuditor;
