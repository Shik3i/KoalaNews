import type { Locale } from './messages';

type LegalLocale = 'en' | 'de';

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalPage = {
  eyebrow: string;
  title: string;
  updated: string;
  sections: LegalSection[];
};

export const GITHUB_URL = 'https://github.com/Shik3i/KoalaNews';
export const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues`;
export const CONTACT_EMAIL = 'admin@koalastuff.net';

export function legalLocale(locale: Locale): LegalLocale {
  return locale === 'de' ? 'de' : 'en';
}

export const imprint: Record<LegalLocale, LegalPage> = {
  en: {
    eyebrow: 'Legal notice',
    title: 'Imprint',
    updated: 'Last updated: June 29, 2026',
    sections: [
      {
        heading: 'Provider and contact',
        paragraphs: [
          'KoalaNews is maintained by Timo (KoalaDev) as a private, open-source project from Germany.',
          `Email: ${CONTACT_EMAIL}`,
          `Technical issues and bug reports: ${GITHUB_ISSUES_URL}`,
        ],
      },
      {
        heading: 'Provider information',
        paragraphs: [
          'This site is a private, non-commercial open-source project. If mandatory provider identification under Section 5 DDG applies to a concrete deployment, the responsible operator must provide the required details separately.',
        ],
      },
      {
        heading: 'User responsibility',
        paragraphs: [
          'KoalaNews is an RSS and Atom feed reader. Users are responsible for the feeds they add, the content they read, and any links they open. Feed content belongs to the respective publishers.',
        ],
      },
      {
        heading: 'Own content',
        paragraphs: [
          'We take care to keep our own project information accurate, but KoalaNews is provided without warranty under the MIT License.',
        ],
      },
      {
        heading: 'External links',
        paragraphs: [
          'KoalaNews displays links to external publishers, feeds, images, project dependencies, and GitHub. We do not control third-party content and are not responsible for it. If we become aware of unlawful content behind an external link, we will remove that link where possible.',
        ],
      },
      {
        heading: 'Copyright',
        paragraphs: [
          'Website text, design, and project materials created by the project are protected by copyright unless a licence says otherwise. KoalaNews source code is available under the MIT License.',
        ],
      },
    ],
  },
  de: {
    eyebrow: 'Rechtlicher Hinweis',
    title: 'Impressum',
    updated: 'Stand: 29. Juni 2026',
    sections: [
      {
        heading: 'Anbieter und Kontakt',
        paragraphs: [
          'KoalaNews wird von Timo (KoalaDev) als privates Open-Source-Projekt aus Deutschland gepflegt.',
          `E-Mail: ${CONTACT_EMAIL}`,
          `Technische Probleme und Bugreports: ${GITHUB_ISSUES_URL}`,
        ],
      },
      {
        heading: 'Anbieterkennzeichnung',
        paragraphs: [
          'Diese Seite ist ein privates, nicht-kommerzielles Open-Source-Projekt. Falls fuer einen konkreten Betrieb eine Anbieterkennzeichnung nach Paragraf 5 DDG erforderlich ist, muss der jeweils verantwortliche Betreiber die erforderlichen Angaben separat bereitstellen.',
        ],
      },
      {
        heading: 'Verantwortung der Nutzer',
        paragraphs: [
          'KoalaNews ist ein RSS- und Atom-Feedreader. Nutzerinnen und Nutzer sind selbst verantwortlich fuer die Feeds, die sie hinzufuegen, die Inhalte, die sie lesen, und externe Links, die sie oeffnen. Feed-Inhalte gehoeren den jeweiligen Herausgebern.',
        ],
      },
      {
        heading: 'Eigene Inhalte',
        paragraphs: [
          'Wir bemuehen uns, eigene Projektinformationen sorgfaeltig zu pflegen. KoalaNews wird dennoch ohne Gewaehrleistung unter der MIT-Lizenz bereitgestellt.',
        ],
      },
      {
        heading: 'Externe Links',
        paragraphs: [
          'KoalaNews zeigt Links zu externen Publishern, Feeds, Bildern, Projektabhaengigkeiten und GitHub an. Wir haben keinen Einfluss auf Inhalte Dritter und uebernehmen dafuer keine Verantwortung. Wenn wir von rechtswidrigen Inhalten hinter einem externen Link erfahren, entfernen wir diesen Link, soweit moeglich.',
        ],
      },
      {
        heading: 'Urheberrecht',
        paragraphs: [
          'Von diesem Projekt erstellte Texte, Gestaltung und Projektmaterialien sind urheberrechtlich geschuetzt, sofern keine Lizenz etwas anderes regelt. Der Quellcode von KoalaNews steht unter der MIT-Lizenz.',
        ],
      },
    ],
  },
};

export const privacy: Record<LegalLocale, LegalPage> = {
  en: {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    updated: 'Last updated: June 29, 2026',
    sections: [
      {
        heading: 'Controller and contact',
        paragraphs: [
          'The controller for this project website and the reference KoalaNews deployment is the KoalaNews project maintainer, Timo (KoalaDev).',
          `Privacy contact: ${CONTACT_EMAIL}`,
        ],
      },
      {
        heading: 'Website access',
        paragraphs: [
          'When you visit the website, your browser necessarily sends technical request data such as your IP address, requested path, date and time, user agent, and referrer if supplied by your browser. This data is used only to deliver the site and maintain security. KoalaNews itself does not use analytics or tracking.',
        ],
      },
      {
        heading: 'Accounts and app data',
        paragraphs: [
          'If registration is enabled and you create an account, KoalaNews stores the data needed to operate the reader: email address, optional display name, password hash, session records, subscribed feeds, categories, custom feeds, read state, and appearance preferences.',
          'This data is used only to provide your feed reader. It is not sold, used for advertising, or shared with analytics providers.',
        ],
      },
      {
        heading: 'RSS feeds and remote content',
        paragraphs: [
          'KoalaNews fetches RSS and Atom feeds from the URLs configured by users or from the public default feeds. Feed publishers may see normal server requests from the KoalaNews server when feeds are refreshed.',
          'Article images may be fetched and cached by the KoalaNews backend so the browser does not hot-link third-party image servers directly while reading.',
        ],
      },
      {
        heading: 'Cookies',
        paragraphs: [
          'KoalaNews does not use tracking cookies. Logged-in sessions use a necessary httpOnly session cookie so the app can keep you signed in. This cookie is required for account-based features.',
        ],
      },
      {
        heading: 'No tracking',
        paragraphs: [
          'KoalaNews does not use advertising networks, analytics tools, tracking pixels, social media embeds, external fonts, or third-party scripts in the application frontend.',
        ],
      },
      {
        heading: 'Legal basis',
        paragraphs: [
          'Technical request processing is based on legitimate interest under Article 6(1)(f) GDPR: delivering a secure and functional website. Account and reader data is processed to provide the requested service under Article 6(1)(b) GDPR where applicable.',
        ],
      },
      {
        heading: 'Retention and deletion',
        paragraphs: [
          'Account data remains stored until the account or the relevant feeds/preferences are deleted by the user or an administrator. Session records expire automatically. Cached images and feed articles may be retained to keep the reader fast and reduce repeated third-party requests.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'Under the GDPR, you may have rights to access, rectification, erasure, restriction, objection, data portability, and complaint to a supervisory authority. Because KoalaNews is open source and self-hostable, the operator of a concrete deployment is responsible for responding to requests about that deployment.',
        ],
      },
    ],
  },
  de: {
    eyebrow: 'Datenschutz',
    title: 'Datenschutzerklaerung',
    updated: 'Stand: 29. Juni 2026',
    sections: [
      {
        heading: 'Verantwortlicher und Kontakt',
        paragraphs: [
          'Verantwortlich fuer diese Projektwebsite und die Referenz-Installation von KoalaNews ist der KoalaNews-Projektmaintainer Timo (KoalaDev).',
          `Datenschutzkontakt: ${CONTACT_EMAIL}`,
        ],
      },
      {
        heading: 'Zugriff auf die Website',
        paragraphs: [
          'Beim Besuch der Website uebermittelt der Browser technisch notwendige Request-Daten wie IP-Adresse, angefragten Pfad, Datum und Uhrzeit, User-Agent und gegebenenfalls Referrer. Diese Daten werden nur zur Auslieferung der Website und zur Sicherheit verarbeitet. KoalaNews selbst verwendet keine Analytics- oder Trackingdienste.',
        ],
      },
      {
        heading: 'Konten und App-Daten',
        paragraphs: [
          'Wenn Registrierung aktiviert ist und ein Konto erstellt wird, speichert KoalaNews die fuer den Betrieb des Readers notwendigen Daten: E-Mail-Adresse, optionalen Anzeigenamen, Passwort-Hash, Session-Eintraege, abonnierte Feeds, Kategorien, eigene Feeds, Lesestatus und Darstellungseinstellungen.',
          'Diese Daten werden nur bereitgestellt, um den Feedreader zu betreiben. Sie werden nicht verkauft, nicht fuer Werbung verwendet und nicht an Analytics-Anbieter weitergegeben.',
        ],
      },
      {
        heading: 'RSS-Feeds und externe Inhalte',
        paragraphs: [
          'KoalaNews ruft RSS- und Atom-Feeds von den URLs ab, die Nutzer konfigurieren, oder von den oeffentlichen Standard-Feeds. Feed-Anbieter koennen dabei normale Serveranfragen des KoalaNews-Servers sehen.',
          'Artikelbilder koennen vom KoalaNews-Backend abgerufen und zwischengespeichert werden, damit der Browser beim Lesen nicht direkt Bildserver Dritter hotlinkt.',
        ],
      },
      {
        heading: 'Cookies',
        paragraphs: [
          'KoalaNews verwendet keine Tracking-Cookies. Angemeldete Sitzungen nutzen ein notwendiges httpOnly-Session-Cookie, damit die App angemeldet bleiben kann. Dieses Cookie ist fuer konto-basierte Funktionen erforderlich.',
        ],
      },
      {
        heading: 'Kein Tracking',
        paragraphs: [
          'KoalaNews verwendet im Frontend keine Werbenetzwerke, Analytics-Tools, Tracking-Pixel, Social-Media-Embeds, externen Fonts oder Drittanbieter-Skripte.',
        ],
      },
      {
        heading: 'Rechtsgrundlage',
        paragraphs: [
          'Die technische Verarbeitung von Request-Daten erfolgt auf Grundlage berechtigter Interessen nach Art. 6 Abs. 1 lit. f DSGVO: Bereitstellung einer sicheren und funktionsfaehigen Website. Konto- und Reader-Daten werden, soweit anwendbar, zur Bereitstellung des gewuenschten Dienstes nach Art. 6 Abs. 1 lit. b DSGVO verarbeitet.',
        ],
      },
      {
        heading: 'Speicherung und Loeschung',
        paragraphs: [
          'Kontodaten bleiben gespeichert, bis das Konto oder die jeweiligen Feeds/Einstellungen durch Nutzer oder Administratoren geloescht werden. Session-Eintraege laufen automatisch ab. Zwischengespeicherte Bilder und Feed-Artikel koennen gespeichert bleiben, um den Reader schnell zu halten und wiederholte Drittanbieter-Anfragen zu reduzieren.',
        ],
      },
      {
        heading: 'Deine Rechte',
        paragraphs: [
          'Nach der DSGVO koennen Rechte auf Auskunft, Berichtigung, Loeschung, Einschraenkung, Widerspruch, Datenuebertragbarkeit und Beschwerde bei einer Aufsichtsbehoerde bestehen. Da KoalaNews Open Source und selbst hostbar ist, ist der Betreiber einer konkreten Installation fuer Anfragen zu dieser Installation verantwortlich.',
        ],
      },
    ],
  },
};
