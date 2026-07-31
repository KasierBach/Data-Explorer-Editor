import { useAppStore } from '@/core/services/store';

type QueryKind = 'SQL' | 'MQL' | 'Redis';

const clamp = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max)}\n[truncated]`;

export function buildAiQueryFixPrompt(
  query: string,
  error: string,
  kind: QueryKind,
  lang: 'vi' | 'en',
) {
  const safeQuery = clamp(query.trim(), 12_000);
  const safeError = clamp(error.trim(), 4_000);
  return lang === 'vi'
    ? `Hãy sửa truy vấn ${kind} dưới đây dựa trên lỗi thực thi. Chỉ đề xuất bản sửa; không tự chạy truy vấn. Trả về truy vấn đã sửa và giải thích ngắn thay đổi quan trọng.\n\nTRUY VẤN:\n${safeQuery}\n\nLỖI THỰC THI:\n${safeError}`
    : `Fix the ${kind} query below using the execution error. Only propose a correction; do not run it. Return the corrected query and briefly explain the important change.\n\nQUERY:\n${safeQuery}\n\nEXECUTION ERROR:\n${safeError}`;
}

export async function openAiQueryFixDraft(
  query: string,
  error: string,
  kind: QueryKind,
  lang: 'vi' | 'en',
) {
  const store = useAppStore.getState();
  const chatId = store.activeAiChatId || (await store.createAiChat());
  if (!chatId) return false;

  const draftKey = `ai-chat-draft-${chatId}`;
  const revision = Number(store.pageStates[draftKey]?.aiDraftRevision || 0) + 1;
  store.setPageState(draftKey, {
    input: buildAiQueryFixPrompt(query, error, kind, lang),
    attachments: [],
    aiDraftRevision: revision,
  });
  store.setAiPanelOpen(true);
  return true;
}
