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
    searchTopics: pickLocalizedText(lang, 'Tìm nhanh tài liệu...', 'Search documentation...'),
    searchScope: pickLocalizedText(lang, 'Tìm theo mục tài liệu', 'Search documentation topics'),
    searchResults: pickLocalizedText(lang, 'Kết quả tìm kiếm tài liệu', 'Documentation search results'),
    clearSearch: pickLocalizedText(lang, 'Xóa tìm kiếm', 'Clear search'),
    noResults: pickLocalizedText(lang, 'Không tìm thấy mục phù hợp. Thử một từ khóa khác.', 'No matching topics. Try another keyword.'),
    openMenu: pickLocalizedText(lang, 'Mở menu tài liệu', 'Open documentation menu'),
    closeMenu: pickLocalizedText(lang, 'Đóng menu tài liệu', 'Close documentation menu'),
    navigation: pickLocalizedText(lang, 'Điều hướng tài liệu', 'Documentation navigation'),
    choosePage: pickLocalizedText(lang, 'Chọn một mục để tiếp tục khám phá.', 'Choose a topic to keep exploring.'),
    onThisPage: pickLocalizedText(lang, 'Trong bài này', 'On this page'),
    latestRelease: pickLocalizedText(lang, 'Bản phát hành mới nhất', 'Latest release'),
    lastReviewed: pickLocalizedText(lang, 'Tài liệu được rà soát', 'Documentation reviewed'),
    releasePublished: pickLocalizedText(lang, 'Phát hành', 'Released'),
  };
}

export function getLocalizedDocTitle(
  lang: AppLang | string | null | undefined,
  node: LocalizedDocNode,
) {
  return pickLocalizedText(lang, node.title, node.titleEn || node.title);
}
