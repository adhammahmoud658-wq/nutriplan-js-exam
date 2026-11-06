function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export function renderRecipeCard(meal, { category, area, excerpt, image }) {
  return `
    <article class="recipe-result-card" data-meal-id="${escapeHTML(meal.idMeal)}">
      <div class="recipe-result-image-wrap">
        <img class="recipe-result-image" src="${escapeHTML(image)}" alt="${escapeHTML(meal.strMeal)}" loading="lazy" />
        <div class="recipe-image-badges">
          ${category ? `<span class="recipe-badge"><i class="fa-solid fa-tag recipe-category-icon" aria-hidden="true"></i>${escapeHTML(category)}</span>` : ""}
          ${area ? `<span class="recipe-badge"><i class="fa-solid fa-globe recipe-area-icon" aria-hidden="true"></i>${escapeHTML(area)}</span>` : ""}
        </div>
      </div>
      <div class="recipe-result-content">
        <h3 class="recipe-result-title">${escapeHTML(meal.strMeal)}</h3>
        <p class="recipe-result-description">${escapeHTML(excerpt)}</p>
        <div class="recipe-result-meta">
          ${category ? `<span class="recipe-meta-category"><i class="fa-solid fa-utensils" aria-hidden="true"></i>${escapeHTML(category)}</span>` : ""}
          ${area ? `<span class="recipe-meta-area"><i class="fa-solid fa-globe" aria-hidden="true"></i>${escapeHTML(area)}</span>` : ""}
        </div>
      </div>
    </article>`;
}

export function renderMealCategoryCard(name, icon, theme) {
  return `<button type="button" class="meal-category-card category-${escapeHTML(theme)}" data-category="${escapeHTML(name)}">
    <span class="category-icon"><i class="fa-solid ${escapeHTML(icon)}" aria-hidden="true"></i></span>
    <span class="category-label">${escapeHTML(name)}</span>
  </button>`;
}
