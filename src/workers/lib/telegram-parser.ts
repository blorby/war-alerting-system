export interface TelegramMessage {
  messageId: number;
  timestamp: Date;
  text: string;
  html: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function parseMessages(html: string, channel: string): TelegramMessage[] {
  const messages: TelegramMessage[] = [];

  // Match each message block by finding data-post attributes for this channel
  const postPattern = new RegExp(
    `data-post="${channel}/(\\d+)"`,
    'g',
  );

  let match: RegExpExecArray | null;
  while ((match = postPattern.exec(html)) !== null) {
    const messageId = parseInt(match[1], 10);
    // Extract a block of HTML after this match to find the timestamp and text
    const blockStart = match.index;
    // Look ahead up to 10000 chars for the message content
    const blockEnd = Math.min(blockStart + 10000, html.length);
    const block = html.slice(blockStart, blockEnd);

    // Extract datetime
    const datetimeMatch = block.match(/datetime="([^"]+)"/);
    if (!datetimeMatch) continue;
    const timestamp = new Date(datetimeMatch[1]);
    if (isNaN(timestamp.getTime())) continue;

    // Extract message text HTML content
    const textMatch = block.match(
      /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/,
    );
    if (!textMatch) continue;
    const rawHtml = textMatch[1];
    const text = stripHtml(rawHtml);

    if (!text) continue;

    messages.push({
      messageId,
      timestamp,
      text,
      html: rawHtml,
    });
  }

  // Sort by messageId ascending
  messages.sort((a, b) => a.messageId - b.messageId);

  return messages;
}
