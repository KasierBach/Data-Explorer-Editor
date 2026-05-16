/**
 * Utility to flatten nested objects into a single-level object with dot-notation keys.
 * Useful for displaying NoSQL (MongoDB) documents in a tabular grid.
 */

/**
 * Flattens a single document.
 * Example: { user: { name: 'John' } } -> { 'user.name': 'John' }
 */
export function flattenDocument(obj: unknown, prefix = '', depth = 0, maxDepth = 5): Record<string, unknown> {
    const flattened: Record<string, unknown> = {};

    if (depth >= maxDepth || obj === null || typeof obj !== 'object') {
        return { [prefix]: obj };
    }

    // Handle MongoDB-specific types if they come as objects (like ObjectId, Date)
    // In many drivers, these might already be strings or Date objects.
    if (obj instanceof Date) {
        return { [prefix]: obj.toISOString() };
    }

    const record = obj as Record<string, unknown>;
    for (const key in record) {
        if (!Object.prototype.hasOwnProperty.call(record, key)) continue;

        const newKey = prefix ? `${prefix}.${key}` : key;
        const value = record[key];

        if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            // Recursive call for nested objects
            Object.assign(flattened, flattenDocument(value, newKey, depth + 1, maxDepth));
        } else if (Array.isArray(value)) {
            // Stringify arrays to keep them in one cell
            flattened[newKey] = JSON.stringify(value);
        } else {
            // Primitive values
            flattened[newKey] = value;
        }
    }

    return flattened;
}

/**
 * Flattens an array of documents and extracts all unique keys as columns.
 */
export function flattenDocuments(docs: unknown[]): { columns: string[], rows: Record<string, unknown>[] } {
    if (!docs || !Array.isArray(docs) || docs.length === 0) {
        return { columns: [], rows: [] };
    }

    const rows = docs.map(doc => flattenDocument(doc));
    
    // Extract all unique keys across all documents to form columns
    const columnSet = new Set<string>();
    rows.forEach(row => {
        Object.keys(row).forEach(key => columnSet.add(key));
    });

    // Sort columns: _id first, then others alphabetically
    const columns = Array.from(columnSet).sort((a, b) => {
        if (a === '_id') return -1;
        if (b === '_id') return 1;
        return a.localeCompare(b);
    });

    return { columns, rows };
}
