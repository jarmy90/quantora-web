import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { MATCHER_QUESTIONS, runMatcher, MATCHER_DISCLAIMER } from '../domain/matcher';
import type { MatcherAnswer, MatcherAnswers } from '../domain/matcher';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { StrategyCard } from '../components/StrategyCard';
import { CompareTray } from '../components/CompareTray';
import { PowerScoreExplain, RiskNotice, Seo } from '../components/ui';
import { track } from '../analytics/analytics';
import '../styles/app.css';

function Matcher() {
  const [answers, setAnswers] = useState<MatcherAnswers>({});
  const answered = MATCHER_QUESTIONS.every((q) => answers[q.id] !== undefined);
  const results = runMatcher(answers);

  const pick = (id: keyof MatcherAnswers, value: MatcherAnswer) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    track({ category: 'engagement', action: 'matcher_answer', label: id });
  };

  return (
    <>
      <Seo
        title="Find strategies that fit you — Quantora matcher"
        description="Answer four simple questions and see which Quantora strategies may fit your context, risk, experience and time. Educational — not investment advice."
      />
      <Nav />
      <main className="wrap">
        <section className="catalog-head">
          <div className="eyebrow">{t('matcher.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', letterSpacing: '-.06em', margin: '15px 0' }}>
            {t('matcher.title')}
          </h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            {t('matcher.body')}
          </p>
        </section>

        <div className="matcher-questions">
          {MATCHER_QUESTIONS.map((q) => (
            <div className="card" key={q.id}>
              <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>{q.title}</h2>
              <p className="muted" style={{ fontSize: 12, margin: '0 0 14px' }}>
                {q.hint}
              </p>
              <div className="choice-grid" role="group" aria-label={q.title}>
                {q.options.map((opt) => {
                  const active = answers[q.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      className={`choice ${active ? 'active' : ''}`}
                      aria-pressed={active}
                      onClick={() => pick(q.id, opt.value)}
                    >
                      <strong>{opt.label}</strong>
                      <span className="muted">{opt.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="card score-card" style={{ marginTop: 20 }}>
          <PowerScoreExplain compact />
        </div>
        <RiskNotice title={t('matcher.notAdviceTitle')} body={MATCHER_DISCLAIMER} />

        {answered && (
          <section style={{ margin: '28px 0 90px' }}>
            <div className="eyebrow">{t('matcher.resultsEyebrow')}</div>
            <h2 style={{ fontSize: 26, letterSpacing: '-.04em', margin: '10px 0 6px' }}>
              {t('matcher.resultsTitle')}
            </h2>
            <p className="muted">{t('matcher.resultsBody')}</p>
            <div className="matcher-results">
              {results.map((r) => (
                <div className="card" key={r.profile.id}>
                  <StrategyCard profile={r.profile} />
                  <div className="matcher-reasons">
                    <span className="mono" style={{ fontSize: 11, color: 'var(--lime)' }}>
                      {r.matched}/4 {t('matcher.matches')}
                    </span>
                    <ul className="plain-list">
                      {r.reasons.map((reason) => (
                        <li key={reason}>✓ {reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
              {t('matcher.sortNote')}
            </p>
          </section>
        )}
      </main>
      <CompareTray />
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/matcher')({ component: Matcher });
