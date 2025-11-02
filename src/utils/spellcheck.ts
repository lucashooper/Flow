// @ts-ignore - no types available for typo-js
import Typo from 'typo-js';

let dictionary: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

// Cache for spell check results to avoid repeated checks
const spellCheckCache = new Map<string, boolean>();
const suggestionCache = new Map<string, string[]>();

// Initialize the spell checker
export async function initSpellChecker() {
  if (dictionary) return dictionary;
  if (isLoading && loadPromise) return loadPromise;
  
  isLoading = true;
  loadPromise = (async () => {
    try {
      console.log('📚 Loading spell checker dictionary...');
      // Load dictionary files from public folder
      const [affData, dicData] = await Promise.all([
        fetch('/dictionaries/en_US.aff').then(r => r.text()),
        fetch('/dictionaries/en_US.dic').then(r => r.text())
      ]);
      
      dictionary = new Typo('en_US', affData, dicData);
      console.log('✅ Spell checker initialized and ready!');
      isLoading = false;
      return dictionary;
    } catch (error) {
      console.error('Failed to load spell checker:', error);
      isLoading = false;
      return null;
    }
  })();
  
  return loadPromise;
}

// Check if a word is spelled correctly
export function isWordCorrect(word: string): boolean {
  if (!dictionary || !word) return true;
  
  // Remove punctuation and check
  const cleanWord = word.replace(/[.,!?;:'"]/g, '');
  if (!cleanWord) return true;
  
  // Check cache first
  const cacheKey = cleanWord.toLowerCase();
  if (spellCheckCache.has(cacheKey)) {
    return spellCheckCache.get(cacheKey)!;
  }
  
  // Check both original case and lowercase
  // This handles proper nouns and capitalized words better
  const isCorrect = dictionary.check(cleanWord) || dictionary.check(cleanWord.toLowerCase());
  
  // Cache the result
  spellCheckCache.set(cacheKey, isCorrect);
  
  return isCorrect;
}

// Get spelling suggestions for a misspelled word (synchronous, uses cache)
export function getSpellingSuggestions(word: string): string[] {
  if (!dictionary || !word) return [];
  
  // Remove punctuation
  const cleanWord = word.replace(/[.,!?;:'"]/g, '');
  if (!cleanWord) return [];
  
  // Check cache first - instant return
  const cacheKey = cleanWord.toLowerCase();
  if (suggestionCache.has(cacheKey)) {
    return suggestionCache.get(cacheKey)!;
  }
  
  // Get suggestions - try both original and lowercase
  let suggestions = dictionary.suggest(cleanWord);
  
  // If no suggestions with original case, try lowercase
  if (!suggestions || suggestions.length === 0) {
    suggestions = dictionary.suggest(cleanWord.toLowerCase());
  }
  
  // Preserve original capitalization if word was capitalized
  if (cleanWord[0] === cleanWord[0].toUpperCase() && suggestions && suggestions.length > 0) {
    suggestions = suggestions.map((s: string) => 
      s.charAt(0).toUpperCase() + s.slice(1)
    );
  }
  
  const result = suggestions ? suggestions.slice(0, 5) : []; // Top 5 suggestions
  
  // Cache the result
  suggestionCache.set(cacheKey, result);
  
  return result;
}

// Get spelling suggestions asynchronously (non-blocking)
export async function getSpellingSuggestionsAsync(word: string): Promise<string[]> {
  return new Promise((resolve) => {
    // Use setTimeout to make it non-blocking
    setTimeout(() => {
      try {
        const suggestions = getSpellingSuggestions(word);
        resolve(suggestions);
      } catch (error) {
        console.error('Error getting suggestions:', error);
        resolve([]);
      }
    }, 0);
  });
}

// Get word at cursor position
export function getWordAtCursor(text: string, cursorPos: number): { word: string; start: number; end: number } | null {
  if (!text) return null;
  
  // Find word boundaries
  let start = cursorPos;
  let end = cursorPos;
  
  // Move start backwards to find word start
  while (start > 0 && /\w/.test(text[start - 1])) {
    start--;
  }
  
  // Move end forwards to find word end
  while (end < text.length && /\w/.test(text[end])) {
    end++;
  }
  
  const word = text.substring(start, end);
  
  if (!word) return null;
  
  return { word, start, end };
}
