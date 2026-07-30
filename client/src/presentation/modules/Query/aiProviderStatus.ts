export type AiModelRuntimeStatus =
  | 'rate-limited'
  | 'credits-required'
  | 'unavailable';

export function describeAiProviderError(message: string, lang: string) {
  const normalized = message.toLowerCase();
  if (/\b429\b/.test(message) || normalized.includes('rate limit')) {
    return {
      status: 'rate-limited' as const,
      message:
        lang === 'vi'
          ? 'Model đang bị giới hạn lượt gọi. Hãy chờ một chút hoặc chọn model khác.'
          : 'This model is temporarily rate limited. Wait a moment or choose another model.',
    };
  }
  if (/\b402\b/.test(message) || normalized.includes('requires provider credits')) {
    return {
      status: 'credits-required' as const,
      message:
        lang === 'vi'
          ? 'Provider yêu cầu thêm credit cho model này. Hãy nạp credit hoặc chọn model khác.'
          : 'This model requires provider credits. Add credits or choose another model.',
    };
  }
  if (/\b404\b/.test(message) || normalized.includes('is unavailable')) {
    return {
      status: 'unavailable' as const,
      message:
        lang === 'vi'
          ? 'Model này hiện không khả dụng. Hãy chọn model khác.'
          : 'This model is currently unavailable. Choose another model.',
    };
  }
  return { message };
}
