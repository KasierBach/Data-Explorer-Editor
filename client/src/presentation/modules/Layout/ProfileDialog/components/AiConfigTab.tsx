import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Boxes, Check, ChevronsUpDown, Database, FileSearch, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/core/services/api.service';
import {
    parseCustomProviderModelId,
    INHERIT_ASSISTANT_MODEL,
    updateAiPreferences,
    useAiPreferences,
    type CustomAiProvider,
} from '@/core/services/aiPreferences';
import { useAppStore } from '@/core/services/store';
import { cn } from '@/lib/utils';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/ui/popover';
import { getAssistantModelCatalog } from '@/presentation/modules/Query/assistantModelCatalog';
import { filterSearchableGroups, normalizeProviderBaseUrl, type SearchableGroup } from './AiConfigTab.utils';

interface AiConfigTabProps {
    t: (key: string) => string;
}

type ProviderFormState = {
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    vision: boolean;
    document: boolean;
};

type ProviderTestResult = {
    ok: boolean;
    models: string[];
    latencyMs: number;
    error?: string | null;
};

const toClientProvider = (provider: CustomAiProvider): CustomAiProvider => ({
    ...provider,
    apiKey: '',
    serverManaged: true,
    models: Array.isArray(provider.models) ? provider.models : [],
});

interface SearchableModelSelectProps {
    allowCustomValue?: boolean;
    emptyLabel: string;
    groups: SearchableGroup[];
    minContentWidth?: number;
    onChange: (value: string) => void;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
    placeholder: string;
    searchPlaceholder: string;
    value: string;
    wrapOptionLabel?: boolean;
}

const EMPTY_FORM: ProviderFormState = {
    name: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    vision: false,
    document: false,
};

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

const getProviderModelsErrorMessage = (error: unknown, fallback: string, backendUnavailable: string) => {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
        return backendUnavailable;
    }

    const message = getErrorMessage(error, fallback);
    return /failed to fetch/i.test(message) ? backendUnavailable : message;
};

const findSearchableOption = (groups: SearchableGroup[], value: string) =>
    groups.flatMap((group) => group.options).find((option) => option.value === value);

