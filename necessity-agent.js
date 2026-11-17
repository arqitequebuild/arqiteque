const NecessityAuditor = (function () {
  'use strict';

  const VALID_MODES = ['aggressive', 'safe', 'preserve-classes', 'security-first'];

  function normalizeMode(mode) {
    if (!mode || typeof mode !== 'string') return 'safe';
    const m = mode.toLowerCase().trim();
    return VALID_MODES.includes(m) ? m : 'safe';
  }

  function purgeHtml(rawHtml, mode = 'safe') {
    const startTime = performance.now();
    const selectedMode = normalizeMode(mode);

    if (typeof rawHtml !== 'string') {
      return {
        error: 'html must be a string',
        purged_html: '',
        mode: selectedMode
      };
    }

    const rawBytes = new Blob([rawHtml]).size;
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const rawNodes = doc.body.querySelectorAll('*').length;

    let removedScripts = 0;
    let removedEventHandlers = 0;
    let removedJavascriptHrefs = 0;
    let deprecatedTags = 0;
    let strippedStyles = 0;
    let strippedLegacyAttrs = 0;
    let unwrappedDivs = 0;
    let removedEmptyElements = 0;
    let removedComments = 0;

    // 1. SECURITY LAYER
    doc.body.querySelectorAll('script, iframe, object, embed, form').forEach(el => {
      el.remove();
      removedScripts++;
    });

    doc.body.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.toLowerCase().startsWith('on')) {
          el.removeAttribute(attr.name);
          removedEventHandlers++;
        }
      });
      ['href', 'src', 'action', 'formaction', 'xlink:href'].forEach(attrName => {
        if (el.hasAttribute(attrName)) {
          const val = el.getAttribute(attrName) || '';
          if (val.trim().toLowerCase().startsWith('javascript:')) {
            el.removeAttribute(attrName);
            removedJavascriptHrefs++;
          }
        }
      });
    });

    // 2. DEPRECATED TAGS
    doc.body.querySelectorAll('font').forEach(fontEl => {
      const span = doc.createElement('span');
      span.innerHTML = fontEl.innerHTML;
      fontEl.replaceWith(span);
      deprecatedTags++;
    });

    // 3. STYLE & ATTRIBUTE CLEANUP
    doc.body.querySelectorAll('*').forEach(el => {
      if (el.hasAttribute('style')) {
        if (selectedMode === 'aggressive' || selectedMode === 'safe' || selectedMode === 'security-first') {
          el.removeAttribute('style');
          strippedStyles++;
        }
      }
      const legacyAttrs = ['align', 'bgcolor', 'border', 'cellpadding', 'cellspacing', 'valign', 'width', 'height', 'color', 'face', 'size'];
      legacyAttrs.forEach(attr => {
        if (el.hasAttribute(attr)) {
          if (selectedMode !== 'preserve-classes' || !['width', 'height'].includes(attr)) {
            el.removeAttribute(attr);
            strippedLegacyAttrs++;
          }
        }
      });
    });

    // 4. STRUCTURAL CLEANUP
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT, null, false);
    const comments = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach(c => {
      c.remove();
      removedComments++;
    });

    let collapsed = true;
    while (collapsed) {
      collapsed = false;
      const candidates = selectedMode === 'aggressive'
        ? doc.body.querySelectorAll('div, span')
        : doc.body.querySelectorAll('div');

      candidates.forEach(el => {
        if (
          el.attributes.length === 0 &&
          el.children.length === 1 &&
          el.innerHTML.trim() === el.children[0].outerHTML.trim()
        ) {
          el.replaceWith(el.children[0]);
          unwrappedDivs++;
          collapsed = true;
        }
      });
    }

    if (selectedMode === 'aggressive' || selectedMode === 'security-first') {
      doc.body.querySelectorAll('div, span, p, section, article').forEach(el => {
        if (!el.textContent.trim() && el.children.length === 0 && el.attributes.length === 0) {
          el.remove();
          removedEmptyElements++;
        }
      });
    }

    // 5. SERIALIZE
    let purgedHtml = doc.body.innerHTML
      .replace(/>\s+</g, '><')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    if (selectedMode === 'aggressive') {
      purgedHtml = purgedHtml
        .replace(/\s+class=""/g, '')
        .replace(/\s+id=""/g, '');
    }

    const purgedBytes = new Blob([purgedHtml]).size;
    const purgedNodes = parser.parseFromString(purgedHtml, 'text/html').body.querySelectorAll('*').length;
    const reductionPercent = rawBytes > 0
      ? Math.max(0, Math.round(((rawBytes - purgedBytes) / rawBytes) * 100))
      : 0;

    return {
      purged_html: purgedHtml,
      mode: selectedMode,
      raw_bytes: rawBytes,
      purged_bytes: purgedBytes,
      reduction_percent: reductionPercent,
      raw_nodes: rawNodes,
      purged_nodes: purgedNodes,
      latency_ms: Number(Math.max(0.1, performance.now() - startTime).toFixed(2)),
      audit: {
        removed_scripts_and_embeds: removedScripts,
        removed_event_handlers: removedEventHandlers,
        removed_javascript_hrefs: removedJavascriptHrefs,
        deprecated_tags_converted: deprecatedTags,
        stripped_styles: strippedStyles,
        stripped_legacy_attributes: strippedLegacyAttrs,
        unwrapped_wrappers: unwrappedDivs,
        removed_empty_elements: removedEmptyElements,
        removed_comments: removedComments
      }
    };
  }

  return {
    invoke: function (input) {
      if (typeof input === 'string') {
        return purgeHtml(input, 'safe');
      }
      const html = input && (input.html || input.HTML || '');
      const mode = input && (input.mode || input.Mode || 'safe');
      return purgeHtml(html, mode);
    },
    purgeHtml: purgeHtml,
    modes: VALID_MODES
  };
})();

window.NecessityAuditor = NecessityAuditor;
