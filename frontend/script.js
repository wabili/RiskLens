document.getElementById('analyzeBtn').addEventListener('click', analyze);

async function analyze() {
    const ticker = document.getElementById('ticker').value.trim();
    if (!ticker) return;
    const limit = parseInt(document.getElementById('limit').value || '3', 10);
    const window_days = parseInt(document.getElementById('window_days').value || '365', 10);
    const include_raw = document.getElementById('include_raw').checked ? 'true' : 'false';

    const res = await fetch(`/analyze?ticker=${encodeURIComponent(ticker)}&limit=${limit}&window_days=${window_days}&include_raw=${include_raw}`);
    if (!res.ok) {
        document.getElementById('results').innerHTML = `<p>Error: ${res.status} ${res.statusText}</p>`;
        return;
    }
    const data = await res.json();
    renderResults(data, ticker);
}

function renderResults(data, ticker){
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    if (!data || !data.results || data.results.length === 0){
        resultsDiv.innerHTML = '<p>No filings returned.</p>';
        return;
    }

    data.results.forEach((filing, idx) => {
        const card = document.createElement('div');
        card.className = 'filing-card';

        const meta = document.createElement('div');
        meta.className = 'filing-meta';
        meta.innerHTML = `Filing #${filing.filing_number} — ${filing.form_type} — filed: ${filing.filing_date} ${filing.days_ago!==undefined?`(${filing.days_ago} days ago)`:''}`;
        card.appendChild(meta);

        const cyWrap = document.createElement('div');
        cyWrap.className = 'cy-container';
        cyWrap.id = `cy-${idx}`;
        card.appendChild(cyWrap);

        // small legend / counts
        const info = document.createElement('div');
        info.style.marginTop = '8px';
        if (filing.detected_event_categories && filing.detected_event_categories.length){
            filing.detected_event_categories.forEach(cat => {
                const b = document.createElement('span');
                b.className = 'event-badge';
                b.textContent = `${cat.event_type} (${cat.count || 1})`;
                info.appendChild(b);
            });
        }
        card.appendChild(info);

        resultsDiv.appendChild(card);

        // build cytoscape graph for this filing
        const elements = [];
        const centerId = `center-${idx}`;
        elements.push({ data: { id: centerId, label: `${ticker}\nFiling ${filing.filing_number}` } });

        const cats = filing.detected_event_categories || [];
        let nodeIndex = 0;
        cats.forEach((cat, ci) => {
            // each subevent becomes a node around the center
            (cat.subevents || []).forEach((sub, si) => {
                const nid = `n-${idx}-${nodeIndex++}`;
                const label = `${cat.event_type}\n${sub.match_text || sub.representative_match || ''}`;
                elements.push({ data: { id: nid, label: label, details: sub } });
                elements.push({ data: { id: `e-${centerId}-${nid}`, source: centerId, target: nid } });
            });
        });

        // if no events, show a placeholder node
        if (elements.length === 1){
            elements.push({ data: { id: `n-${idx}-empty`, label: 'No events detected' } });
            elements.push({ data: { id: `e-${centerId}-empty`, source: centerId, target: `n-${idx}-empty` } });
        }

        const cy = cytoscape({
            container: cyWrap,
            elements: elements,
            style: [
                { selector: 'node', style: { 'label': 'data(label)', 'text-wrap':'wrap', 'text-valign':'center', 'text-halign':'center', 'background-color':'#1f78b4', 'color':'#fff', 'width':'label', 'height':'label', 'padding':'8px', 'font-size': 11 } },
                { selector: `node[id = "${centerId}"]`, style: { 'background-color':'#ef4444', 'font-weight':'700', 'font-size':12 } },
                { selector: 'edge', style: { 'curve-style':'bezier', 'target-arrow-shape':'triangle', 'target-arrow-color':'#555', 'line-color':'#9ca3af' } }
            ],
            layout: { name: 'concentric', concentric: function(n){ return n.id() === centerId ? 2 : 1; }, levelWidth: function(){ return 1; }, minNodeSpacing: 20 }
        });

        // add click handler to show details
        cy.on('tap', 'node', function(evt){
            const node = evt.target;
            const details = node.data('details');
            if (details){
                const dHtml = `\n<strong>Match:</strong> ${escapeHtml(details.match_text||'')}<br/>`+
                    `<strong>Event type:</strong> ${escapeHtml(details.event_type||'')}<br/>`+
                    `<strong>Started:</strong> ${details.event_started_on||'N/A'}<br/>`+
                    `<strong>Time relation:</strong> ${details.time_relation||'unknown'}<br/>`+
                    `<strong>Sentence:</strong> ${escapeHtml(details.trigger_sentence||'')} `;
                showPopup(node.renderedPosition(), dHtml, cyWrap);
            }
        });
    });
}

function showPopup(pos, html, container){
    // simple tooltip; remove existing
    const existing = container.querySelector('.__popup');
    if (existing) existing.remove();
    const pop = document.createElement('div');
    pop.className = '__popup';
    pop.style.position = 'absolute';
    pop.style.left = `${pos.x + 10}px`;
    pop.style.top = `${pos.y + 10}px`;
    pop.style.background = '#fff';
    pop.style.border = '1px solid #cbd5e1';
    pop.style.padding = '8px';
    pop.style.zIndex = 9999;
    pop.innerHTML = html;
    container.appendChild(pop);
    setTimeout(()=> pop.remove(), 8000);
}

function escapeHtml(s){
    if(!s) return '';
    return s.replace(/[&<>\"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; });
}
