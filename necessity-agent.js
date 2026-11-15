/**
 * Necessity Auditor — site action wrapper.
 * Exposes the ARQITEQUE Necessity Engine as a callable agent action.
 * Runs entirely in the browser. No API key. Deterministic output.
 */
const NecessityAuditor = (function () {
  'use strict';

  function purgeHtml(rawHtml) {
    const startTime = performance.now();
    const rawBytes = new Blob([rawHtml]).size;

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const rawNodes = doc.body.querySelectorAll('*').length;

    let strippedStyles = 0;
    let strippedClasses = 0;
    let unwrappedDivs = 0;
    let deprecatedTags = 0;

    // 1. Deprecated <font> → <span>
    doc.body.querySelectorAll('font').forEach(function (fontEl) {
      const span = doc.createElement('span');
      span.innerHTML = fontEl.innerHTML;
      fontEl.replaceWith(span);
      deprecatedTags++;
    });

    // 2. Strip inline styles, classes, legacy attributes
    doc.body.querySelectorAll('*').forEach(function (el) {
      if (el.hasAttribute('style')) { el.removeAttribute('style'); strippedStyles++; }
      if (el.hasAttribute('class')) { el.removeAttribute('class'); strippedClasses++; }
      ['align', 'bgcolor', 'border', 'cellpadding', 'cellspacing', 'width'].forEach(function (attr) {
        if (el.hasAttribute(attr)) el.removeAttribute(attr);
      });
    });

    // 3. Collapse single-child divs with no attributes
    let collapsed = true;
    while (collapsed) {
      collapsed = false;
      doc.body.querySelectorAll('div').forEach(function (div) {
        if (div.attributes.length === 0 &&
            div.children.length === 1 &&
            div.textContent.trim() === div.children[0].textContent.trim()) {
          div.replaceWith(div.children[0]);
          unwrappedDivs++;
          collapsed = true;
        }
      });
    }

    // 4. Remove stray <br>
    doc.body.querySelectorAll('br').forEach(function (br) { br.remove(); });

    // 5. Serialize
    const purgedHtml = doc.body.innerHTML
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const purgedDoc = parser.parseFromString(purgedHtml, 'text/html');
    const purgedNodes = purgedDoc.body.querySelectorAll('*').length;
    const purgedBytes = new Blob([purgedHtml]).size;
    const reductionPercent = rawBytes > 0
      ? Math.max(0, Math.round(((rawBytes - purgedBytes) / rawBytes) * 100))
      : 0;

    const latencyMs = Math.max(0.1, performance.now() - startTime);

    return {
      purged_html: purgedHtml,
      raw_bytes: rawBytes,
      purged_bytes: purgedBytes,
      reduction_percent: reductionPercent,
      raw_nodes: rawNodes,
      purged_nodes: purgedNodes,
      latency_ms: Number(latencyMs.toFixed(2)),
      audit: {
        stripped_styles: strippedStyles,
        stripped_classes: strippedClasses,
        unwrapped_divs: unwrappedDivs,
        deprecated_tags: deprecatedTags
      }
    };
  }

  /**
   * Public callable interface. The runtime will invoke this.
   */
  function invoke(input) {
    if (!input || typeof input.html !== 'string') {
      throw new Error('NecessityAuditor: input must be an object with a string property "html".');
    }
    return purgeHtml(input.html);
  }

  return {
    invoke: invoke,
    purgeHtml: purgeHtml
  };
})();

// CRITICAL: Expose the module to the global window object so the agent runtime can find it.
window.NecessityAuditor = NecessityAuditor;
