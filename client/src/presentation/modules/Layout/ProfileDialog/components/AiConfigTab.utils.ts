export type SearchableOption = {
    value: string;
    label: string;
};

export type SearchableGroup = {
    label?: string;
    options: SearchableOption[];
};

export const filterSearchableGroups = (groups: SearchableGroup[], query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return groups;
    }

    return groups
        .map((group) => ({
            ...group,
            options: group.options.filter((option) => (
                option.label.toLowerCase().includes(normalizedQuery)
                || option.value.toLowerCase().includes(normalizedQuery)
            )),
        }))
        .filter((group) => group.options.length > 0);
};
