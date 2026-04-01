export interface TelegramChannelConfig {
  channel: string;    // e.g. 'idfofficial'
  name: string;       // human-readable
  source: string;     // event source key
  language: string;
}

export const TELEGRAM_CHANNELS: TelegramChannelConfig[] = [
  { channel: 'PikudHaOref_all', name: 'HFC Alerts', source: 'telegram-hfc-alerts', language: 'he' },
  { channel: 'HanhayotPikudHaOref', name: 'HFC Instructions', source: 'telegram-hfc-instructions', language: 'he' },
  { channel: 'idfofficial', name: 'IDF Official', source: 'telegram-idf', language: 'en' },
];