const SearchableModelSelect: React.FC<SearchableModelSelectProps> = ({
    allowCustomValue = false,
    emptyLabel,
    groups,
    minContentWidth,
    onChange,
    onOpenChange,
    open,
    placeholder,
    searchPlaceholder,
    value,
    wrapOptionLabel = false,
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [contentWidth, setContentWidth] = useState<number | undefined>(undefined);
    const [contentMaxHeight, setContentMaxHeight] = useState<number | undefined>(undefined);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const isOpen = open ?? internalIsOpen;

    const filteredGroups = useMemo(() => filterSearchableGroups(groups, query), [groups, query]);
    const selectedOption = useMemo(() => findSearchableOption(groups, value), [groups, value]);
    const hasVisibleGroupLabels = groups.filter((group) => group.label).length > 1;

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const trigger = triggerRef.current;
        const firstRect = trigger?.getBoundingClientRect();

        if (trigger && firstRect && window.innerHeight - firstRect.bottom < 320) {
            trigger.scrollIntoView({ block: 'center', inline: 'nearest' });
        }

        const frameId = window.requestAnimationFrame(() => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) {
                return;
            }

            setContentWidth(rect.width);
            setContentMaxHeight(Math.max(220, window.innerHeight - rect.bottom - 24));
        });

        const timeoutId = window.setTimeout(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
        }, 0);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(timeoutId);
        };
    }, [isOpen]);

    const displayValue = value ? (selectedOption?.label ?? value) : placeholder;
    const contentStyle = {
        width: contentWidth ? Math.max(contentWidth, minContentWidth ?? 0) : minContentWidth,
        maxWidth: 'min(42rem, calc(100vw - 2rem))',
        maxHeight: contentMaxHeight ? `${contentMaxHeight}px` : undefined,
    } as const;

    const handleQueryChange = (nextQuery: string) => {
        setQuery(nextQuery);
    };

    const handleCustomValueSubmit = () => {
        if (!allowCustomValue) {
            return;
        }

        const nextValue = query.trim();
        if (!nextValue) {
            return;
        }

        onChange(nextValue);
        handleOpenChange(false);
    };

    const handleSelect = (nextValue: string) => {
        onChange(nextValue);
        if (open === undefined) {
            setInternalIsOpen(false);
        }
        onOpenChange?.(false);
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            setQuery('');
        }
        if (open === undefined) {
            setInternalIsOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    ref={triggerRef}
                    type="button"
                    title={displayValue}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors hover:border-ring/60 focus-visible:ring-1 focus-visible:ring-ring"
                >
                    <span className={cn('truncate text-left', !value && 'text-muted-foreground')}>{displayValue}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                avoidCollisions={false}
                collisionPadding={16}
                side="bottom"
                sideOffset={8}
                className="z-[240] flex flex-col overflow-hidden rounded-xl border border-border/70 bg-background/98 p-0 shadow-2xl backdrop-blur"
                style={contentStyle}
            >
                <div className="border-b border-border/70 p-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            ref={searchInputRef}
                            value={query}
                            onChange={(event) => handleQueryChange(event.target.value)}
                            onKeyDown={(event) => {
                                if (allowCustomValue && event.key === 'Enter') {
                                    event.preventDefault();
                                    handleCustomValueSubmit();
                                }
                            }}
                            placeholder={searchPlaceholder}
                            className="h-10 border-border/70 bg-background/90 pl-9"
                        />
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                    {filteredGroups.length === 0 ? (
                        <div className="px-3 py-6 text-sm text-muted-foreground">{emptyLabel}</div>
                    ) : (
                        filteredGroups.map((group, groupIndex) => (
                            <div key={`${group.label ?? 'group'}-${groupIndex}`} className="mb-2 last:mb-0">
                                {hasVisibleGroupLabels && group.label && (
                                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                        {group.label}
                                    </div>
                                )}
                                <div className="space-y-1">
                                    {group.options.map((option) => {
                                        const isSelected = option.value === value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => handleSelect(option.value)}
                                                className={cn(
                                                    'flex w-full gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors hover:bg-accent/70',
                                                    wrapOptionLabel ? 'items-start' : 'items-center',
                                                    isSelected && 'bg-accent text-accent-foreground',
                                                )}
                                            >
                                                <Check className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                                                <span
                                                    className={cn(
                                                        'min-w-0',
                                                        wrapOptionLabel
                                                            ? 'whitespace-normal break-all font-mono text-[12px] leading-5'
                                                            : 'truncate',
                                                    )}
                                                    title={option.label}
                                                >
                                                    {option.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export const AiConfigTab: React.FC<AiConfigTabProps> = ({ t }) => {
    const { lang, aiModel, setAiModel } = useAppStore();
    const preferences = useAiPreferences();
    const [providerForm, setProviderForm] = useState<ProviderFormState>(EMPTY_FORM);
    const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
    const [isProviderModelPickerOpen, setIsProviderModelPickerOpen] = useState(false);
    const [providerModels, setProviderModels] = useState<string[]>([]);
    const [isLoadingProviderModels, setIsLoadingProviderModels] = useState(false);
    const [isSavingProvider, setIsSavingProvider] = useState(false);
    const isVi = lang === 'vi';
    const assistantSelection = preferences.assistantModel || aiModel;
    const modelGroups = useMemo(() => getAssistantModelCatalog(preferences.customProviders), [preferences.customProviders]);

    useEffect(() => {
        let active = true;
        apiService
            .get<CustomAiProvider[]>('/ai/providers')
            .then((providers) => {
                if (!active) return;
                const serverProviders = providers.map(toClientProvider);
                updateAiPreferences((current) => ({
                    ...current,
                    customProviders: [...serverProviders, ...current.customProviders.filter((provider) => !provider.serverManaged)],
                }));
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);

    const labels = isVi
        ? {
              aiTitle: t('tabs.ai'),
              aiSubtitle:
                  'Thiết lập model và provider riêng cho từng vai trò AI trong ứng dụng. AI Assistant sẽ cập nhật ngay sau khi bạn đổi model mặc định.',
              customProviders: 'Provider tùy chỉnh',
              customProvidersHint:
                  'Hỗ trợ endpoint OpenAI-compatible kiểu /chat/completions. API key chỉ được giữ trong tab hiện tại và sẽ bị xóa khi tải lại trang.',
              providerName: 'Tên provider',
              providerBaseUrl: 'Base URL',
              providerApiKey: 'API Key',
              providerModel: 'Model mặc định',
              providerType: 'OpenAI-compatible',
              addProvider: 'Thêm provider',
              saveProvider: 'Lưu chỉnh sửa',
              cancelEdit: 'Hủy',
              editProvider: 'Sửa',
              loadModels: 'Tải model',
              modelPlaceholder: 'Chọn hoặc nhập model',
              searchLoadedModels: 'Search models...',
              noLoadedModelMatch: 'Không tìm thấy model phù hợp.',
              assistantRole: 'AI Assistant',
              explainRole: 'Explain',
              sqlRole: 'AI SQL',
              nosqlRole: 'AI NoSQL',
              autocompleteRole: 'Autocomplete',
              roleModelPlaceholder: 'Chọn model',
              searchRoleModels: 'Search models...',
              noRoleModelMatch: 'Không tìm thấy model phù hợp.',
              inheritAssistant: 'Dùng model của Assistant',
              remove: 'Xóa',
              providerAdded: 'Đã thêm provider AI tùy chỉnh.',
              providerUpdated: 'Đã cập nhật provider AI tùy chỉnh.',
              providerRemoved: 'Đã xóa provider AI tùy chỉnh.',
              providerInvalid: 'Điền đủ tên, base URL và model trước khi lưu provider.',
              providerBaseUrlRequired: 'Nhập Base URL trước khi tải danh sách model.',
              providerModelsEmpty: 'Provider không trả về model nào.',
              providerModelsLoaded: (count: number) => `Đã tải ${count} model. Mở dropdown để tìm nhanh hoặc nhập model thủ công.`,
              providerModelsFailed: 'Không thể tải danh sách model từ provider.',
              providerBackendUnavailable: 'Không gọi được backend AI. Hãy đảm bảo server đang chạy rồi thử lại.',
              requiredHint:
                  'Tên, base URL và model là bắt buộc. API key có thể để trống nếu provider local của bạn không cần bearer token.',
          }
        : {
              aiTitle: t('tabs.ai'),
              aiSubtitle:
                  'Choose a dedicated model and provider for each AI role in the app. The AI Assistant updates immediately after you change its default model.',
              customProviders: 'Custom providers',
              customProvidersHint:
                  'Supports OpenAI-compatible /chat/completions endpoints. API keys stay only in the current tab and are cleared on reload.',
              providerName: 'Provider name',
              providerBaseUrl: 'Base URL',
              providerApiKey: 'API key',
              providerModel: 'Default model',
              providerType: 'OpenAI-compatible',
              addProvider: 'Add provider',
              saveProvider: 'Save changes',
              cancelEdit: 'Cancel',
              editProvider: 'Edit',
              loadModels: 'Load models',
              modelPlaceholder: 'Pick or type a model',
              searchLoadedModels: 'Search models...',
              noLoadedModelMatch: 'No models found.',
              assistantRole: 'AI Assistant',
              explainRole: 'Explain',
              sqlRole: 'AI SQL',
              nosqlRole: 'AI NoSQL',
              autocompleteRole: 'Autocomplete',
              roleModelPlaceholder: 'Choose a model',
              searchRoleModels: 'Search models...',
              noRoleModelMatch: 'No models found.',
              inheritAssistant: 'Use Assistant model',
              remove: 'Remove',
              providerAdded: 'Custom AI provider added.',
              providerUpdated: 'Custom AI provider updated.',
              providerRemoved: 'Custom AI provider removed.',
              providerInvalid: 'Fill in the provider name, base URL, and model before saving.',
              providerBaseUrlRequired: 'Enter the Base URL before loading models.',
              providerModelsEmpty: 'The provider returned no models.',
              providerModelsLoaded: (count: number) => `Loaded ${count} models. Open the dropdown to search fast, or type a custom model.`,
              providerModelsFailed: 'Failed to load models from the provider.',
              providerBackendUnavailable: 'Cannot reach the AI backend. Make sure the server is running, then try again.',
              requiredHint:
                  'Provider name, base URL, and model are required. API key may stay empty if your local provider does not require bearer auth.',
          };

    const providerSecurityHint = isVi
        ? 'API key được mã hóa và lưu phía server. Cloud chỉ kết nối tới endpoint HTTPS mà server truy cập được.'
        : 'API keys are encrypted server-side. Cloud deployments require an HTTPS endpoint reachable by the server.';

    const providerModelGroups = useMemo<SearchableGroup[]>(
        () =>
            providerModels.length > 0
                ? [
                      {
                          options: providerModels.map((model) => ({
                              value: model,
                              label: model,
                          })),
                      },
                  ]
                : [],
        [providerModels],
    );

    const baseRoleModelGroups = useMemo<SearchableGroup[]>(
        () =>
            modelGroups.map((group) => ({
                label: group.group,
                options: group.items.map((item) => ({
                    value: item.id,
                    label: item.label,
                })),
            })),
        [modelGroups],
    );

    const getRoleModelGroups = (includeInherit: boolean): SearchableGroup[] =>
        includeInherit
            ? [
                  {
                      options: [
                          {
                              value: INHERIT_ASSISTANT_MODEL,
                              label: labels.inheritAssistant,
                          },
                      ],
                  },
                  ...baseRoleModelGroups,
              ]
            : baseRoleModelGroups;

    const resetProviderForm = () => {
        setProviderForm(EMPTY_FORM);
        setEditingProviderId(null);
        setIsProviderModelPickerOpen(false);
        setProviderModels([]);
    };

    const updateProviderFormField = (key: keyof ProviderFormState, value: string) => {
        if (key === 'baseUrl' || key === 'apiKey') {
            setIsProviderModelPickerOpen(false);
            setProviderModels([]);
        }

        setProviderForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const updateRoleSelection = (
        key: 'assistantModel' | 'explainModel' | 'sqlModel' | 'nosqlModel' | 'autocompleteModel',
        value: string,
    ) => {
        updateAiPreferences((current) => ({
            ...current,
            [key]: value,
        }));

        if (key === 'assistantModel' && !value.startsWith('custom-provider:')) {
            setAiModel(value);
        }
    };

    const handleSaveProvider = async () => {
        const name = providerForm.name.trim();
        const baseUrl = normalizeProviderBaseUrl(providerForm.baseUrl);
        const apiKey = providerForm.apiKey.trim();
        const model = providerForm.model.trim();

        if (!name || !baseUrl || !model) {
            toast.error(labels.providerInvalid);
            return;
        }

        const existing = editingProviderId ? preferences.customProviders.find((provider) => provider.id === editingProviderId) : undefined;
        const payload = {
            name,
            type: 'openai-compatible' as const,
            baseUrl,
            apiKey: apiKey || undefined,
            model,
            models: providerModels.length > 0 ? providerModels : existing?.models || [],
            capabilities: {
                vision: providerForm.vision,
                document: providerForm.document,
            },
        };

        setIsSavingProvider(true);
        try {
            const saved = existing?.serverManaged
                ? await apiService.patch<CustomAiProvider>(`/ai/providers/${existing.id}`, payload)
                : await apiService.post<CustomAiProvider>('/ai/providers', payload);
            const nextProvider = toClientProvider(saved);
            updateAiPreferences((current) => ({
                ...current,
                customProviders: existing
                    ? current.customProviders.map((provider) => (provider.id === existing.id ? nextProvider : provider))
                    : [...current.customProviders, nextProvider],
            }));
            resetProviderForm();
            toast.success(existing ? labels.providerUpdated : labels.providerAdded);
        } catch (error) {
            toast.error(getErrorMessage(error, labels.providerModelsFailed));
        } finally {
            setIsSavingProvider(false);
        }
    };

    const handleLoadProviderModels = async () => {
        const baseUrl = normalizeProviderBaseUrl(providerForm.baseUrl);
        if (!baseUrl) {
            toast.error(labels.providerBaseUrlRequired);
            return;
        }

        setIsLoadingProviderModels(true);
        try {
            const existing = editingProviderId
                ? preferences.customProviders.find((provider) => provider.id === editingProviderId)
                : undefined;
            const response = existing?.serverManaged
                ? await apiService.post<ProviderTestResult>(`/ai/providers/${existing.id}/test`, {})
                : await apiService.post<ProviderTestResult>('/ai/providers/test', {
                      name: providerForm.name.trim() || 'Custom provider',
                      type: 'openai-compatible',
                      baseUrl,
                      apiKey: providerForm.apiKey.trim(),
                      model: providerForm.model.trim(),
                      models: providerModels,
                  });
            const models = Array.isArray(response.models) ? response.models : [];
            setProviderModels(models);
            setIsProviderModelPickerOpen(false);
            setProviderForm((current) => ({
                ...current,
                baseUrl,
                model: current.model || (models.length === 1 ? models[0] : current.model),
            }));

            if (!response.ok) {
                toast.error(response.error || labels.providerModelsFailed);
            } else {
                if (existing?.serverManaged) {
                    updateAiPreferences((current) => ({
                        ...current,
                        customProviders: current.customProviders.map((provider) =>
                            provider.id === existing.id
                                ? {
                                      ...provider,
                                      models,
                                      lastStatus: 'healthy',
                                      lastError: null,
                                      lastLatencyMs: response.latencyMs,
                                      lastTestedAt: new Date().toISOString(),
                                  }
                                : provider,
                        ),
                    }));
                }
                toast.success(isVi ? `Kết nối thành công trong ${response.latencyMs} ms.` : `Connected in ${response.latencyMs} ms.`);
            }
        } catch (error) {
            toast.error(getProviderModelsErrorMessage(error, labels.providerModelsFailed, labels.providerBackendUnavailable));
        } finally {
            setIsLoadingProviderModels(false);
        }
    };

    const handleEditProvider = (provider: CustomAiProvider) => {
        setEditingProviderId(provider.id);
        setIsProviderModelPickerOpen(false);
        setProviderModels(provider.models || []);
        setProviderForm({
            name: provider.name,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model: provider.model,
            vision: Boolean(provider.capabilities?.vision),
            document: Boolean(provider.capabilities?.document),
        });
    };

    const handleRemoveProvider = async (providerId: string) => {
        const provider = preferences.customProviders.find((item) => item.id === providerId);
        const confirmed = window.confirm(isVi ? 'Xóa provider này?' : 'Remove this provider?');
        if (!confirmed) return;

        try {
            if (provider?.serverManaged) {
                await apiService.delete(`/ai/providers/${providerId}`);
            }
            const isRemovedProviderSelection = (selection?: string) => parseCustomProviderModelId(selection) === providerId;
            updateAiPreferences((current) => ({
                ...current,
                customProviders: current.customProviders.filter((provider) => provider.id !== providerId),
                assistantModel: isRemovedProviderSelection(current.assistantModel) ? aiModel : current.assistantModel,
                explainModel: isRemovedProviderSelection(current.explainModel) ? INHERIT_ASSISTANT_MODEL : current.explainModel,
                sqlModel: isRemovedProviderSelection(current.sqlModel) ? INHERIT_ASSISTANT_MODEL : current.sqlModel,
                nosqlModel: isRemovedProviderSelection(current.nosqlModel) ? INHERIT_ASSISTANT_MODEL : current.nosqlModel,
                autocompleteModel: isRemovedProviderSelection(current.autocompleteModel)
                    ? INHERIT_ASSISTANT_MODEL
                    : current.autocompleteModel,
            }));

            if (editingProviderId === providerId) {
                resetProviderForm();
            }

            toast.success(labels.providerRemoved);
        } catch (error) {
            toast.error(getErrorMessage(error, labels.providerModelsFailed));
        }
    };

    const renderModelSelect = (value: string, onChange: (value: string) => void, includeInherit: boolean) => (
        <SearchableModelSelect
            value={value}
            onChange={onChange}
            groups={getRoleModelGroups(includeInherit)}
            minContentWidth={360}
            placeholder={labels.roleModelPlaceholder}
            searchPlaceholder={labels.searchRoleModels}
            emptyLabel={labels.noRoleModelMatch}
        />
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h3 className="text-lg font-medium">{labels.aiTitle}</h3>
                <p className="text-sm text-muted-foreground">{labels.aiSubtitle}</p>
            </div>
            <div className="h-px w-full bg-border/50" />

            <div className="space-y-5 rounded-2xl border border-border/60 bg-card/40 p-5">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <Bot className="h-4 w-4 text-violet-400" />
                            {labels.assistantRole}
                        </label>
                        {renderModelSelect(assistantSelection, (nextValue) => updateRoleSelection('assistantModel', nextValue), false)}
                    </div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <FileSearch className="h-4 w-4 text-blue-400" />
                            {labels.explainRole}
                        </label>
                        {renderModelSelect(preferences.explainModel, (nextValue) => updateRoleSelection('explainModel', nextValue), true)}
                    </div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <Database className="h-4 w-4 text-emerald-400" />
                            {labels.sqlRole}
                        </label>
                        {renderModelSelect(preferences.sqlModel, (nextValue) => updateRoleSelection('sqlModel', nextValue), true)}
                    </div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <Boxes className="h-4 w-4 text-amber-400" />
                            {labels.nosqlRole}
                        </label>
                        {renderModelSelect(preferences.nosqlModel, (nextValue) => updateRoleSelection('nosqlModel', nextValue), true)}
                    </div>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <Search className="h-4 w-4 text-cyan-400" />
                            {labels.autocompleteRole}
                        </label>
                        {renderModelSelect(
                            preferences.autocompleteModel,
                            (nextValue) => updateRoleSelection('autocompleteModel', nextValue),
                            true,
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-5">
                <div>
                    <h3 className="text-lg font-medium">{labels.customProviders}</h3>
                    <p className="text-sm text-muted-foreground">{providerSecurityHint}</p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{labels.providerName}</label>
                        <Input
                            value={providerForm.name}
                            onChange={(event) => updateProviderFormField('name', event.target.value)}
                            placeholder="My Provider"
                        />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="text-sm font-medium">{labels.providerModel}</label>
                            {providerModels.length > 0 && (
                                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                                    {providerModels.length} models
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {isVi
                                ? 'Tải danh sách model rồi chọn nhanh, hoặc nhập model thủ công nếu bạn đã biết tên.'
                                : 'Load the model list to pick quickly, or type a model manually if you already know it.'}
                        </p>
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
                            <div className="min-w-0 flex-1">
                                <SearchableModelSelect
                                    allowCustomValue
                                    value={providerForm.model}
                                    onChange={(nextValue) => updateProviderFormField('model', nextValue)}
                                    open={isProviderModelPickerOpen}
                                    onOpenChange={setIsProviderModelPickerOpen}
                                    groups={providerModelGroups}
                                    minContentWidth={560}
                                    placeholder={labels.modelPlaceholder}
                                    searchPlaceholder={labels.searchLoadedModels}
                                    emptyLabel={labels.noLoadedModelMatch}
                                    wrapOptionLabel
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 lg:h-10 lg:min-w-32 lg:px-4"
                                onClick={handleLoadProviderModels}
                                disabled={isLoadingProviderModels}
                            >
                                {isLoadingProviderModels ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                {isVi ? 'Kiểm tra kết nối' : 'Test connection'}
                            </Button>
                        </div>
                        {providerModels.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {isVi
                                    ? `Đã tải ${providerModels.length} model. Bấm vào ô model để mở danh sách.`
                                    : `Loaded ${providerModels.length} models. Click the model field to open the list.`}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-sm font-medium">{labels.providerBaseUrl}</label>
                        <Input
                            value={providerForm.baseUrl}
                            onChange={(event) => updateProviderFormField('baseUrl', event.target.value)}
                            placeholder="https://your-provider.example.com/v1"
                        />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-sm font-medium">{labels.providerApiKey}</label>
                        <Input
                            type="password"
                            value={providerForm.apiKey}
                            onChange={(event) => updateProviderFormField('apiKey', event.target.value)}
                            placeholder={
                                editingProviderId &&
                                preferences.customProviders.find((provider) => provider.id === editingProviderId)?.apiKeyConfigured
                                    ? '•••••••• (configured)'
                                    : 'sk-...'
                            }
                        />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                        <p className="text-sm font-medium">{isVi ? 'Khả năng input đã kiểm chứng' : 'Verified input capabilities'}</p>
                        <div className="flex flex-wrap gap-4 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={providerForm.vision}
                                    onChange={(event) =>
                                        setProviderForm((current) => ({
                                            ...current,
                                            vision: event.target.checked,
                                        }))
                                    }
                                />
                                {isVi ? 'Đọc ảnh native' : 'Native vision'}
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={providerForm.document}
                                    onChange={(event) =>
                                        setProviderForm((current) => ({
                                            ...current,
                                            document: event.target.checked,
                                        }))
                                    }
                                />
                                {isVi ? 'Đọc PDF/file native' : 'Native PDF/file input'}
                            </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {isVi
                                ? 'Chỉ bật khi model và endpoint thực sự hỗ trợ. Hệ thống sẽ không âm thầm đổi sang provider khác.'
                                : 'Enable only when the model and endpoint support it. The app will not silently switch providers.'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/60 px-4 py-3">
                    <div>
                        <p className="text-sm font-medium">{labels.providerType}</p>
                        <p className="text-xs text-muted-foreground">
                            {isVi
                                ? 'Để trống API key khi sửa để giữ key hiện tại. Localhost chỉ dùng trong môi trường self-host/dev.'
                                : 'Leave the API key blank while editing to keep the current key. Localhost is available only in self-hosted/dev environments.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                        {editingProviderId && (
                            <Button type="button" variant="ghost" className="gap-2" onClick={resetProviderForm}>
                                <X className="h-4 w-4" />
                                {labels.cancelEdit}
                            </Button>
                        )}
                        <Button type="button" onClick={handleSaveProvider} className="gap-2" disabled={isSavingProvider}>
                            {isSavingProvider ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : editingProviderId ? (
                                <Pencil className="h-4 w-4" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            {editingProviderId ? labels.saveProvider : labels.addProvider}
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    {preferences.customProviders.length === 0 ? (
                        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                            {providerSecurityHint}
                        </div>
                    ) : (
                        preferences.customProviders.map((provider) => (
                            <div
                                key={provider.id}
                                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 lg:flex-row lg:items-center lg:justify-between"
                            >
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">{provider.name}</span>
                                        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">
                                            {labels.providerType}
                                        </span>
                                        {provider.lastStatus && (
                                            <span
                                                className={cn(
                                                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                                                    provider.lastStatus === 'healthy'
                                                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                                                        : 'border-red-500/25 bg-red-500/10 text-red-300',
                                                )}
                                            >
                                                {provider.lastStatus === 'healthy'
                                                    ? isVi
                                                        ? 'Đã kiểm tra'
                                                        : 'Healthy'
                                                    : isVi
                                                      ? 'Lỗi kết nối'
                                                      : 'Failed'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="break-all text-xs text-muted-foreground">{provider.baseUrl}</p>
                                    <p className="text-xs text-muted-foreground">{provider.model}</p>
                                    {provider.lastLatencyMs != null && (
                                        <p className="text-xs text-muted-foreground">{provider.lastLatencyMs} ms</p>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => handleEditProvider(provider)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                        {labels.editProvider}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 text-red-400 hover:text-red-300"
                                        onClick={() => handleRemoveProvider(provider.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        {labels.remove}
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
