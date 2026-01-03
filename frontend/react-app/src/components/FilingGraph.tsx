// src/components/FilingGraph.tsx
import React, { useMemo, useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';

// Map event_nature to border colors (only 'single' and 'process')
const EVENT_NATURE_BORDER_COLORS: Record<string, string> = {
  single: '#22c55e',   // green
  process: '#a21caf',  // purple
};

// Map event types to unique border colors
const EVENT_TYPE_BORDER_COLORS: Record<string, string> = {
  reverse_stock_split: '#f59e42',
  authorized_share_increase: '#eab308',
  equity_offering: '#3b82f6',
  blank_check_preferred_stock: '#a21caf',
  warrant_activity: '#f43f5e',
  convertible_debt: '#6366f1',
  corporate_restructuring: '#0ea5e9',
  going_concern_opinion: '#f87171',
  financial_distress_indicators: '#facc15',
  liquidation_and_dissolution: '#64748b',
  delisting_and_deregistration: '#e11d48',
  debt_covenant_violations: '#f472b6',
  asset_sales_and_divestitures: '#10b981',
  executive_departures: '#f97316',
  strategic_evaluation: '#14b8a6',
  debt_modification: '#8b5cf6',
};

const getEventColor = (eventType: string): string => {
  const type = eventType.toLowerCase();
  if (type.includes('process')) return '#f59e0b'; // amber-500
  if (type.includes('sudden')) return '#ef4444'; // red-500
  if (type.includes('one') || type.includes('single')) return '#6366f1'; // indigo-500
  return '#3b82f1'; // blue-500
};

const getEventBorderColor = (eventType: string): string => {
  return EVENT_TYPE_BORDER_COLORS[eventType] || '#3b82f1';
};

export default function FilingGraph({ filing, ticker }: { filing: any; ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<
    | null
    | {
        sentences?: string[];
        filingId?: string;
        filingNumber?: string;
        filingDate?: string;
        formType?: string;
        eventLabel?: string;
        eventDescription?: string;
        subEvents?: { trigger_sentence: string }[];
      }
  >(null);

  const elements = useMemo(() => {
    // If filing is an empty array or falsy, show the empty message node
    if (!filing || (Array.isArray(filing) && filing.length === 0)) {
      return [
        {
          data: {
            id: 'no-results',
            label: `No bad keyword is found in recent ${filing?.filings_analyzed ?? '?'} files for ticker ${ticker}`,
            type: 'noresults',
          },
        },
      ];
    }

    const elems: { data: Record<string, any> }[] = [];
    const tickerId = `ticker-center`;
    elems.push({
      data: {
        id: tickerId,
        label: ticker,
        type: 'ticker',
        tooltip: `Ticker: ${ticker}`,
      },
    });

    const filingsArr = Array.isArray(filing) ? filing : [filing];
    const sortedFilings = [...filingsArr].sort((a, b) => {
      if (typeof a.days_ago !== 'number') return 1;
      if (typeof b.days_ago !== 'number') return -1;
      return a.days_ago - b.days_ago;
    });

    sortedFilings.forEach((filingObj: any, fi: number) => {
      const filingId = `filing-${filingObj.filing_number}`;
      let borderColor = '#334155';
      let borderWidth = 4;
      if (fi === 0) {
        borderColor = '#ff2222';
        borderWidth = 6;
      } else if (fi === 1) {
        borderColor = 'rgba(255,140,0,0.7)';
        borderWidth = 6;
      }

      elems.push({
        data: {
          id: filingId,
          label:
            typeof filingObj.days_ago === 'number' && filingObj.days_ago !== null
              ? `${filingObj.days_ago}`
              : filingObj.form_type || 'Filing',
          type: 'filing',
          form_type: filingObj.form_type,
          filing_date: filingObj.filing_date,
          tooltip: `Filing #${filingObj.filing_number}\nForm: ${filingObj.form_type || ''}\nDate: ${filingObj.filing_date || ''}\nDays ago: ${filingObj.days_ago ?? ''}`,
          borderColor,
          borderWidth,
        },
      });

      // Connect filing to ticker
      elems.push({
        data: {
          id: `e-${filingId}-${tickerId}`,
          source: filingId,
          target: tickerId,
          // label removed
          tooltip: `Filing to Ticker\nDate: ${filingObj.filing_date || ''}`,
        },
      });

      const cats = filingObj.detected_event_categories || [];
      cats.forEach((cat: any, ci: number) => {
        const catId = `cat-${filingObj.filing_number}-${ci}`;
        const color = getEventColor(cat.event_type);

        // Use event_nature for border color if available, else fall back to event_type
        let borderColor = getEventBorderColor(cat.event_type);
        const nature = (cat.event_nature || '').toLowerCase();
        if (EVENT_NATURE_BORDER_COLORS[nature]) {
          borderColor = EVENT_NATURE_BORDER_COLORS[nature];
        }

        const formattedEventType = (cat.event_type || '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        let eventClass = '';
        if (typeof cat.days_remaining === 'number') {
          if (cat.days_remaining < 0) eventClass = 'event-past';
          else if (cat.days_remaining > 0) eventClass = 'event-future';
        }

        elems.push({
          data: {
            id: catId,
            label: formattedEventType,
            color: color,
            borderColor,
            type: 'event',
            event_nature: cat.event_nature,
            description: cat.description,
            confidence_interval: cat.confidence_interval,
            event_started_on: cat.event_started_on,
            event_ends_on: cat.event_ends_on,
            days_remaining: cat.days_remaining,
            tooltip: `Event: ${formattedEventType}\n${cat.description || ''}\nStart: ${cat.event_started_on || ''}\nEnd: ${cat.event_ends_on || ''}`,
          },
          classes: eventClass,
        });

        // Connect event to filing
        elems.push({
          data: {
            id: `e-${catId}-${filingId}`,
            source: catId,
            target: filingId,
            label: typeof cat.days_remaining === 'number' ? `${cat.days_remaining} days` : '',
            tooltip: `Event: ${formattedEventType}\n${cat.description || ''}`,
          },
        });
      });
    });

    return elems;
  }, [filing, ticker]);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node[type = "ticker"]',
          style: {
            label: 'data(label)',
            'background-color': '#f59e42',
            color: '#fff',
            'font-size': 18,
            width: 140,
            height: 140,
            'text-valign': 'center',
            'text-halign': 'center',
            'font-weight': 'bold',
            'text-wrap': 'wrap',
            'text-max-width': '120',
            'text-overflow-wrap': 'anywhere',
            'text-margin-y': 2,
            'text-outline-width': 0,
            'text-background-opacity': 0,
          },
        },
        {
          selector: 'node[type = "filing"]',
          style: {
            label: 'data(label)',
            'background-color': '#334155',
            color: '#fff',
            'font-size': 12,
            width: 100,
            height: 100,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '90',
            'text-overflow-wrap': 'anywhere',
            'text-margin-y': 2,
            'text-outline-width': 0,
            'text-background-opacity': 0,
            'border-width': 'data(borderWidth)',
            'border-color': 'data(borderColor)',
          },
        },
        {
          selector: 'node[type = "event"]',
          style: {
            label: 'data(label)',
            'background-color': 'data(color)',
            color: '#fff',
            'font-size': 12,
            width: 100,
            height: 100,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '90',
            'text-overflow-wrap': 'anywhere',
            'text-margin-y': 2,
            'text-outline-width': 0,
            'text-background-opacity': 0,
            'border-width': 4,
            'border-color': 'data(borderColor)',
            'filter': 'none',
            opacity: 1,
            'box-shadow': 'none',
          },
        },
        {
          selector: 'node.event-past',
          style: {
            opacity: 0.35,
            filter: 'grayscale(0.7) blur(1.5px)',
            'box-shadow': 'none',
          },
        },
        {
          selector: 'node.event-future',
          style: {
            'box-shadow': '0 0 24px 8px #fff8',
            filter: 'brightness(1.2) drop-shadow(0 0 12px #fff8)',
            opacity: 1,
          },
        },
        {
          selector: 'node[label = "No risk events"]',
          style: {
            'background-color': '#64748b',
            'font-style': 'italic',
            color: '#fff',
            'text-outline-color': '#111',
            'text-outline-width': 2,
          },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#38bdf8',
            'line-color': '#334155',
            width: 3,
            opacity: 0.85,
            label: 'data(label)',
            'font-size': 10,
            color: '#fff',
            'text-background-color': '#222',
            'text-background-opacity': 0.8,
            'text-background-shape': 'roundrectangle',
            'text-margin-y': -10,
          },
        },
      ],
      layout: {
        name: 'cose',
        fit: true,
        avoidOverlap: true,
        padding: 40,
        nodeRepulsion: 20000,
        idealEdgeLength: 60,
        minTemp: 0.8,
        animate: true,
      },
    });

    // Set background
    cy.style().selector('core').style({ 'background-color': '#111' }).update();

    // Hover effects
    cy.on('mouseover', 'node[type = "event"]', (evt) => {
      const node = evt.target;
      node.stop();
      node.animate(
        {
          style: {
            'font-size': 16,
            width: 130,
            height: 130,
            'background-color': node.data('color'),
            opacity: 1,
            'border-width': 8,
            'border-color': '#fff',
            filter: 'brightness(1.25) drop-shadow(0 0 16px #fff8)',
            'z-index': 999,
          },
        },
        { duration: 120 }
      );
    });

    cy.on('mouseout', 'node[type = "event"]', (evt) => {
      const node = evt.target;
      node.stop();
      const isPast = node.hasClass('event-past');
      node.animate(
        {
          style: {
            'font-size': 12,
            width: 100,
            height: 100,
            'background-color': node.data('color'),
            opacity: isPast ? 0.35 : 1,
            'border-width': 4,
            'border-color': node.data('borderColor'),
            filter: isPast ? 'grayscale(0.7) blur(1.5px)' : 'none',
            'z-index': 1,
          },
        },
        { duration: 120 }
      );
    });

    // Zoom on node tap
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      cy.animate({
        fit: { eles: node.closedNeighborhood(), padding: 80 },
        duration: 400,
      });
    });

    // Zoom out on background tap
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.animate({
          fit: { eles: cy.elements(), padding: 40 },
          duration: 400,
        });
      }
    });

    // Filing node click → show filing modal
    cy.on('tap', 'node[type = "filing"]', (evt) => {
      const node = evt.target;
      const filingId = node.id();
      const filingsArr = Array.isArray(filing) ? filing : [filing];
      const filingObj = filingsArr.find((f) => `filing-${f.filing_number}` === filingId);

      if (filingObj && Array.isArray(filingObj.sentences) && filingObj.sentences.length > 0) {
        setModal({
          sentences: filingObj.sentences,
          filingId,
          filingNumber: filingObj.filing_number?.toString() || '',
          filingDate: filingObj.filing_date,
          formType: filingObj.form_type,
        });
      }
    });

    // Event node click → show event modal
    cy.on('tap', 'node[type = "event"]', (evt) => {
      const node = evt.target;
      const eventId = node.id();
      let foundEvent = null;
      let subEvents: { trigger_sentence: string }[] = [];
      const filingsArr = Array.isArray(filing) ? filing : [filing];

      outer: for (const f of filingsArr) {
        const cats = f.detected_event_categories || [];
        for (let ci = 0; ci < cats.length; ci++) {
          const catId = `cat-${f.filing_number}-${ci}`;
          if (catId === eventId) {
            foundEvent = cats[ci];

            // Support both 'sub_events' (snake_case) and 'subevents' (camelCase)
            const subEventsRaw = foundEvent.sub_events || foundEvent.subevents || [];
            if (Array.isArray(subEventsRaw)) {
              subEvents = subEventsRaw
                .filter((se: any) => se && typeof se.trigger_sentence === 'string')
                .map((se: any) => ({ trigger_sentence: se.trigger_sentence }));
            }

            setModal({
              eventLabel: node.data('label'),
              eventDescription: foundEvent.description,
              subEvents,
            });
            break outer;
          }
        }
      }
    });

    return () => {
      cy.destroy();
    };
  }, [elements, filing]);

  // Show a clear message if filings are empty
  const isEmpty = !filing || (Array.isArray(filing) && filing.length === 0);
  return (
    <>
      {isEmpty && (
        <div style={{
          width: '100%',
          textAlign: 'center',
          color: '#e5e7eb',
          fontSize: 18,
          fontWeight: 400,
          padding: '48px 0',
        }}>
          No bad keyword is found in recent {filing?.filings_analyzed ?? '?'} files for ticker {ticker}
        </div>
      )}
      {!isEmpty && (
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            background: '#111',
            borderRadius: 18,
          }}
        />
      )}
      {modal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.32)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
              color: '#fff',
              borderRadius: 18,
              boxShadow: '0 8px 32px #000a',
              padding: '32px 32px 24px 32px',
              minWidth: 340,
              maxWidth: 520,
              maxHeight: '75vh',
              overflowY: 'auto',
              border: '2px solid #888',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Filing Modal */}
            {modal.filingNumber != null ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    marginBottom: 18,
                    borderBottom: '1.5px solid #444',
                    paddingBottom: 10,
                    width: '100%',
                    gap: 2,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: 0.5, marginBottom: 2 }}>
                    Filing #{modal.filingNumber}
                  </div>
                  <div style={{ fontSize: 15, color: '#fbbf24', fontWeight: 500, marginBottom: 2 }}>
                    {modal.filingDate ? `Date: ${modal.filingDate}` : ''}
                  </div>
                  <div style={{ fontSize: 15, color: '#60a5fa', fontWeight: 500 }}>
                    {modal.formType ? `Form: ${modal.formType}` : ''}
                  </div>
                </div>
                <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                  {modal.sentences?.map((s, i) => (
                    <li
                      key={i}
                      style={{
                        background: '#333',
                        borderRadius: 8,
                        marginBottom: 10,
                        padding: '10px 14px',
                        fontSize: 15,
                        lineHeight: 1.6,
                        boxShadow: '0 2px 8px #0002',
                      }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              /* Event Modal */
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    marginBottom: 18,
                    borderBottom: '1.5px solid #444',
                    paddingBottom: 10,
                    width: '100%',
                    gap: 2,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: 0.5, marginBottom: 2 }}>
                    {modal.eventLabel}
                  </div>
                </div>
                <div style={{ fontSize: 15, color: '#fbbf24', fontWeight: 500, marginBottom: 10 }}>
                  {modal.eventDescription}
                </div>
                {modal.subEvents && modal.subEvents.length > 0 && (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 16, margin: '10px 0 6px 0', color: '#60a5fa' }}>
                      Sub-events
                    </div>
                    <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                      {modal.subEvents.map((se, i) => (
                        <li
                          key={i}
                          style={{
                            background: '#333',
                            borderRadius: 8,
                            marginBottom: 10,
                            padding: '10px 14px',
                            fontSize: 15,
                            lineHeight: 1.6,
                            boxShadow: '0 2px 8px #0002',
                          }}
                        >
                          <span style={{ color: '#fbbf24', fontWeight: 500 }}>Trigger:</span> {se.trigger_sentence}
                          {Object.keys(se)
                            .filter((k) => k !== 'trigger_sentence')
                            .map((k, j) => (
                              <div key={j} style={{ color: '#60a5fa', fontSize: 14, marginTop: 4 }}>
                                <span style={{ fontWeight: 500 }}>{k.replace(/_/g, ' ')}:</span> {String(se[k])}
                              </div>
                            ))}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
            <button
              style={{
                position: 'absolute',
                top: 12,
                right: 18,
                background: 'transparent',
                color: '#aaa',
                border: 'none',
                fontSize: 22,
                cursor: 'pointer',
                transition: 'color 0.2s',
              }}
              onClick={() => setModal(null)}
              aria-label="Close"
              onMouseOver={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#aaa')}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}