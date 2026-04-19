/**
 * Generate variations of a username based on OSINT strategies
 */
export const generateUsernameVariations = (username: string): string[] => {
    const variations = new Set<string>();
    const cleaned = username.trim();
    
    // a) Direct Match
    variations.add(cleaned);
    
    // b) Case Variations
    variations.add(cleaned.toLowerCase());
    variations.add(cleaned.toUpperCase());
    variations.add(cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()); // Capitalize
    
    // c) Delimiter Variations & d) Separator Combinations
    // If username has spaces or common delimiters
    const parts = cleaned.split(/[\s._-]/);
    if (parts.length > 1) {
        const p = parts.filter(part => part.length > 0);
        variations.add(p.join(''));      // johndoe
        variations.add(p.join('_'));     // john_doe
        variations.add(p.join('.'));     // john.doe
        variations.add(p.join('-'));     // john-doe
    }
    
    // e) Numeric Suffixes (Limited to avoid too many requests)
    const currentYear = new Date().getFullYear();
    variations.add(`${cleaned}${currentYear}`);
    variations.add(`${cleaned}123`);
    
    // f) Common Misspellings / Character swaps
    // Swap l with 1, o with 0
    if (cleaned.includes('l') || cleaned.includes('o') || cleaned.includes('i')) {
        let swapped = cleaned.toLowerCase()
            .replace(/l/g, '1')
            .replace(/o/g, '0')
            .replace(/i/g, '1');
        variations.add(swapped);
    }

    return Array.from(variations).slice(0, 15); // Cap to 15 variations to prevent throttling
};
