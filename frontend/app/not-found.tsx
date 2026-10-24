'use client';
import { EmptyState } from '../components/ui';
import { useT } from '../lib/i18n';

export default function NotFound(){
  const t=useT();
  return <main id="main" className="page"><div className="container container-narrow">
    <EmptyState icon="search" title={t('We couldn’t find that page')} action={<a className="btn btn-primary" href="/">{t('Search stays')}</a>}>{t('The link may be out of date, or the page may have moved.')}</EmptyState>
  </div></main>;
}
