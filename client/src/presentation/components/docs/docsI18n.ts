import { pickLocalizedText, type AppLang } from '@/core/utils/i18n';

type LocalizedDocNode = {
  title: string;
  titleEn?: string;
};

export function getDocsText(lang: AppLang | string | null | undefined) {
  return {
    documentation: pickLocalizedText(lang, 'Tài liệu', 'Documentation'),
    support: pickLocalizedText(lang, 'Hỗ trợ', 'Support'),
    previous: pickLocalizedText(lang, 'Trước đó', 'Previous'),
    next: pickLocalizedText(lang, 'Tiếp theo', 'Next'),
  };
}

export function getLocalizedDocTitle(
  lang: AppLang | string | null | undefined,
  node: LocalizedDocNode,
) {
  return pickLocalizedText(lang, node.title, node.titleEn || node.title);
}
