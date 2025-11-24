import rawData from "./german_flashcards.json";

export interface Flashcard {
  category: string;
  german: string;
  english: string | null;
  example_de?: string | null;
  example_en?: string | null;
  image_url: string;
  image_local: string;
}

const flashcards: Flashcard[] = rawData as Flashcard[];

export interface Category {
  id: string;    // slug (e.g. "german-action-verbs-flashcards")
  label: string; // original category name
}

export interface CategoryMetadata {
  title: string;        // Human-readable name
  description: string;  // 1-2 line summary
  imageUrl?: string;    // Path to category image/icon (optional)
  iconEmoji?: string;   // Emoji icon fallback (optional)
  level?: string;       // Optional: Beginner, Intermediate, etc.
  tag?: string;         // Optional: Everyday, Seasonal, etc.
}

/**
 * Slugifies a string by converting to lowercase, replacing spaces with hyphens,
 * and removing special characters.
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-')  // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

/**
 * Category metadata mapping by slugified category ID.
 * Contains unique descriptions and images for each category.
 */
const categoryMeta: Record<string, CategoryMetadata> = {
  'german-action-verbs-flashcards': {
    title: 'Action Verbs',
    description: 'Learn German action verbs through interactive gesture control. Master verbs for sports, daily activities, and movement.',
    imageUrl: '/images/categories/action_verbs.png',
    iconEmoji: '🏃',
    level: 'Beginner',
    tag: 'Everyday',
  },
  'german-animals-flashcards': {
    title: 'Animals',
    description: 'Discover German words for animals from pets to farm and wild animals. Perfect for animal lovers and nature enthusiasts.',
    imageUrl: '/images/categories/animals.png',
    iconEmoji: '🐶',
    level: 'Beginner',
    tag: 'Everyday',
  },
  'german-feelings-flashcards': {
    title: 'Feelings',
    description: 'Express yourself in German! Learn words for emotions, moods, and feelings. Essential vocabulary for daily conversations.',
    imageUrl: '/images/categories/feelings.png',
    iconEmoji: '😊',
    level: 'Beginner',
    tag: 'Everyday',
  },
  'german-food-drinks-flashcards': {
    title: 'Food & Drinks',
    description: 'Master German food and beverage vocabulary through motion-based learning. Essential words for restaurants, cooking, and dining.',
    imageUrl: '/images/categories/food_drinks.png',
    iconEmoji: '🍽️',
    level: 'Beginner',
    tag: 'Food',
  },
  'german-parts-of-the-body-flashcards': {
    title: 'Parts of the Body',
    description: 'Learn common German words for body parts like arm, leg, head, and more. Essential vocabulary for describing people.',
    imageUrl: '/images/categories/parts_of_body.png',
    iconEmoji: '🧍',
    level: 'Beginner',
    tag: 'Everyday',
  },
  'german-fruit-flashcards': {
    title: 'Fruits',
    description: 'Practice German names for everyday fruits you see in the supermarket. Build your food vocabulary with colorful vocabulary.',
    imageUrl: '/images/categories/fruits.png',
    iconEmoji: '🍎',
    level: 'Beginner',
    tag: 'Food',
  },
  'german-fall-autumn-flashcards': {
    title: 'Fall / Autumn',
    description: 'Learn German vocabulary for the autumn season: weather, clothes, and nature. Embrace the colors of fall.',
    imageUrl: '/images/categories/fall_autumn.png',
    iconEmoji: '🍁',
    level: 'Beginner',
    tag: 'Seasonal',
  },
  'german-vegetables-flashcards': {
    title: 'Vegetables',
    description: 'Expand your food vocabulary with essential German vegetable words. From leafy greens to root vegetables.',
    imageUrl: '/images/categories/vegetables.png',
    iconEmoji: '🥕',
    level: 'Beginner',
    tag: 'Food',
  },
  'german-farm-animals-flashcards': {
    title: 'Farm Animals',
    description: 'Learn German words for farm animals like cows, pigs, chickens, and more. Perfect for countryside vocabulary.',
    imageUrl: '/images/categories/farm_animals.png',
    iconEmoji: '🐄',
    level: 'Beginner',
    tag: 'Everyday',
  },
  'german-summer-flashcards': {
    title: 'Summer',
    description: 'Seasonal words and phrases related to summer, holidays, and sunny weather. Perfect for summer vacation vocabulary.',
    imageUrl: '/images/categories/summer.png',
    iconEmoji: '🌞',
    level: 'Beginner',
    tag: 'Seasonal',
  },
};

/**
 * Default category metadata for fallback when a category is not in the metadata map.
 */
const DEFAULT_CATEGORY_META: CategoryMetadata = {
  title: 'German Vocabulary',
  description: 'Practice German vocabulary through interactive flashcard lessons.',
  imageUrl: '/images/categories/default.png',
  iconEmoji: '📚',
  level: 'Beginner',
};

/**
 * Get all unique categories from the flashcards.
 * @returns Array of Category objects with slugified IDs and original labels
 */
export function getCategories(): Category[] {
  const categorySet = new Set<string>();
  
  flashcards.forEach(flashcard => {
    if (flashcard.category) {
      categorySet.add(flashcard.category);
    }
  });

  return Array.from(categorySet).map(category => ({
    id: slugify(category),
    label: category,
  }));
}

/**
 * Get all flashcards for a specific category by its slug ID.
 * @param categoryId - The slugified category ID
 * @returns Array of flashcards matching the category
 */
export function getFlashcardsForCategory(categoryId: string): Flashcard[] {
  const categories = getCategories();
  const category = categories.find(cat => cat.id === categoryId);
  
  if (!category) {
    return [];
  }

  return flashcards.filter(flashcard => flashcard.category === category.label);
}

/**
 * Get metadata for a category by its slugified ID.
 * @param categoryId - The slugified category ID
 * @returns CategoryMetadata object, or default metadata if not found
 */
export function getCategoryMetadata(categoryId: string): CategoryMetadata {
  return categoryMeta[categoryId] || {
    ...DEFAULT_CATEGORY_META,
    title: categoryId.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' '),
  };
}

/**
 * Get metadata for a category by its original label.
 * @param categoryLabel - The original category label
 * @returns CategoryMetadata object, or default metadata if not found
 */
export function getCategoryMetadataByLabel(categoryLabel: string): CategoryMetadata {
  const categoryId = slugify(categoryLabel);
  return getCategoryMetadata(categoryId);
}

export { flashcards, categoryMeta };

