export type FeedLanguage = {
  code: string;
  flag: string;
  name: string;
};

export const FEED_LANGUAGES: FeedLanguage[] = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'pt', flag: '🇵🇹', name: 'Português' },
  { code: 'pt-br', flag: '🇧🇷', name: 'Português (Brasil)' },
  { code: 'nl', flag: '🇳🇱', name: 'Nederlands' },
  { code: 'pl', flag: '🇵🇱', name: 'Polski' },
  { code: 'sv', flag: '🇸🇪', name: 'Svenska' },
  { code: 'no', flag: '🇳🇴', name: 'Norsk' },
  { code: 'da', flag: '🇩🇰', name: 'Dansk' },
  { code: 'fi', flag: '🇫🇮', name: 'Suomi' },
  { code: 'is', flag: '🇮🇸', name: 'Islenska' },
  { code: 'cs', flag: '🇨🇿', name: 'Cestina' },
  { code: 'sk', flag: '🇸🇰', name: 'Slovencina' },
  { code: 'sl', flag: '🇸🇮', name: 'Slovenscina' },
  { code: 'hr', flag: '🇭🇷', name: 'Hrvatski' },
  { code: 'hu', flag: '🇭🇺', name: 'Magyar' },
  { code: 'ro', flag: '🇷🇴', name: 'Romana' },
  { code: 'bg', flag: '🇧🇬', name: 'Balgarski' },
  { code: 'el', flag: '🇬🇷', name: 'Ellinika' },
  { code: 'tr', flag: '🇹🇷', name: 'Turkce' },
  { code: 'ru', flag: '🇷🇺', name: 'Russkiy' },
  { code: 'uk', flag: '🇺🇦', name: 'Ukrainska' },
  { code: 'ar', flag: '🇸🇦', name: 'Arabic' },
  { code: 'he', flag: '🇮🇱', name: 'Hebrew' },
  { code: 'fa', flag: '🇮🇷', name: 'Persian' },
  { code: 'hi', flag: '🇮🇳', name: 'Hindi' },
  { code: 'bn', flag: '🇧🇩', name: 'Bangla' },
  { code: 'ur', flag: '🇵🇰', name: 'Urdu' },
  { code: 'id', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'ms', flag: '🇲🇾', name: 'Melayu' },
  { code: 'th', flag: '🇹🇭', name: 'Thai' },
  { code: 'vi', flag: '🇻🇳', name: 'Tieng Viet' },
  { code: 'zh', flag: '🇨🇳', name: 'Chinese' },
  { code: 'zh-tw', flag: '🇹🇼', name: 'Chinese (Taiwan)' },
  { code: 'ja', flag: '🇯🇵', name: 'Japanese' },
  { code: 'ko', flag: '🇰🇷', name: 'Korean' },
];

const byCode = new Map(FEED_LANGUAGES.map((lang) => [lang.code, lang]));

export function feedLanguage(code: string | null | undefined): FeedLanguage {
  return byCode.get((code ?? '').toLowerCase()) ?? byCode.get('en')!;
}

export function feedLanguageLabel(code: string | null | undefined): string {
  const lang = feedLanguage(code);
  return `${lang.flag} ${lang.name}`;
}

export function feedLanguageFlag(code: string | null | undefined): string {
  return feedLanguage(code).flag;
}
