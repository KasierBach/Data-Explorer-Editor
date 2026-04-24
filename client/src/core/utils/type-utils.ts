export function getField<T extends object, K extends keyof T>(obj: T, key: K): T[K] {
    return obj[key];
}

export function hasField<T extends object>(obj: T, key: keyof T): boolean {
    return key in obj;
}