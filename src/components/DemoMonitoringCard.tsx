/**
 * QNT-0015 · Demo Monitoring card (client).
 *
 * Clearly labelled DEMO MONITORING module for a real strategy detail page.
 * It renders the connection state resolved SERVER-side (never computed here),
 * shows demo metrics ONLY when real supplied demo data exists, and never
 * conflates backtest / demo / verified live. There are no buy, rent, payment
 * or download affordances, and no real MetaTrader connection is claimed.
 */
import { useEffect, useState } from 'react';
import type {
  DemoMonitoringSnapshot,
  DemoMonitoringStatus,
} from '../domain/demoMonitoring/contracts';
import { getDemoMonitoringSnapshot } from '../domain/demoMonitoring/server';
import { t } from '../i18n';

const STATUS_KEYS: Record<DemoMonitoringStatus, string> = {
  not_connected: 'monitor.statusNotConnected',
  connecting: 'monitor.statusConnecting',
  live_demo: 'monitor.statusLiveDemo',
  stale: 'monitor.statusStale',
  offline: 'monitor.statusOffline',
};

function statusLabel(status: DemoMonitoringStatus): string {
  return t(STATUS_KEYS[status] as Parameters<typeof t>[0]);
}

export function DemoMonitoringCard({ strategyId }: { strategyId: string }) {
  const [snapshot, setSnapshot] = useState<DemoMonitoringSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await getDemoMonitoringSnapshot({ data: { strategyId } });
        if (!cancelled) setSnapshot(next);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [strategyId]);

  // Honest default while the snapshot resolves (or if the call fails): the
  // module never fabricates a connection.
  const status: DemoMonitoringStatus = snapshot?.connectionStatus ?? 'not_connected';
  const unavailable = snapshot === null || error || snapshot.metrics === undefined;

  return (
    <section className="card demo-monitor-card" aria-label={t('detail.monitorEyebrow')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="eyebrow" style={{ marginBottom: 0 }}>
          {t('detail.monitorEyebrow')}
        </div>
        <span className={`status-chip demo-status-${status}`}>{statusLabel(status)}</span>
      </div>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 760, margin: '12px 0 0' }}>
        {t('monitor.body')}
      </p>
      <div className="monitor-grid">
        <div className="monitor-cell">
          <small>{t('detail.monitorStatus')}</small>
          <strong className="muted">{statusLabel(status)}</strong>
        </div>
        <div className="monitor-cell">
          <small>{t('detail.monitorBroker')}</small>
          <strong className="muted">{snapshot?.brokerLabel ?? t('detail.monitorNotAvailable')}</strong>
        </div>
        <div className="monitor-cell">
          <small>{t('detail.monitorBalance')}</small>
          <strong className="muted">{formatMinorAmount(snapshot?.metrics?.balanceMinor, snapshot?.metrics?.currency)}</strong>
        </div>
        <div className="monitor-cell">
          <small>{t('detail.monitorEquity')}</small>
          <strong className="muted">{formatMinorAmount(snapshot?.metrics?.equityMinor, snapshot?.metrics?.currency)}</strong>
        </div>
        <div className="monitor-cell">
          <small>{t('detail.monitorTrades')}</small>
          <strong className="muted">
            {snapshot?.metrics?.openTrades !== undefined ? String(snapshot.metrics.openTrades) : t('detail.monitorNotAvailable')}
          </strong>
        </div>
        <div className="monitor-cell">
          <small>{t('detail.monitorDrawdown')}</small>
          <strong className="muted">
            {snapshot?.metrics?.drawdownPct !== undefined ? `${snapshot.metrics.drawdownPct.toFixed(2)}%` : t('detail.monitorNotAvailable')}
          </strong>
        </div>
        <div className="monitor-cell">
          <small>{t('detail.monitorLastUpdate')}</small>
          <strong className="muted">{snapshot?.lastUpdatedAt ?? t('detail.monitorNotAvailable')}</strong>
        </div>
      </div>
      {unavailable && (
        <p className="mono" style={{ fontSize: 11.5, marginTop: 12, color: 'var(--muted)' }} role="status">
          {snapshot?.unavailableReason ?? t('monitor.unavailableReason')}
        </p>
      )}
      <p className="mono research-note" style={{ color: 'var(--amber)' }}>
        {t('detail.monitorLegend')}
      </p>
      <p className="mono" style={{ fontSize: 11.5, marginTop: 8, color: 'var(--muted)' }}>
        {t('monitor.disclaimer')}
      </p>
    </section>
  );
}

/** Amounts are integer minor units when reported (e.g. cents). Never invented. */
function formatMinorAmount(minor: number | undefined, currency: string | undefined): string {
  if (minor === undefined || currency === undefined || !currency.trim()) {
    return t('detail.monitorNotAvailable');
  }
  return `${(minor / 100).toFixed(2)} ${currency}`;
}