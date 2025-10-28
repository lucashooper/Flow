// @ts-ignore - no types available for typo-js
import Typo from 'typo-js';

let dictionary: any = null;

// Initialize the spell checker
export async function initSpellChecker() {
  if (dictionary) return dictionary;
  
  try {
    // Load dictionary files from public folder
    const [affData, dicData] = await Promise.all([
      fetch('/dictionaries/en_US.aff').then(r => r.text()),
      fetch('/dictionaries/en_US.dic').then(r => r.text())
    ]);
    
    dictionary = new Typo('en_US', affData, dicData);
    console.log('✅ Spell checker initialized');
    return dictionary;
  } catch (error) {
    console.error('Failed to load spell checker:', error);
    return null;
  }
}

// Check if a word is spelled correctly
export function isWordCorrect(word: string): boolean {
  if (!dictionary || !word) return true;
  
  // Remove punctuation and check
  const cleanWord = word.replace(/[.,!?;:'"]/g, '');
  if (!cleanWord) return true;
  
  return dictionary.check(cleanWord);
}

// Get spelling suggestions for a misspelled word
export function getSpellingSuggestions(word: string): string[] {
  if (!dictionary || !word) return [];
  
  // Remove punctuation
  const cleanWord = word.replace(/[.,!?;:'"]/g, '');
  if (!cleanWord) return [];
  
  // Get suggestions
  const suggestions = dictionary.suggest(cleanWord);
  return suggestions ? suggestions.slice(0, 5) : []; // Top 5 suggestions
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
