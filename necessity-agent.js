
function runEngine() {
  const rawHtml = document.getElementById('source-code').value;
  const iframe = document.getElementById('live-preview');

  try {
    const result = NecessityAuditor.invoke({ html: rawHtml });

    document.getElementById('metric-reduction').innerText =
      `${result.reduction_percent}%`;

    document.getElementById('metric-latency').innerText =
      `${result.latency_ms}ms`;

    const previewDocument = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;"
  >
  <style>
    body {
      background: #ffffff;
      color: #000000;
      font-family: sans-serif;
      padding: 24px;
    }
  </style>
</head>
<body>${result.purged_html}</body>
</html>`;

    iframe.srcdoc = previewDocument;

  } catch (error) {
    console.error('ARQITEQUE engine error:', error);

    iframe.srcdoc = '<!DOCTYPE html><html><body><p>Preview unavailable. Check your HTML input.</p></body></html>';

    document.getElementById('metric-reduction').innerText = '—';
    document.getElementById('metric-latency').innerText = '—';
  }
}

function exportCode() {
  const rawHtml = document.getElementById('source-code').value;

  try {
    const result = NecessityAuditor.invoke({ html: rawHtml });

    const blob = new Blob(
      [result.purged_html],
      { type: 'text/html;charset=utf-8' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'arqiteque-purged.html';

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (error) {
    console.error('ARQITEQUE export error:', error);
    alert(error.message || 'Export failed. Check your HTML input.');
  }
}

window.addEventListener('DOMContentLoaded', runEngine);
