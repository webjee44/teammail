export type ResponseTimeTier = {
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
  level: number; // 1=best, 5=worst
};

export function getResponseTimeTier(minutes: number): ResponseTimeTier {
  if (minutes < 5) {
    return { label: "Éclair", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500/10 border-green-500/30", emoji: "⚡", level: 1 };
  }
  if (minutes < 15) {
    return { label: "Rapide", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/30", emoji: "🚀", level: 2 };
  }
  if (minutes < 60) {
    return { label: "Correct", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/30", emoji: "👍", level: 3 };
  }
  if (minutes < 240) {
    return { label: "Lent", color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-500/10 border-orange-500/30", emoji: "🐢", level: 4 };
  }
  return { label: "À améliorer", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500/10 border-red-500/30", emoji: "🔴", level: 5 };
}

export function formatResponseTime(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/**
 * Calculate response times from a list of messages.
 * Returns an array of response time durations in minutes (inbound → first outbound reply).
 */
export function calcResponseTimes(messages: { is_outbound: boolean; sent_at: string }[]): number[] {
  const times: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (!messages[i].is_outbound) {
      for (let j = i + 1; j < messages.length; j++) {
        if (messages[j].is_outbound) {
          const diff = (new Date(messages[j].sent_at).getTime() - new Date(messages[i].sent_at).getTime()) / 60000;
          if (diff > 0 && diff < 1440) {
            times.push(diff);
          }
          break;
        }
      }
    }
  }
  return times;
}
