import { pickLocalizedText, type AppLang } from '@/core/utils/i18n';

interface LayoutTabTitleInput {
  type: string;
  title: string;
}

export function getLayoutText(lang: AppLang | string | null | undefined) {
  return {
    ready: pickLocalizedText(lang, 'Sẵn sàng', 'Ready'),
    isolatedNoSqlWorkspace: pickLocalizedText(lang, 'Không gian NoSQL độc lập', 'Isolated NoSQL Workspace'),
    newQuery: pickLocalizedText(lang, 'Truy vấn mới', 'New Query'),
    visualizeHub: pickLocalizedText(lang, 'Trạm trực quan', 'Visualizer Hub'),
    queryTab: (index: string) => pickLocalizedText(lang, `Truy vấn ${index}`, `Query ${index}`),
  };
}

export function getLayoutTabTitle(
  tab: LayoutTabTitleInput,
  lang: AppLang | string | null | undefined,
) {
  const text = getLayoutText(lang);

  if (tab.type === 'query' && /^Query \d+$/.test(tab.title)) {
    return text.queryTab(tab.title.split(' ')[1]);
  }

  if (tab.type === 'query' && tab.title === 'New Query') {
    return text.newQuery;
  }

  if (tab.type === 'visualize' && tab.title === 'Visualizer Hub') {
    return text.visualizeHub;
  }

  return tab.title;
}
