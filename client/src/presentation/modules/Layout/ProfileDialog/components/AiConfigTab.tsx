import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Bot,
    Boxes,
    Check,
    ChevronsUpDown,
    CircleAlert,
    Database,
    FileSearch,
    FileText,
    ImageIcon,
    Loader2,
    Pencil,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react';
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
import { Switch } from '@/presentation/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/presentation/components/ui/tooltip';
import { getAssistantModelCatalog, BUILT_IN_PROVIDERS } from '@/presentation/modules/Query/assistantModelCatalog';
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

const FieldHint = ({ label, text }: { label: string; text: string }) => (
    <TooltipProvider delayDuration={180}>
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={label}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <CircleAlert className="h-3.5 w-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-64 text-pretty leading-5">
                {text}
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

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
    const modelGroups = useMemo(() => getAssistantModelCatalog(preferences.customProviders, preferences.disabledProviders), [preferences.customProviders, preferences.disabledProviders]);

    useEffect(() => {
        let active = true;
        apiService
            .get<CustomAiProvider[]>('/ai/providers')
            .then((providers) => {
                if (!active) return;
                updateAiPreferences((current) => {
                    const serverProviders = providers.map((p) => {
                        const clientProvider = toClientProvider(p);
                        const existingLocal = current.customProviders.find((item) => item.id === p.id);
                        return {
                            ...clientProvider,
                            enabled: existingLocal ? existingLocal.enabled : true,
                        };
                    });
                    return {
                        ...current,
                        customProviders: [...serverProviders, ...current.customProviders.filter((provider) => !provider.serverManaged)],
                    };
                });
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
              providerName: 'Tên provider',
              providerBaseUrl: 'Base URL',
              providerApiKey: 'API Key',
              providerModel: 'Model mặc định',
              providerType: 'OpenAI-compatible',
              addProvider: 'Lưu provider',
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
              providerEnabled: 'Đang hoạt động',
              providerDisabled: 'Tạm tắt',
          }
        : {
              aiTitle: t('tabs.ai'),
              aiSubtitle:
                  'Choose a dedicated model and provider for each AI role in the app. The AI Assistant updates immediately after you change its default model.',
              customProviders: 'Custom providers',
              providerName: 'Provider name',
              providerBaseUrl: 'Base URL',
              providerApiKey: 'API key',
              providerModel: 'Default model',
              providerType: 'OpenAI-compatible',
              addProvider: 'Save provider',
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
              providerEnabled: 'Active',
              providerDisabled: 'Disabled',
          };

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

    const handleToggleProviderEnabled = (providerId: string, enabled: boolean) => {
        updateAiPreferences((current) => ({
            ...current,
            customProviders: current.customProviders.map((provider) =>
                provider.id === providerId ? { ...provider, enabled } : provider,
            ),
        }));
        toast.success(
            enabled
                ? (isVi ? 'Đã bật provider AI.' : 'Provider enabled.')
                : (isVi ? 'Đã tắt provider AI.' : 'Provider disabled.')
        );
    };

    const handleToggleBuiltInProvider = (providerId: string, enabled: boolean) => {
        updateAiPreferences((current) => {
            const currentDisabled = current.disabledProviders || [];
            const nextDisabled = enabled
                ? currentDisabled.filter((id) => id !== providerId)
                : Array.from(new Set([...currentDisabled, providerId]));
            return {
                ...current,
                disabledProviders: nextDisabled,
            };
        });
        toast.success(
            enabled
                ? (isVi ? 'Đã bật provider AI.' : 'Provider enabled.')
                : (isVi ? 'Đã tắt provider AI.' : 'Provider disabled.')
        );
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

    const handleToggleMasterEnabled = (enabled: boolean) => {
        updateAiPreferences((current) => ({
            ...current,
            enabled,
        }));
        toast.success(
            enabled
                ? (isVi ? 'Đã bật hệ thống AI.' : 'AI features enabled.')
                : (isVi ? 'Đã tắt hệ thống AI.' : 'AI features disabled.')
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h3 className="text-lg font-medium">{labels.aiTitle}</h3>
                <p className="text-sm text-muted-foreground">{labels.aiSubtitle}</p>
            </div>
            <div className="h-px w-full bg-border/50" />

            {/* Master AI Enable/Disable Switch Card */}
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-gradient-to-r from-violet-500/10 via-card/50 to-blue-500/10 p-5">
                <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-violet-400" />
                        <h4 className="font-semibold text-base">
                            {isVi ? 'Trạng thái hệ thống AI' : 'AI System Status'}
                        </h4>
                        <span className={cn(
                            "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                            preferences.enabled !== false
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-muted text-muted-foreground border-border"
                        )}>
                            {preferences.enabled !== false
                                ? (isVi ? 'ĐANG BẬT' : 'ENABLED')
                                : (isVi ? 'ĐÃ TẮT' : 'DISABLED')}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {isVi
                            ? 'Bật hoặc tắt toàn bộ các tính năng AI trong ứng dụng (Assistant, Explain SQL, Auto-complete...)'
                            : 'Enable or disable all AI features in the app (Assistant, Explain SQL, Auto-complete...)'}
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Switch
                        checked={preferences.enabled !== false}
                        onCheckedChange={handleToggleMasterEnabled}
                        className="scale-125"
                        label={isVi ? 'Bật/Tắt AI' : 'Toggle AI'}
                    />
                </div>
            </div>

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

            {/* Built-in AI Providers Section */}
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
                <div className="flex items-start justify-between gap-4 border-b border-border/50 px-5 py-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold tracking-tight">
                            {isVi ? 'Nhà cung cấp AI mặc định' : 'Built-in AI Providers'}
                        </h3>
                        <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
                            {isVi
                                ? 'Bật hoặc tắt từng nhà cung cấp AI hệ thống (Gemini, Beeknoee, Groq, OpenRouter). Khi tắt, các model của provider đó sẽ tự động ẩn khỏi menu chọn model.'
                                : 'Enable or disable built-in AI providers (Gemini, Beeknoee, Groq, OpenRouter). Disabled provider models are hidden from selection menus.'}
                        </p>
                    </div>
                </div>

                <div className="p-5 space-y-3">
                    {BUILT_IN_PROVIDERS.map((provider) => {
                        const isDisabled = (preferences.disabledProviders || []).includes(provider.id);
                        const isEnabled = !isDisabled;
                        return (
                            <div
                                key={provider.id}
                                className={cn(
                                    "flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 transition-all hover:border-border sm:flex-row sm:items-center sm:justify-between",
                                    isDisabled && "opacity-60 grayscale-[30%]"
                                )}
                            >
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("font-semibold text-foreground", isDisabled && "text-muted-foreground")}>
                                            {provider.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">· Built-in</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {provider.description}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <Switch
                                        checked={isEnabled}
                                        onCheckedChange={(checked) => handleToggleBuiltInProvider(provider.id, checked)}
                                        label={`${isVi ? 'Bật/Tắt' : 'Toggle'} ${provider.name}`}
                                    />
                                    <span className={cn(
                                        'text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider select-none',
                                        isEnabled
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-muted text-muted-foreground border border-transparent'
                                    )}>
                                        {isEnabled ? labels.providerEnabled : labels.providerDisabled}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
                <div className="flex items-start justify-between gap-4 border-b border-border/50 px-5 py-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold tracking-tight">{labels.customProviders}</h3>
                        <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
                            {isVi
                                ? 'Kết nối endpoint OpenAI-compatible và chọn model riêng cho từng vai trò AI.'
                                : 'Connect an OpenAI-compatible endpoint and assign its models to each AI role.'}
                        </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {preferences.customProviders.length} {isVi ? 'đã lưu' : 'saved'}
                    </span>
                </div>

                <div className="grid gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-2">
                    <div className="order-1 space-y-1.5">
                        <label className="text-sm font-medium">{labels.providerName}</label>
                        <Input
                            value={providerForm.name}
                            onChange={(event) => updateProviderFormField('name', event.target.value)}
                            placeholder="My Provider"
                        />
                    </div>
                    <div className="order-4 space-y-1.5 sm:col-span-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                                <label className="text-sm font-medium">{labels.providerModel}</label>
                                <FieldHint
                                    label={`${labels.providerModel}: ${isVi ? 'hướng dẫn' : 'help'}`}
                                    text={
                                        isVi
                                            ? 'Chọn từ catalog của provider hoặc nhập chính xác model ID.'
                                            : 'Choose from the provider catalog or enter an exact model ID.'
                                    }
                                />
                            </div>
                            {providerModels.length > 0 && (
                                <span className="text-[11px] font-medium tabular-nums text-emerald-400">
                                    {providerModels.length} models
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                                className="h-10 shrink-0 gap-2 px-4 transition-colors active:translate-y-px"
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
                    <div className="order-2 space-y-1.5">
                        <div className="flex items-center gap-1">
                            <label className="text-sm font-medium">{labels.providerBaseUrl}</label>
                            <FieldHint
                                label={`${labels.providerBaseUrl}: ${isVi ? 'hướng dẫn' : 'help'}`}
                                text={
                                    isVi
                                        ? 'Bản cloud yêu cầu HTTPS và server phải truy cập được URL này.'
                                        : 'Cloud requires HTTPS and a URL reachable by the server.'
                                }
                            />
                        </div>
                        <Input
                            value={providerForm.baseUrl}
                            onChange={(event) => updateProviderFormField('baseUrl', event.target.value)}
                            placeholder="https://your-provider.example.com/v1"
                        />
                    </div>
                    <div className="order-3 space-y-1.5 sm:col-span-2">
                        <div className="flex items-center gap-1">
                            <label className="text-sm font-medium">{labels.providerApiKey}</label>
                            <FieldHint
                                label={`${labels.providerApiKey}: ${isVi ? 'hướng dẫn' : 'help'}`}
                                text={
                                    isVi
                                        ? 'Được mã hóa trên server. Để trống khi sửa để giữ key hiện tại.'
                                        : 'Encrypted on the server. Leave blank while editing to keep the current key.'
                                }
                            />
                        </div>
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
                    <div className="order-5 space-y-1.5 sm:col-span-2">
                        <div className="flex items-center gap-1">
                            <p className="text-sm font-medium">{isVi ? 'Khả năng của model' : 'Model capabilities'}</p>
                            <FieldHint
                                label={`${isVi ? 'Khả năng của model' : 'Model capabilities'}: ${isVi ? 'hướng dẫn' : 'help'}`}
                                text={
                                    isVi
                                        ? 'Chỉ bật khi endpoint thực sự hỗ trợ. Hệ thống không tự chuyển sang provider khác.'
                                        : 'Enable only when the endpoint truly supports it. The system will not silently switch providers.'
                                }
                            />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <label
                                className={cn(
                                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-ring/60',
                                    providerForm.vision
                                        ? 'border-violet-500/40 bg-violet-500/10'
                                        : 'border-border/60 bg-background/50 hover:border-border hover:bg-muted/25',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={providerForm.vision}
                                    onChange={(event) =>
                                        setProviderForm((current) => ({
                                            ...current,
                                            vision: event.target.checked,
                                        }))
                                    }
                                />
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                                    <ImageIcon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium">{isVi ? 'Hình ảnh' : 'Images'}</span>
                                    <span className="block text-xs text-muted-foreground">
                                        {isVi ? 'Ảnh đính kèm trong prompt' : 'Image attachments in prompts'}
                                    </span>
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                                        providerForm.vision ? 'border-violet-400 bg-violet-500 text-white' : 'border-border bg-background',
                                    )}
                                >
                                    {providerForm.vision && <Check className="h-3.5 w-3.5" />}
                                </span>
                            </label>
                            <label
                                className={cn(
                                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-ring/60',
                                    providerForm.document
                                        ? 'border-violet-500/40 bg-violet-500/10'
                                        : 'border-border/60 bg-background/50 hover:border-border hover:bg-muted/25',
                                )}
                            >
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={providerForm.document}
                                    onChange={(event) =>
                                        setProviderForm((current) => ({
                                            ...current,
                                            document: event.target.checked,
                                        }))
                                    }
                                />
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium">{isVi ? 'PDF / tài liệu' : 'PDF / documents'}</span>
                                    <span className="block text-xs text-muted-foreground">
                                        {isVi ? 'File được gửi native tới model' : 'Files sent natively to the model'}
                                    </span>
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                                        providerForm.document
                                            ? 'border-violet-400 bg-violet-500 text-white'
                                            : 'border-border bg-background',
                                    )}
                                >
                                    {providerForm.document && <Check className="h-3.5 w-3.5" />}
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-border/50 bg-muted/15 px-5 py-3">
                    {editingProviderId && (
                        <Button type="button" variant="ghost" className="gap-2 active:translate-y-px" onClick={resetProviderForm}>
                            <X className="h-4 w-4" />
                            {labels.cancelEdit}
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={handleSaveProvider}
                        className="min-w-36 justify-center gap-2 px-5 transition-transform active:translate-y-px"
                        disabled={isSavingProvider}
                    >
                        {isSavingProvider ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {editingProviderId ? labels.saveProvider : labels.addProvider}
                    </Button>
                </div>

                {preferences.customProviders.length > 0 && (
                    <div className="space-y-3 border-t border-border/50 p-5">
                        {preferences.customProviders.map((provider) => (
                            <div
                                key={provider.id}
                                className={cn(
                                    "flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4 transition-all hover:border-border sm:flex-row sm:items-center sm:justify-between",
                                    provider.enabled === false && "opacity-60 grayscale-[30%]"
                                )}
                            >
                                <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className={cn("font-semibold text-foreground", provider.enabled === false && "text-muted-foreground")}>
                                            {provider.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">· {labels.providerType}</span>
                                        {provider.enabled !== false && provider.lastStatus && (
                                            <span
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 text-xs font-medium',
                                                    provider.lastStatus === 'healthy' ? 'text-emerald-400' : 'text-red-400',
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'h-1.5 w-1.5 rounded-full',
                                                        provider.lastStatus === 'healthy' ? 'bg-emerald-400' : 'bg-red-400',
                                                    )}
                                                />
                                                {provider.lastStatus === 'healthy'
                                                    ? isVi
                                                        ? 'Kết nối tốt'
                                                        : 'Healthy'
                                                    : isVi
                                                      ? 'Lỗi kết nối'
                                                      : 'Failed'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span className="font-mono text-foreground/80">{provider.model}</span>
                                        <span className="break-all">{provider.baseUrl}</span>
                                        {provider.enabled !== false && provider.lastLatencyMs != null && (
                                            <span className="tabular-nums">{provider.lastLatencyMs} ms</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 border-r border-border/50 pr-3 mr-1">
                                        <Switch
                                            checked={provider.enabled !== false}
                                            onCheckedChange={(checked) => handleToggleProviderEnabled(provider.id, checked)}
                                            label={isVi ? 'Bật/Tắt provider' : 'Toggle provider'}
                                        />
                                        <span className={cn(
                                            'text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider select-none',
                                            provider.enabled !== false
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-muted text-muted-foreground border border-transparent'
                                        )}>
                                            {provider.enabled !== false ? labels.providerEnabled : labels.providerDisabled}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
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
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};
