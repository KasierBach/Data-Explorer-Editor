export function getField<T, K extends keyof T>(obj: T, key: K): T[K] {
    return obj[key];
}

export function hasField<T>(obj: T, key: keyof T): boolean {
    return key in obj;
}