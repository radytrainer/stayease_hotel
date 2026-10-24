import './globals.css';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { LanguageProvider } from '../lib/i18n';
import { LANG_COOKIE, translate, type Lang } from '../lib/lang';

/** React 19 hoists this stylesheet into <head>; DM Sans and Manrope for text, Noto Sans Khmer for Khmer, Dancing Script for receipt signatures. */
const FONTS='https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Manrope:wght@600;700;800&family=Noto+Sans+Khmer:wght@400;500;600;700;800&family=Dancing+Script:wght@600&display=swap';

export const metadata: Metadata = { title: { default: 'StayEase | Find your next stay', template: '%s | StayEase' }, description: 'Book hotels across Cambodia, from Siem Reap and Phnom Penh to Kampot, Kep and Kampong Som, with live availability and clear prices.' };
export const viewport: Viewport = { themeColor: '#13766b', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The language cookie is read on the server so the first paint is already in the guest's language.
  const lang: Lang = (await cookies()).get(LANG_COOKIE)?.value === 'km' ? 'km' : 'en';
  return <html lang={lang}><body>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
    <link rel="stylesheet" href={FONTS} precedence="default"/>
    <LanguageProvider initial={lang}>
      <a className="skip-link" href="#main">{translate('Skip to content', undefined, lang)}</a>
      <SiteHeader />
      {children}
      <SiteFooter />
    </LanguageProvider>
  </body></html>;
}
