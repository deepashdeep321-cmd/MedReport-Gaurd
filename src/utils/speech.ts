import type { LanguageCode } from '../types/medreport';

const SPEECH_LOCALES: Record<LanguageCode, string> = {
  en: 'en-IN',
  ta: 'ta-IN',
  hi: 'hi-IN',
};

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function speakSentences(
  sentences: string[],
  language: LanguageCode,
  onSentenceIndex: (index: number | null) => void,
  onDone: () => void,
): boolean {
  if (!isSpeechSupported() || sentences.length === 0) {
    onDone();
    return false;
  }

  window.speechSynthesis.cancel();
  const locale = SPEECH_LOCALES[language];
  const voices = window.speechSynthesis.getVoices();
  const matchingVoice =
    voices.find((v) => v.lang.toLowerCase().startsWith(locale.toLowerCase())) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(language));

  let cancelled = false;

  const speakNext = (idx: number) => {
    if (cancelled || idx >= sentences.length) {
      onSentenceIndex(null);
      onDone();
      return;
    }

    onSentenceIndex(idx);
    const cleanText = sentences[idx].replace(/\[R\d+\]/gi, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = locale;
    utterance.rate = 0.94;
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => {
      speakNext(idx + 1);
    };
    utterance.onerror = () => {
      cancelled = true;
      onSentenceIndex(null);
      onDone();
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNext(0);
  return true;
}
