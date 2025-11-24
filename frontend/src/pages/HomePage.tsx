import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getCategories, getFlashcardsForCategory, getCategoryMetadata } from "../data/flashcards";
import AppHeader from "../components/AppHeader";

const HomePage: React.FC = () => {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ReturnType<typeof getCategories>>([]);

  // Load categories on mount
  useEffect(() => {
    try {
      const loadedCategories = getCategories();
      setCategories(loadedCategories);
      console.log('[HomePage Debug] Categories found:', loadedCategories.length);
      if (loadedCategories.length > 0) {
        loadedCategories.forEach(cat => {
          console.log(`[HomePage Debug] - ${cat.id}: ${cat.label}`);
        });
      } else {
        console.warn('[HomePage Debug] No categories found!');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[HomePage Error] Failed to load categories:', err);
      setError(`Failed to load categories: ${errorMessage}`);
    }
  }, [])

  // Get card count for a category
  const getCardCount = (categoryId: string): number => {
    try {
      return getFlashcardsForCategory(categoryId).length;
    } catch (err) {
      console.error(`[HomePage Error] Failed to get card count for ${categoryId}:`, err);
      return 0;
    }
  };

  // Handle image load errors
  const handleImageError = (categoryId: string) => {
    setImageErrors(prev => ({ ...prev, [categoryId]: true }));
  };

  // If there's an error, show error message
  if (error) {
    return (
      <div className="home-page">
        <AppHeader />
        <main className="home-main" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1>Error Loading Home Page</h1>
            <p style={{ color: 'var(--color-error, #dc2626)', marginBottom: '1rem' }}>{error}</p>
            <button 
              className="btn btn-primary" 
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="home-page">
      <AppHeader />

      {/* Hero Section */}
      <section className="home-hero">
        <h1 className="home-hero-title">Motion-Based German Learning</h1>
        <p className="home-hero-subtitle">
          Use your body gestures to navigate flashcards and learn German interactively.
        </p>
        <p className="home-hero-note">
          You can also use keyboard arrows (← →) and Space if your camera is off.
        </p>
      </section>

      {/* Categories Grid */}
      <main className="home-main">
        {categories.length === 0 ? (
          <div className="home-empty">
            <p>No categories found. Please check your data.</p>
          </div>
        ) : (
          <div className="categories-grid">
            {categories.map((cat) => {
              const cardCount = getCardCount(cat.id);
              const meta = getCategoryMetadata(cat.id);
              const imageFailed = imageErrors[cat.id];
              const showImage = !!(meta.imageUrl && !imageFailed);
              const showEmoji = !showImage && !!meta.iconEmoji;
              
              return (
                <Link
                  key={cat.id}
                  to={`/lesson/${cat.id}`}
                  className="category-card card card-lift"
                >
                  <div className="category-card-content">
                    <div className="category-card-header">
                      {showImage ? (
                        <img 
                          key={`category-image-${cat.id}`}
                          src={meta.imageUrl} 
                          alt={meta.title}
                          className="category-card-icon-image"
                          onError={() => handleImageError(cat.id)}
                        />
                      ) : showEmoji ? (
                        <span className="category-card-icon">{meta.iconEmoji}</span>
                      ) : (
                        <span className="category-card-icon">📚</span>
                      )}
                      <h2 className="category-card-title">{meta.title}</h2>
                    </div>
                    <p className="category-card-description">
                      {meta.description}
                    </p>
                    <div className="category-card-footer">
                      <span className="category-card-count">
                        {cardCount} {cardCount === 1 ? "card" : "cards"}
                      </span>
                      <button className="btn btn-primary" type="button">
                        Start lesson →
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;
