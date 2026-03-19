export class UserUtils {
    /**
     * Parses a full name into first and last name.
     */
    static parseName(fullName: string): { firstName: string; lastName: string } {
        if (!fullName) return { firstName: 'User', lastName: '' };
        
        const parts = fullName.trim().split(/\s+/);
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ') || '';
        
        return { firstName, lastName };
    }

    /**
     * Formats a display name from first and last name parts.
     */
    static getDisplayName(firstName?: string | null, lastName?: string | null, email?: string | null): string {
        const name = [firstName, lastName].filter(Boolean).join(' ');
        return name || email || 'User';
    }
}
