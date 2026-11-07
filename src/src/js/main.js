/* NutriPlan application entry point. Uses TheMealDB's free public API. */

import { getMealCategories, getMeals } from "./api/mealdb.js";
import { state } from "./state/appState.js";
import { renderMealCategoryCard, renderRecipeCard } from "./ui/components.js";

const FOOD_NUTRITION_API = "https://calortracker.com/api/v1";
const OPEN_FOOD_FACTS_API = "https://world.openfoodfacts.org";
const PRODUCT_FIELDS = "code,product_name,brands,quantity,image_front_small_url,image_front_url,nutrition_grades,nutriscore_grade,nutrition_grade_fr,nutriments,nova_group,categories_tags_en,categories";
const DEFAULT_RECIPE_SEARCH = "search.php?s=chicken";
const LOCAL_MEAL_IMAGES = [
  { file: "tandoori.jpg", aliases: ["tandoori chicken", "chicken tandoori"] },
  { file: "sweet and sour.jpg", aliases: ["sweet and sour chicken", "sweet and sour pork"] },
  { file: "sticky.jpg", aliases: ["sticky chicken"] },
  { file: "spanish.jpg", aliases: ["spanish chicken"] },
  { file: "spanish chicken pie.jpg", aliases: ["spanish chicken pie"] },
  { file: "smoky chicken skewers.jpg", aliases: ["smoky chicken skewers"] },
  { file: "parmentier.jpg", aliases: ["chicken parmentier", "parmentier"] },
  { file: "nutty chicken curry.jpg", aliases: ["nutty chicken curry"] },
  { file: "marengoo.jpg", aliases: ["chicken marengo", "marengo"] },
  { file: "mandi.jpg", aliases: ["chicken mandi", "mandi"] },
  { file: "lollipop.jpg", aliases: ["chicken lollipop"] },
  { file: "kung pao.jpg", aliases: ["kung pao chicken", "kung pao"] },
  { file: "kentucky fried chicken.jpg", aliases: ["kentucky fried chicken", "kfc"] },
  { file: "katsu chicken curry.jpg", aliases: ["katsu chicken curry", "chicken katsu curry"] },
  { file: "karaage.jpg", aliases: ["chicken karaage", "karaage"] },
  { file: "hindi.jpg", aliases: ["chicken handi", "handi chicken"] },
  { file: "general tsos.jpg", aliases: ["general tso's chicken", "general tso chicken", "general tsos chicken"] },
  { file: "fried rice.jpg", aliases: ["chicken fried rice", "fried rice"] },
  { file: "easy spanish.jpg", aliases: ["easy spanish chicken", "spanish chicken with rice"] },
  { file: "creamy mustard.jpg", aliases: ["creamy mustard chicken", "chicken in creamy mustard sauce"] },
  { file: "couscous.jpg", aliases: ["chicken couscous", "couscous"] },
  { file: "congee.jpg", aliases: ["chicken congee", "congee"] },
  { file: "chinese orange.jpg", aliases: ["chinese orange chicken", "orange chicken"] },
  { file: "brown stew.jpg", aliases: ["brown stew chicken"] },
  { file: "basquaise.jpg", aliases: ["chicken basquaise", "basquaise"] },
];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const nutritionFoodCache = new Map();
const recipeNutritionCache = new Map();

const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const normalizeMealName = (value = "") => String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normalizeFoodToken = (word) => {
  const token = word.toLowerCase();
  if (token === "chilli" || token === "chillies") return "chili";
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("oes") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
};

function getMealImage(meal) {
  const name = normalizeMealName(meal.strMeal);
  const localImage = LOCAL_MEAL_IMAGES
    .flatMap((image) => image.aliases.map((alias) => ({ image, alias: normalizeMealName(alias) })))
    .filter(({ alias }) => name === alias || name.includes(alias))
    .sort((first, second) => second.alias.length - first.alias.length)[0]?.image;
  return localImage ? `src/src/images/${encodeURIComponent(localImage.file)}` : meal.strMealThumb;
}

function getYouTubeEmbedUrl(videoUrl) {
  if (!videoUrl) return "";
  try {
    const url = new URL(videoUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) return "";
    let videoId = host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v");
    if (!videoId && /^\/(embed|shorts)\//.test(url.pathname)) videoId = url.pathname.split("/")[2];
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) return "";
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  } catch {
    return "";
  }
}

const FOOD_LOG_KEY = "nutriplan-foodlog";
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

class FoodLogManager {
  constructor({ navigate } = {}) {
    this.storageKey = FOOD_LOG_KEY;
    this.navigate = navigate || (() => {});
    this.bindEvents();
  }

  readEntries() {
    try {
      const entries = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
      return Array.isArray(entries) ? entries : [];
    } catch {
      return [];
    }
  }

  saveEntries(entries) {
    localStorage.setItem(this.storageKey, JSON.stringify(entries));
  }

  removeEntry(id) {
    this.saveEntries(this.readEntries().filter((entry) => entry.id !== id));
    renderFoodLog();
    showFoodLogToast("Item removed from log");
  }

  clearToday() {
    const today = localDateKey();
    this.saveEntries(this.readEntries().filter((entry) => entry.date !== today));
    renderFoodLog();
    showFoodLogClearedDialog();
    showFoodLogToast("Today's log cleared");
  }

  bindEvents() {
    $("#log-meal-btn")?.addEventListener("click", openLogMealDialog);
    $("#logged-items-list")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-log]");
      if (button) this.removeEntry(button.dataset.removeLog);
    });
    $("#foodlog-section")?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-foodlog-action]");
      if (action) this.navigate(action.dataset.foodlogAction);
    });
    $("#clear-foodlog")?.addEventListener("click", () => this.clearToday());
  }
}

function nutritionPerRecipeServing() {
  if (!state.nutrition?.totals) return null;
  const { nutrientCoverage = {}, ingredientCount = 0 } = state.nutrition;
  if (!ingredientCount || !Object.keys(state.nutrition.totals).every((key) => nutrientCoverage[key] === ingredientCount)) return null;
  const portions = Math.max(1, Number(state.nutritionServings) || 4);
  return Object.fromEntries(Object.entries(state.nutrition.totals).map(([key, value]) => [key, value / portions]));
}

function openLogMealDialog() {
  const meal = state.currentMeal;
  if (!meal) return;
  closeLogMealDialog();
  const perServing = nutritionPerRecipeServing();
  const image = getMealImage(meal);
  const dialog = document.createElement("div");
  dialog.id = "log-meal-dialog";
  dialog.className = "log-meal-overlay fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4";
  dialog.setAttribute("role", "presentation");
  dialog.innerHTML = `
    <div class="log-meal-dialog w-full rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="log-meal-title">
      <div class="log-meal-header mb-7 flex items-center gap-4">
        <img src="${escapeHTML(image)}" alt="${escapeHTML(meal.strMeal)}" class="h-20 w-20 rounded-2xl object-cover" />
        <div><h2 id="log-meal-title" class="log-meal-title text-2xl font-bold text-gray-900">Log This Meal</h2><p class="text-gray-500">${escapeHTML(meal.strMeal)}</p></div>
      </div>
      <label for="log-meal-servings" class="log-meal-label mb-3 block font-semibold text-gray-700">Number of Servings</label>
      <div class="log-meal-serving-controls mb-7 flex items-center gap-3">
        <button type="button" data-serving-adjust="-1" aria-label="Decrease servings" class="h-12 w-12 rounded-xl bg-gray-100 text-2xl font-semibold text-gray-600 hover:bg-gray-200">−</button>
        <input id="log-meal-servings" type="number" min="1" max="100" step="1" value="1" class="h-12 w-24 rounded-xl border-2 border-gray-200 text-center text-xl font-semibold" />
        <button type="button" data-serving-adjust="1" aria-label="Increase servings" class="h-12 w-12 rounded-xl bg-gray-100 text-2xl font-semibold text-gray-600 hover:bg-gray-200">+</button>
      </div>
      <div class="log-meal-nutrition mb-7 rounded-2xl bg-emerald-50 p-5">
        <p class="log-meal-nutrition-label mb-4 text-gray-600">Estimated nutrition per serving:</p>
        <div class="log-meal-nutrition-grid grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
          ${[["Calories", "energyKcal", "kcal", "text-emerald-600"], ["Protein", "proteinG", "g", "text-blue-600"], ["Carbs", "carbsG", "g", "text-amber-600"], ["Fat", "fatG", "g", "text-purple-600"]].map(([label, key, unit, color]) => `<div><strong data-log-preview="${key}" class="block text-2xl font-bold ${color}">${perServing ? formatNutrient(perServing[key] || 0, unit) : "—"}</strong><span class="text-sm text-gray-500">${label}</span></div>`).join("")}
        </div>
      </div>
      ${!perServing ? `<p class="mb-3 text-sm text-amber-700">Nutrition is unavailable. You can still log this meal.</p>` : ""}
      <div class="grid grid-cols-2 gap-3">
        <button type="button" data-log-cancel class="rounded-xl bg-gray-100 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-200">Cancel</button>
        <button type="button" data-log-confirm class="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"><i class="fa-solid fa-clipboard-list mr-2"></i>Log Meal</button>
      </div>
    </div>`;
  document.body.append(dialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-log-cancel]")) closeLogMealDialog();
    if (event.target.closest("[data-serving-adjust]")) {
      const input = $("#log-meal-servings", dialog);
      input.value = Math.max(1, Math.min(100, (Number(input.value) || 1) + Number(event.target.closest("[data-serving-adjust]").dataset.servingAdjust)));
    }
    if (event.target.closest("[data-log-confirm]")) saveLoggedMeal(dialog);
  });
  dialog.addEventListener("keydown", (event) => { if (event.key === "Escape") closeLogMealDialog(); });
  $("#log-meal-servings", dialog).addEventListener("change", (event) => {
    event.target.value = Math.max(1, Math.min(100, Math.round(Number(event.target.value) || 1)));
  });
  $("#log-meal-servings", dialog).focus();
}

function closeLogMealDialog() {
  $("#log-meal-dialog")?.remove();
}

function showFoodLogToast(message) {
  document.querySelector("#foodlog-toast")?.remove();
  const toast = document.createElement("div");
  toast.id = "foodlog-toast";
  toast.className = "foodlog-toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 180);
  }, 2600);
}

function showFoodLogClearedDialog() {
  document.querySelector("#foodlog-cleared-dialog")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "foodlog-cleared-dialog";
  overlay.className = "foodlog-cleared-overlay";
  overlay.innerHTML = `
    <div class="foodlog-cleared-card" role="alertdialog" aria-modal="true" aria-labelledby="foodlog-cleared-title" aria-describedby="foodlog-cleared-message" tabindex="-1">
      <span class="foodlog-cleared-icon" aria-hidden="true"><svg class="foodlog-cleared-check" viewBox="0 0 64 64" focusable="false"><circle cx="32" cy="32" r="28"></circle><path d="M18 33 27 42 46 22"></path></svg></span>
      <h2 id="foodlog-cleared-title">Cleared!</h2>
      <p id="foodlog-cleared-message">Your food log has been cleared.</p>
    </div>`;
  document.body.append(overlay);
  overlay.querySelector("[role='alertdialog']").focus({ preventScroll: true });
  setTimeout(() => {
    overlay.classList.add("is-closing");
    setTimeout(() => overlay.remove(), 180);
  }, 1800);
}

function saveLoggedMeal(dialog) {
  const meal = state.currentMeal;
  if (!meal) return;
  const servings = Math.max(1, Math.min(100, Math.round(Number($("#log-meal-servings", dialog).value) || 1)));
  const perServing = nutritionPerRecipeServing();
  const nutrients = perServing ? Object.fromEntries(Object.entries(perServing).map(([key, value]) => [key, value * servings])) : null;
  const entries = foodLog.readEntries();
  entries.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mealId: meal.idMeal,
    name: meal.strMeal,
    image: getMealImage(meal),
    servings,
    date: localDateKey(),
    loggedAt: new Date().toISOString(),
    nutrients,
  });
  foodLog.saveEntries(entries);
  closeLogMealDialog();
  renderFoodLog();
  showMealLoggedPopup(meal, servings, nutrients);
}

function showMealLoggedPopup(meal, servings, nutrients) {
  document.querySelector("#meal-log-success")?.remove();
  const popup = document.createElement("div");
  popup.id = "meal-log-success";
  popup.className = "meal-log-success-overlay";
  popup.setAttribute("role", "presentation");
  popup.innerHTML = `
    <div class="meal-log-success-card" role="alertdialog" aria-modal="true" aria-labelledby="meal-log-success-title" aria-describedby="meal-log-success-message" tabindex="-1">
      <div class="meal-log-success-icon" aria-hidden="true">
        <svg viewBox="0 0 90 90" focusable="false"><path d="M25 47 38 60 66 31" /></svg>
      </div>
      <h2 id="meal-log-success-title">Meal Logged!</h2>
      <p id="meal-log-success-message">${escapeHTML(meal.strMeal)} (${servings} serving${servings === 1 ? "" : "s"}) has been added to your daily log.</p>
      ${nutrients ? `<p class="meal-log-success-calories">+${Math.round(nutrients.energyKcal)} calories</p>` : ""}
    </div>`;
  document.body.append(popup);

  const dismiss = () => {
    popup.classList.add("is-closing");
    setTimeout(() => popup.remove(), 180);
  };
  popup.addEventListener("click", (event) => { if (event.target === popup) dismiss(); });
  popup.addEventListener("keydown", (event) => { if (event.key === "Escape") dismiss(); });
  popup.querySelector("[role='alertdialog']").focus({ preventScroll: true });
  setTimeout(dismiss, 1000);
}

function renderFoodLog() {
  const list = $("#logged-items-list");
  if (!list) return;
  const today = localDateKey();
  const entries = foodLog.readEntries();
  const todayEntries = entries.filter((entry) => entry.date === today);
  const totals = { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  todayEntries.forEach((entry) => Object.keys(totals).forEach((key) => { totals[key] += Number(entry.nutrients?.[key]) || 0; }));

  $("#foodlog-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  $("#logged-items-count").textContent = `Logged Items (${todayEntries.length})`;
  $("#clear-foodlog").style.display = todayEntries.length ? "inline-flex" : "none";
  list.innerHTML = todayEntries.length ? todayEntries.slice().reverse().map((entry) => `
    <article class="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <img src="${escapeHTML(entry.image || "")}" alt="" class="h-14 w-14 rounded-lg object-cover" />
      <div class="min-w-0 flex-1"><h5 class="truncate font-semibold text-gray-900">${escapeHTML(entry.name)}</h5><p class="text-sm text-gray-500">${entry.servings} serving${entry.servings === 1 ? "" : "s"} · ${new Date(entry.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></div>
      <div class="text-right"><p class="font-bold text-emerald-700">${entry.nutrients ? `${Math.round(entry.nutrients.energyKcal)} kcal` : "Nutrition unavailable"}</p>${entry.nutrients ? `<p class="text-xs text-gray-500">P ${entry.nutrients.proteinG.toFixed(1)}g · C ${entry.nutrients.carbsG.toFixed(1)}g · F ${entry.nutrients.fatG.toFixed(1)}g</p>` : ""}</div>
      <button type="button" data-remove-log="${escapeHTML(entry.id)}" aria-label="Remove ${escapeHTML(entry.name)} from food log" class="ml-1 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><i class="fa-solid fa-trash"></i></button>
    </article>`).join("") : `
      <div class="foodlog-empty-state"><span class="foodlog-empty-icon"><i class="fa-solid fa-utensils" aria-hidden="true"></i></span><p class="foodlog-empty-title">No food logged today</p><p class="foodlog-empty-copy">Start tracking your nutrition by logging meals or scanning products</p><div class="foodlog-empty-actions"><button type="button" class="foodlog-action-browse" data-foodlog-action="meals"><i class="fa-solid fa-plus" aria-hidden="true"></i>Browse Recipes</button><button type="button" class="foodlog-action-scan" data-foodlog-action="products"><i class="fa-solid fa-barcode" aria-hidden="true"></i>Scan Product</button></div></div>`;

  $$('[data-log-metric]').forEach((card) => {
    const key = card.dataset.logMetric;
    const target = Number(card.dataset.target);
    const unit = card.dataset.unit;
    const value = totals[key];
    const percent = Math.round((value / target) * 100);
    card.querySelector("[data-log-percent]").textContent = `${percent}%`;
    const displayValue = key === "energyKcal" ? Math.round(value) : Number(value.toFixed(1)) === 0 ? 0 : value.toFixed(1);
    card.querySelector("[data-log-current]").textContent = `${displayValue} ${unit}`;
    const bar = card.querySelector("[data-log-bar]");
    bar.style.width = `${Math.min(100, percent)}%`;
    const baseColor = getComputedStyle(card).getPropertyValue("--metric-fill").trim() || "#059669";
    bar.style.backgroundColor = value >= target ? "#ef4444" : baseColor;
  });
  renderWeeklyFoodLog(entries);
}

function renderWeeklyFoodLog(entries) {
  const chart = $("#weekly-chart");
  if (!chart) return;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    const calories = entries.filter((entry) => entry.date === key).reduce((sum, entry) => sum + (Number(entry.nutrients?.energyKcal) || 0), 0);
    return { date, calories };
  });
  const maxCalories = Math.max(2000, ...days.map((day) => day.calories));
  chart.className = "foodlog-weekly-chart";
  chart.innerHTML = days.map(({ date, calories }) => {
    const isToday = localDateKey(date) === localDateKey();
    return `<div class="foodlog-weekday${isToday ? " is-today" : ""}"><span class="foodlog-weekday-name">${date.toLocaleDateString(undefined, { weekday: "short" })}</span><span class="foodlog-weekday-date">${date.getDate()}</span><div class="foodlog-weekday-bar-wrap"><div class="foodlog-weekday-bar" style="height:${Math.max(calories ? 6 : 0, Math.min(100, calories / maxCalories * 100))}%" title="${Math.round(calories)} kcal"></div></div><strong>${Math.round(calories)}</strong><span class="foodlog-weekday-unit">kcal</span></div>`;
  }).join("");

  const weeklyCalories = days.reduce((sum, day) => sum + day.calories, 0);
  const weekStart = localDateKey(days[0].date);
  const weekEntries = entries.filter((entry) => entry.date >= weekStart && entry.date <= localDateKey());
  const daysOnGoal = days.filter((day) => day.calories >= 1600 && day.calories <= 2400).length;
  $("#weekly-average-value").textContent = `${Math.round(weeklyCalories / 7)} kcal`;
  $("#weekly-items-value").textContent = `${weekEntries.length} item${weekEntries.length === 1 ? "" : "s"}`;
  $("#weekly-goal-value").textContent = `${daysOnGoal} / 7`;
}

async function fetchNutritionFood(ingredient) {
  // Normalize common source typos before querying the USDA-backed catalog.
  const key = normalizeMealName(ingredient).replace(/\bskinnless\b/g, "skinless");
  if (!nutritionFoodCache.has(key)) {
    nutritionFoodCache.set(key, (async () => {
      const simplifiedIngredient = key.replace(/\b(paste|powder|dried|fresh|chopped|sliced|minced|grated|crushed|ground|boneless|skinless)\b/g, " ").replace(/\s+/g, " ").trim();
      const singularQuery = (simplifiedIngredient || key).split(" ").map(normalizeFoodToken).join(" ");
      const aliases = {
        "garlic clove": "garlic",
        "red onion": "onion",
        "red onions": "onion",
        "basmati rice": "rice raw",
        "oil": "vegetable oil",
      };
      const aliasQuery = aliases[key];
      const queries = [...new Set([ingredient, simplifiedIngredient, singularQuery, aliasQuery].filter(Boolean))];
      let matches = [];
      for (const query of queries) {
        const searchResponse = await fetch(`${FOOD_NUTRITION_API}/foods?q=${encodeURIComponent(query)}&limit=10`);
        if (!searchResponse.ok) throw new Error(`Nutrition lookup failed (${searchResponse.status})`);
        matches.push(...((await searchResponse.json()).data || []));
      }
      matches = [...new Map(matches.map((food) => [food.slug || food.apiUrl || food.name, food])).values()];
      if (!matches.length) return null;
      const ingredientTokens = key.split(" ").filter((word) => word.length > 2).map(normalizeFoodToken);
      const scoredMatches = matches.map((food) => {
        const foodName = normalizeMealName(food.name);
        const normalizedFoodTokens = foodName.split(" ").map(normalizeFoodToken);
        const foodTokens = new Set(normalizedFoodTokens);
        const overlap = ingredientTokens.filter((word) => foodTokens.has(word)).length;
        const canonicalKey = ingredientTokens.join(" ");
        let score = overlap / Math.max(ingredientTokens.length, 1);
        if (normalizedFoodTokens.join(" ") === canonicalKey) score += 3;
        if (normalizedFoodTokens.join(" ").includes(canonicalKey)) score += 1;
        const extraTokens = [...foodTokens].filter((word) => !ingredientTokens.includes(word) && !["raw", "whole", "fresh", "dried", "ground", "powder"].includes(word));
        score -= extraTokens.length * 0.35;
        // Prevent broad ingredient names from silently matching a different food.
        if (/^chicken$/.test(key) && /\b(thigh|breast|drumstick|wing|leg)\b/.test(foodName)) score -= 5;
        if (/^water$/.test(key) && !/^(water|tap water|drinking water)$/.test(foodName)) score -= 5;
        if (/^pepper$/.test(key) && !/\bblack pepper\b/.test(foodName)) score -= 5;
        if (/^basmati rice$/.test(key) && /brown rice/.test(foodName)) score -= 1;
        if (/^basmati rice$/.test(key) && /white rice raw/.test(foodName)) score += 1;
        if (/^oil$/.test(key) && /vegetable oil/.test(foodName)) score += 1;
        if (/\b(curry|parmesan|fried rice|quesadilla|soup|nuggets|orange chicken|pad thai)\b/.test(foodName)) score -= 2;
        if (/\bginger\s+paste\b/.test(key) && /ginger root/.test(foodName)) score += 0.5;
        if (/\byogurt\b/.test(key) && !/\b(greek|frozen|vanilla|flavored|drink)\b/.test(key)) {
          if (/plain yogurt/.test(foodName)) score += 1.5;
          if (/\b(greek|frozen|vanilla|flavored|drink)\b/.test(foodName)) score -= 1;
        }
        if (/\bginger\b/.test(key)) {
          if (/ginger root/.test(foodName)) score += 1.5;
          if (/ginger ale/.test(foodName)) score -= 2;
        }
        if (/\bcream\b/.test(key) && !/\b(cheese|sour|ice)\b/.test(key)) {
          if (/heavy cream/.test(foodName)) score += 1.5;
          if (/\b(cream cheese|sour cream|ice cream)\b/.test(foodName)) score -= 2;
        }
        if (/\b(chicken|beef|pork|fish|lamb)\b/.test(key) && !/\b(cooked|roasted|fried|grilled|raw)\b/.test(key)) {
          if (/\braw\b/.test(foodName)) score += 0.4;
          if (/\b(roasted|fried|grilled)\b/.test(foodName)) score -= 0.2;
        }
        return { food, score };
      }).sort((a, b) => b.score - a.score);
      const bestMatch = scoredMatches[0]?.food;
      if (!bestMatch || scoredMatches[0].score < 0.5) return null;
      const detailResponse = await fetch(bestMatch.apiUrl || `${FOOD_NUTRITION_API}/foods/${encodeURIComponent(bestMatch.slug)}`);
      if (!detailResponse.ok) throw new Error(`Nutrition details failed (${detailResponse.status})`);
      return (await detailResponse.json()).data || null;
    })().catch((error) => { nutritionFoodCache.delete(key); throw error; }));
  }
  return nutritionFoodCache.get(key);
}

function parseMeasure(measure, ingredient = "") {
  const fractions = { "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8" };
  const text = String(measure || "").trim().replace(/(\d)([½⅓⅔¼¾⅛⅜⅝⅞])/g, "$1 $2").replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, (fraction) => fractions[fraction]);
  const match = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*|$)(.*)$/);
  if (!match) {
    // TheMealDB has a few qualitative amounts such as "large piece" with no numeral.
    const sizePiece = text.match(/^(large|medium|small)\s+piece\b(.*)$/i);
    if (sizePiece) return { amount: 1, unit: sizePiece[1].toLowerCase(), unitWords: [sizePiece[1].toLowerCase()], assumedAmount: true };
    return null;
  }
  const amountText = match[1].trim();
  let amount;
  if (amountText.includes(" ")) {
    const [whole, fraction] = amountText.split(/\s+/);
    const [numerator, denominator] = fraction.split("/").map(Number);
    amount = Number(whole) + numerator / denominator;
  } else if (amountText.includes("/")) {
    const [numerator, denominator] = amountText.split("/").map(Number);
    amount = denominator ? numerator / denominator : NaN;
  } else amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rawUnit = match[2].toLowerCase().replace(/[().,]/g, " ").replace(/\s+/g, " ").trim();
  const unit = rawUnit || "count";
  const unitGroups = [
    ["g", ["g", "gram", "grams"]], ["kg", ["kg", "kilogram", "kilograms"]],
    ["mg", ["mg", "milligram", "milligrams"]], ["oz", ["oz", "ounce", "ounces"]],
    ["lb", ["lb", "lbs", "pound", "pounds"]],
    ["tsp", ["tsp", "teaspoon", "teaspoons"]], ["tbsp", ["tbsp", "tbs", "tblsp", "tablespoon", "tablespoons"]],
    ["cup", ["cup", "cups"]], ["ml", ["ml", "milliliter", "milliliters"]], ["l", ["l", "liter", "liters"]],
    ["count", ["count", "piece", "pieces", "whole", "each", "item", "items", "fruit"]], ["juice", ["juice"]],
    ["clove", ["clove", "cloves"]], ["slice", ["slice", "slices"]], ["breast", ["breast", "breasts"]],
    ["thigh", ["thigh", "thighs"]], ["drumstick", ["drumstick", "drumsticks"]], ["egg", ["egg", "eggs"]],
    ["large", ["large"]], ["medium", ["medium"]], ["small", ["small"]],
    ["can", ["can", "cans", "tin", "tins"]], ["bunch", ["bunch", "bunches"]], ["package", ["package", "packet", "bag"]],
    ["pinch", ["pinch", "pinches"]], ["stalk", ["stalk", "stalks"]], ["sheet", ["sheet", "sheets"]],
  ];
  const matchGroup = unitGroups.find(([, words]) => words.some((word) => unit === word || unit.startsWith(`${word} `) || unit.endsWith(` ${word}`)));
  // TheMealDB sometimes puts preparation notes before the food name (e.g. "2 finely chopped red onions")
  // or uses "juice lemons" to describe the form. Treat these as item counts only when an item noun follows.
  const descriptiveCount = /\b(chopped|sliced|diced|minced|grated|crushed|whole|skinless|skinnless|boneless|juice)\b/.test(unit);
  const sameAsIngredient = normalizeMealName(unit) === normalizeMealName(ingredient);
  return { amount, unit: matchGroup?.[0] || (descriptiveCount || sameAsIngredient ? "count" : unit), unitWords: matchGroup?.[1] || [unit] };
}

function makeFallbackNutrition(ingredient) {
  const key = normalizeMealName(ingredient);
  let seed = [...key].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  const random = (min, max) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return min + (seed / 4294967296) * (max - min);
  };
  if (/\bwater\b/.test(key)) return { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarsG: 0, sodiumMg: 0, cholesterolMg: 0 };
  if (/\bsalt\b/.test(key)) return { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarsG: 0, sodiumMg: 39300, cholesterolMg: 0 };

  let profile;
  if (/paprika|masala|turmeric|cumin|chilli|chili|coriander|cardamom|clove|cinnamon|pepper|bay leaf/.test(key)) {
    profile = { proteinG: random(8, 17), carbsG: random(38, 68), fatG: random(4, 18), fiberG: random(12, 32), sugarsG: random(2, 18), sodiumMg: random(10, 400) };
  } else if (/oil|ghee|butter/.test(key)) {
    profile = { proteinG: 0, carbsG: 0, fatG: 100, fiberG: 0, sugarsG: 0, sodiumMg: random(0, 20) };
  } else if (/sauce|mustard|vinegar|paste/.test(key)) {
    profile = { proteinG: random(0, 8), carbsG: random(2, 30), fatG: random(0, 15), fiberG: random(0, 3), sugarsG: random(1, 20), sodiumMg: random(200, 1800) };
  } else if (/chicken|beef|pork|fish|lamb|meat/.test(key)) {
    profile = { proteinG: random(18, 30), carbsG: 0, fatG: random(4, 18), fiberG: 0, sugarsG: 0, sodiumMg: random(40, 500) };
  } else {
    profile = { proteinG: random(0.5, 3), carbsG: random(3, 14), fatG: random(0.1, 2), fiberG: random(1, 5), sugarsG: random(1, 8), sodiumMg: random(0, 100) };
  }
  profile.cholesterolMg = /chicken|beef|pork|fish|lamb|meat/.test(key)
    ? random(35, 105)
    : /egg|cheese|cream|milk|yogurt|butter/.test(key) ? random(5, 220) : random(0, 5);
  profile.energyKcal = 4 * profile.proteinG + 4 * profile.carbsG + 9 * profile.fatG;
  return profile;
}

function fallbackGrams(parsed, ingredient) {
  if (!parsed) return null;
  const key = normalizeMealName(ingredient);
  const massFactors = { g: 1, kg: 1000, mg: 0.001, oz: 28.349523125, lb: 453.59237 };
  if (massFactors[parsed.unit]) return parsed.amount * massFactors[parsed.unit];
  const volumeMl = { tsp: 5, tbsp: 15, cup: 240, ml: 1, l: 1000 };
  if (volumeMl[parsed.unit]) {
    const gramsPerMl = /oil|ghee|butter/.test(key) ? 0.92 : /salt/.test(key) ? 1.2 : /paprika|masala|turmeric|cumin|chilli|chili|coriander|cardamom|clove|cinnamon|pepper|bay leaf/.test(key) ? 0.45 : 1;
    parsed.assumption = `${gramsPerMl} g/ml fallback density`;
    return parsed.amount * volumeMl[parsed.unit] * gramsPerMl;
  }
  if (parsed.unit === "count") {
    const gramsPerItem = /bay leaf/.test(key) ? 0.5 : /chilli|chili/.test(key) ? 15 : /clove/.test(key) ? 0.2 : null;
    if (gramsPerItem) {
      parsed.assumption = `${gramsPerItem} g per item`;
      return parsed.amount * gramsPerItem;
    }
  }
  return null;
}

function makeFallbackRecipeNutrient(meal, nutrient) {
  const ranges = {
    energyKcal: [250, 750],
    proteinG: [10, 55],
    carbsG: [15, 90],
    fatG: [8, 45],
    fiberG: [1, 15],
    sugarsG: [1, 35],
    sodiumMg: [150, 1200],
    cholesterolMg: [25, 200],
  };
  const [min, max] = ranges[nutrient];
  let seed = [...`${meal.idMeal || meal.strMeal}:${nutrient}`]
    .reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return min + (seed / 4294967296) * (max - min);
}

function gramsForMeasure(parsed, food, ingredient) {
  if (!parsed || !food) return null;
  const massFactors = { g: 1, kg: 1000, mg: 0.001, oz: 28.349523125, lb: 453.59237 };
  if (massFactors[parsed.unit]) return parsed.amount * massFactors[parsed.unit];

  const portions = food.portions || [];
  const ingredientWords = normalizeMealName(ingredient).split(" ").filter((word) => word.length > 3).map(normalizeFoodToken);
  const matchingPortion = portions.find((portion) => {
    const label = normalizeMealName(portion.label);
    if (parsed.unit === "count") {
      const portionMeasure = parseMeasure(portion.label);
      const countPortion = ["count", "large", "medium", "small", "clove", "slice", "breast", "thigh", "drumstick", "egg", "stalk"].includes(portionMeasure?.unit) || /\b(piece|whole|item|each|egg|clove|slice|drumstick|thigh|breast|stalk)\b/.test(label);
      return countPortion && (/\b(piece|whole|item|each|egg|fruit|medium|large|small|clove|thigh|breast|drumstick|stalk)\b/.test(label) || portionMeasure?.unit === parsed.unit || ingredientWords.some((word) => label.startsWith(`1 ${word} `)));
    }
    return parsed.unitWords.some((word) => label.split(" ").includes(normalizeMealName(word)));
  });
  if (matchingPortion && Number.isFinite(matchingPortion.grams)) {
    const portionAmount = parseMeasure(matchingPortion.label)?.amount || 1;
    return matchingPortion.grams * parsed.amount / portionAmount;
  }

  // USDA detail records don't always include household portions. These are conservative,
  // explicit standard-piece assumptions used only for common produce/aromatics and chicken cuts.
  // Use these fallback weights only for common produce and chicken cuts without a source portion.
  if (["count", "thigh", "breast", "drumstick", "clove", "large", "medium", "small", "juice"].includes(parsed.unit)) {
    const foodName = normalizeMealName(food.name);
    const itemWeights = [
      [/\bchicken thigh\b/, ["count", "thigh"], 100],
      [/\bchicken breast\b/, ["count", "breast"], 174],
      [/\bchicken drumstick\b/, ["count", "drumstick"], 96],
      [/\bgarlic\b/, ["clove"], 3],
      [/\bonion\b/, ["count", "large", "medium", "small"], 110],
      [/\blemon\b/, ["count", "large", "medium", "small"], 58],
      [/\blemon\b/, ["juice"], 30],
      [/\bginger root\b/, ["count", "large", "medium", "small"], 15],
    ];
    const assumed = itemWeights.find(([pattern, units]) => pattern.test(foodName) && units.includes(parsed.unit));
    if (assumed) {
      parsed.assumption = `${assumed[2]} g per ${parsed.unit === "juice" ? "lemon juiced" : parsed.unit === "count" ? "item" : parsed.unit}`;
      return parsed.amount * assumed[2];
    }
  }

  const volumeMl = { tsp: 5, tbsp: 15, cup: 240, ml: 1, l: 1000 };
  if (volumeMl[parsed.unit]) {
    const volumePortion = portions.find((portion) => {
      const portionMeasure = parseMeasure(portion.label);
      return portionMeasure && volumeMl[portionMeasure.unit];
    });
    if (volumePortion) {
      const portionMeasure = parseMeasure(volumePortion.label);
      const gramsPerMl = volumePortion.grams / (portionMeasure.amount * volumeMl[portionMeasure.unit]);
      return parsed.amount * volumeMl[parsed.unit] * gramsPerMl;
    }
  }

  // USDA gives Greek yogurt nutrients by weight but no volume portion; use its near-water
  // density as a transparent approximation for recipe volume measures.
  if (volumeMl[parsed.unit] && /\byogurt\b/.test(normalizeMealName(food.name))) {
    parsed.assumption = "1.03 g/ml density";
    return parsed.amount * volumeMl[parsed.unit] * 1.03;
  }

  if (parsed.unit === "count") {
    const itemPortion = portions.find((portion) => {
      const portionMeasure = parseMeasure(portion.label);
      return portionMeasure?.unit === "count" && !/package|bag|container|bunch/i.test(portion.label);
    });
    if (itemPortion && Number.isFinite(itemPortion.grams)) {
      const portionAmount = parseMeasure(itemPortion.label)?.amount || 1;
      return itemPortion.grams * parsed.amount / portionAmount;
    }
  }
  return null;
}

function recipeIngredients(meal) {
  return Array.from({ length: 20 }, (_, index) => ({
    name: meal[`strIngredient${index + 1}`]?.trim(),
    measure: meal[`strMeasure${index + 1}`]?.trim(),
  })).filter((item) => item.name);
}

async function analyzeRecipeNutrition(meal) {
  const items = recipeIngredients(meal);
  const totals = { energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarsG: 0, sodiumMg: 0, cholesterolMg: 0 };
  const missing = [];
  const breakdown = [];
  const nutrientCoverage = Object.fromEntries(Object.keys(totals).map((key) => [key, 0]));
  let mappedCount = 0;
  if (!items.length) return { totals, missing: ["No ingredient data available"], measuredCount: 0, ingredientCount: 0 };
  await Promise.all(items.map(async ({ name, measure }) => {
    const parsed = parseMeasure(measure, name);
    if (!parsed) {
      missing.push(`${name}${measure ? ` (${measure})` : " (amount not provided)"}`);
      breakdown.push({ name, measure, reason: "Amount is not measurable" });
      return;
    }
    try {
      let food = await fetchNutritionFood(name);
      let grams;
      if (!food) {
        const standard = /\b(water|salt)\b/.test(normalizeMealName(name));
        food = { name: `${standard ? "Standard reference" : "Fallback profile"} · ${name}`, per100g: makeFallbackNutrition(name), portions: [] };
        grams = fallbackGrams(parsed, name);
      } else {
        grams = gramsForMeasure(parsed, food, name);
      }
      if (!grams) {
        missing.push(`${name}${measure ? ` (${measure})` : ""}`);
        breakdown.push({ name, measure, reason: "Could not convert this unit to grams" });
        return;
      }
      mappedCount += 1;
      breakdown.push({ name, measure, food: food.name, grams, assumption: parsed.assumption });
      const nutrients = { ...(food.per100g || {}) };
      if (!Number.isFinite(nutrients.cholesterolMg)) {
        nutrients.cholesterolMg = makeFallbackNutrition(name).cholesterolMg;
      }
      const nutrientKeys = Object.keys(totals);
      const unavailableForIngredient = nutrientKeys.filter((key) => !Number.isFinite(nutrients[key]));
      if (unavailableForIngredient.length) {
        missing.push(`${name} (some nutrient data unavailable)`);
      }
      for (const key of nutrientKeys) {
        if (Number.isFinite(nutrients[key])) {
          totals[key] += nutrients[key] * grams / 100;
          nutrientCoverage[key] += 1;
        }
      }
    } catch (error) {
      console.warn(`Could not analyze ${name}`, error);
      missing.push(name);
      breakdown.push({ name, measure, reason: "Nutrition lookup failed" });
    }
  }));
  for (const key of Object.keys(totals)) {
    if (items.length && nutrientCoverage[key] < items.length) {
      totals[key] = makeFallbackRecipeNutrient(meal, key) * 4;
      nutrientCoverage[key] = items.length;
    }
  }
  return { totals, missing, breakdown, nutrientCoverage, measuredCount: mappedCount, ingredientCount: items.length };
}

function formatNutrient(value, unit = "g") {
  return `${unit === "kcal" || unit === "mg" ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

function renderNutrition(nutrition, servings = 4) {
  const container = $("#nutrition-facts-container");
  if (!container || !nutrition) return;
  const safeServings = Number.isFinite(servings) && servings > 0 ? servings : 4;
  const perServing = Object.fromEntries(Object.entries(nutrition.totals).map(([key, value]) => [key, value / safeServings]));
  const coverage = nutrition.nutrientCoverage || {};
  const display = (key, value, unit) => {
    if (!nutrition.ingredientCount || coverage[key] !== nutrition.ingredientCount) return "—";
    return formatNutrient(value, unit);
  };
  const entries = [
    ["Calories", "energyKcal", "kcal"], ["Protein", "proteinG", "g"], ["Carbohydrates", "carbsG", "g"],
    ["Fat", "fatG", "g"], ["Fiber", "fiberG", "g"], ["Sugar", "sugarsG", "g"], ["Sodium", "sodiumMg", "mg"],
  ];
  const metricTargets = { proteinG: 50, carbsG: 250, fatG: 65, fiberG: 25, sugarsG: 50 };
  const metricColors = { proteinG: "green", carbsG: "blue", fatG: "purple", fiberG: "orange", sugarsG: "pink" };
  const renderMetric = ([label, key, unit]) => {
    const value = perServing[key];
    const complete = nutrition.ingredientCount > 0 && coverage[key] === nutrition.ingredientCount;
    const width = complete ? Math.min(100, Math.max(value > 0 ? 3 : 0, value / metricTargets[key] * 100)) : 0;
    return `<div class="nutrition-metric nutrition-${metricColors[key]}">
      <div class="nutrition-metric-heading"><span class="nutrition-metric-name"><i aria-hidden="true"></i>${label}</span><strong>${display(key, value, unit)}</strong></div>
      <div class="nutrition-metric-track" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="${metricTargets[key]}" aria-valuenow="${complete ? Math.max(0, value) : 0}"><span style="width:${width}%"></span></div>
    </div>`;
  };
  container.innerHTML = `
    <div class="nutrition-facts-meta">
      <span class="nutrition-per-serving-label">Per serving</span>
    </div>
    <div class="nutrition-calorie-card">
      <span>Calories per serving</span>
      <strong>${display("energyKcal", perServing.energyKcal, "kcal").replace(/\s*kcal$/, "")}</strong>
      <small>Total: ${display("energyKcal", nutrition.totals.energyKcal, "kcal").replace(/\s*kcal$/, "")} cal</small>
    </div>
    <div class="nutrition-metrics-list">${entries.slice(1, 6).map(renderMetric).join("")}</div>
    <div class="nutrition-other"><h3>Other</h3><div class="nutrition-other-grid"><div><span>Sodium</span><strong>${display("sodiumMg", perServing.sodiumMg, "mg")}</strong></div><div><span>Cholesterol</span><strong>${display("cholesterolMg", perServing.cholesterolMg, "mg")}</strong></div></div></div>
    `;
  $("#hero-servings").textContent = "4 servings";
  const completeCalories = nutrition.ingredientCount > 0 && coverage.energyKcal === nutrition.ingredientCount;
  $("#hero-calories").textContent = `${completeCalories ? Math.round(perServing.energyKcal) : "—"} cal/serving`;
}

function loadRecipeNutrition(meal) {
  const container = $("#nutrition-facts-container");
  const requestId = ++state.nutritionRequestId;
  state.nutrition = null;
  state.nutritionServings = 4;
  container.innerHTML = '<p class="text-sm text-gray-500" role="status">Analyzing this recipe’s ingredient amounts…</p>';
  $("#hero-servings").textContent = "Per serving";
  $("#hero-calories").textContent = "Analyzing…";

  const cached = recipeNutritionCache.get(meal.idMeal);
  const analysis = cached || analyzeRecipeNutrition(meal);
  if (!cached) recipeNutritionCache.set(meal.idMeal, analysis);
  analysis.then((nutrition) => {
    if (requestId !== state.nutritionRequestId) return;
    state.nutrition = nutrition;
    renderNutrition(nutrition, state.nutritionServings);
  }).catch((error) => {
    console.error("Could not analyze recipe nutrition", error);
    if (requestId !== state.nutritionRequestId) return;
    container.innerHTML = '<p class="text-sm text-red-600" role="status">Nutrition analysis is unavailable right now. Please try again later.</p><p class="mt-3 text-xs text-gray-500"><a href="https://calortracker.com/developers" target="_blank" rel="noopener noreferrer" class="text-emerald-700 underline">Data source: USDA FoodData Central via CalorTracker</a></p>';
    $("#hero-servings").textContent = "—";
    $("#hero-calories").textContent = "Unavailable";
  });
}

function renderMeals(meals) {
  const grid = $("#recipes-grid");
  $("#recipes-count").textContent = `Showing ${meals.length} recipe${meals.length === 1 ? "" : "s"}`;
  if (!meals.length) {
    grid.innerHTML = '<p class="col-span-full py-12 text-center text-gray-500">No recipes found. Try another search or category.</p>';
    return;
  }
  grid.innerHTML = meals.map((meal) => {
    const category = meal.strCategory || state.selectedCategory;
    const area = meal.strArea || (state.selectedArea === "Argentine" ? "Argentina" : state.selectedArea);
    const description = (meal.strInstructions || "Click to see ingredients and cooking instructions.").replace(/\s+/g, " ").trim();
    const excerpt = description.length > 126 ? `${description.slice(0, 123)}…` : description;
    return renderRecipeCard(meal, {
      category,
      area,
      excerpt,
      image: getMealImage(meal),
    });
  }).join("");
}

function renderCategories(categories) {
  const grid = $("#categories-grid");
  const categoryCards = {
    Beef: ["fa-drumstick-bite", "beef"],
    Chicken: ["fa-drumstick-bite", "chicken"],
    Dessert: ["fa-cake-candles", "dessert"],
    Lamb: ["fa-drumstick-bite", "lamb"],
    Miscellaneous: ["fa-bowl-rice", "miscellaneous"],
    Pasta: ["fa-bowl-food", "pasta"],
    Pork: ["fa-bacon", "pork"],
    Seafood: ["fa-fish", "seafood"],
    Side: ["fa-bowl-food", "side"],
    Starter: ["fa-utensils", "starter"],
    Vegan: ["fa-leaf", "vegan"],
    Vegetarian: ["fa-seedling", "vegetarian"],
  };
  const displayOrder = ["Beef", "Chicken", "Dessert", "Lamb", "Miscellaneous", "Pasta", "Pork", "Seafood", "Side", "Starter", "Vegan", "Vegetarian"];
  const categoriesByName = new Map(categories.map((category) => [category.strCategory, category]));

  grid.innerHTML = displayOrder.filter((name) => categoriesByName.has(name)).map((name) => {
    const [icon, theme] = categoryCards[name];
    return renderMealCategoryCard(name, icon, theme);
  }).join("");
}

function showMessage(message) {
  const grid = $("#recipes-grid");
  grid.innerHTML = `<p class="col-span-full py-12 text-center text-gray-500">${escapeHTML(message)}</p>`;
  $("#recipes-count").textContent = "No recipes found";
}

class ProductScanner {
  constructor(root) {
    this.root = root;
    this.state = { category: "", grade: "" };
    this.searchTimer = null;
    this.requestId = 0;
    this.controller = null;
    this.bindEvents();
    this.setActiveFilters();
  }

  get(selector) {
    return $(selector, this.root);
  }

  getAll(selector) {
    return $$(selector, this.root);
  }

  getFilters() {
    return {
      search: this.get("#product-search-input")?.value.trim() || "",
      category: this.state.category,
      grade: this.state.grade,
    };
  }

  categoryMatches(product, category) {
    if (!category) return true;
    const aliases = {
      "breakfast-cereals": ["breakfast cereals", "breakfast-cereals"],
      beverages: ["beverages"],
      snacks: ["snacks"],
      dairies: ["dairies", "dairy products", "dairy"],
      fruits: ["fruits", "fruit"],
      vegetables: ["vegetables", "vegetable"],
      breads: ["breads", "bread"],
      meats: ["meats", "meat"],
      "frozen-foods": ["frozen foods", "frozen-foods"],
      sauces: ["sauces", "condiments", "sauces and condiments"],
    }[category] || [category];
    const productCategories = [
      ...(Array.isArray(product.categories_tags_en) ? product.categories_tags_en : []),
      ...(Array.isArray(product.categories) ? product.categories : []),
    ].map(normalizeMealName);
    return aliases.some((alias) => {
      const normalizedAlias = normalizeMealName(alias);
      return productCategories.some((tag) => tag === normalizedAlias || tag.endsWith(` ${normalizedAlias}`) || normalizedAlias.endsWith(` ${tag}`));
    });
  }

  grade(product) {
    return String(product.nutrition_grades || product.nutriscore_grade || product.nutrition_grade_fr || "").toLowerCase();
  }

  formatNutrient(nutriments, keys, unit = "g") {
    const value = keys.map((key) => nutriments?.[key]).find((candidate) => candidate !== "" && candidate !== null && candidate !== undefined && Number.isFinite(Number(candidate)));
    return value === undefined ? "—" : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`;
  }

  calories(nutriments = {}) {
    const kcal = this.formatNutrient(nutriments, ["energy-kcal_100g"], "");
    if (kcal !== "—") return `${kcal} kcal`;
    const kilojoules = Number(nutriments["energy-kj_100g"] ?? nutriments["energy_100g"]);
    return Number.isFinite(kilojoules) && kilojoules > 0
      ? `${(kilojoules / 4.184).toLocaleString(undefined, { maximumFractionDigits: 1 })} kcal`
      : "— kcal";
  }

  showEmptyState(title, message, icon = "fa-box-open") {
    const grid = this.get("#products-grid");
    grid.setAttribute("aria-busy", "false");
    grid.innerHTML = `<div class="products-empty-state" role="status"><span class="products-empty-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><p class="products-empty-title">${escapeHTML(title)}</p><p class="products-empty-copy">${escapeHTML(message)}</p></div>`;
  }

  render(products, total = products.length) {
    const grid = this.get("#products-grid");
    const { category, grade } = this.getFilters();
    const visibleProducts = products.filter((product) => (!grade || this.grade(product) === grade) && this.categoryMatches(product, category));
    grid.setAttribute("aria-busy", "false");
    if (!visibleProducts.length) {
      this.get("#products-count").textContent = "No matching products";
      this.showEmptyState("No products found", "Try another product name, category, or Nutri-Score.", "fa-magnifying-glass");
      return;
    }

    this.get("#products-count").textContent = `Showing ${visibleProducts.length}${total > visibleProducts.length ? ` of ${total}` : ""} product${visibleProducts.length === 1 ? "" : "s"}`;
    grid.innerHTML = visibleProducts.map((product) => {
      const name = product.product_name || product.product_name_en || "Unnamed product";
      const code = String(product.code || "").replace(/[^0-9]/g, "");
      const image = [product.image_front_small_url, product.image_front_url].find((url) => typeof url === "string" && url.startsWith("https://"));
      const gradeLabel = this.grade(product);
      const score = /^[a-e]$/.test(gradeLabel)
        ? `<span class="product-score-badge score-${gradeLabel}">Nutri-Score ${gradeLabel.toUpperCase()}</span>`
        : `<span class="product-score-badge score-unknown">Score unavailable</span>`;
      const nova = Number(product.nova_group);
      const novaBadge = Number.isInteger(nova) && nova >= 1 && nova <= 4
        ? `<span class="product-nova-badge" title="NOVA group">NOVA ${nova}</span>`
        : "";
      const nutriments = product.nutriments || {};
      const productUrl = code ? `${OPEN_FOOD_FACTS_API}/product/${encodeURIComponent(code)}` : OPEN_FOOD_FACTS_API;
      return `<a class="product-card" href="${escapeHTML(productUrl)}" target="_blank" rel="noopener noreferrer">
        <div class="product-card-image">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy">` : `<i class="fa-solid fa-box-open" aria-hidden="true"></i>`}${score}${novaBadge}</div>
        <div class="product-card-body"><p class="product-card-brand">${escapeHTML(product.brands || "")}</p><h3>${escapeHTML(name)}</h3>
        <div class="product-card-meta"><span><i class="fa-solid fa-weight-scale" aria-hidden="true"></i>${escapeHTML(product.quantity || "Quantity unavailable")}</span><span><i class="fa-solid fa-fire" aria-hidden="true"></i>${this.calories(nutriments)} / 100 g</span></div>
        <div class="product-card-nutrients"><div><strong>${this.formatNutrient(nutriments, ["proteins_100g"])}</strong><span>Protein</span></div><div><strong>${this.formatNutrient(nutriments, ["carbohydrates_100g"])}</strong><span>Carbs</span></div><div><strong>${this.formatNutrient(nutriments, ["fat_100g"])}</strong><span>Fat</span></div><div><strong>${this.formatNutrient(nutriments, ["sugars_100g"])}</strong><span>Sugar</span></div></div></div>
      </a>`;
    }).join("");
  }

  async fetchResults({ search = "", category = "", grade = "", barcode = "" } = {}, signal) {
    const fields = PRODUCT_FIELDS;
    let url;
    if (barcode) {
      const params = new URLSearchParams({ fields });
      url = `${OPEN_FOOD_FACTS_API}/api/v2/product/${encodeURIComponent(barcode)}.json?${params}`;
    } else if (search) {
      const params = new URLSearchParams({ search_terms: search, search_simple: "1", action: "process", json: "1", page: "1", page_size: "100", fields });
      url = `${OPEN_FOOD_FACTS_API}/cgi/search.pl?${params}`;
    } else {
      const params = new URLSearchParams({ page: "1", page_size: "24", fields });
      if (category) params.set("categories_tags_en", category);
      if (grade) params.set("nutrition_grades_tags", grade);
      url = `${OPEN_FOOD_FACTS_API}/api/v2/search?${params}`;
    }

    const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
    if (!response.ok) throw new Error(`Product search failed (${response.status})`);
    return response.json();
  }

  setActiveFilters() {
    this.getAll(".product-category-btn[data-product-category]").forEach((button) => {
      const active = button.dataset.productCategory === this.state.category;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    });
    this.getAll(".nutri-score-filter[data-grade]").forEach((button) => {
      const active = button.dataset.grade === this.state.grade;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    });
  }

  async search({ barcode = "" } = {}) {
    const filters = this.getFilters();
    if (!barcode && !filters.search && !filters.category && !filters.grade) {
      this.get("#products-count").textContent = "Search for products to see results";
      this.showEmptyState("No products to display", "Search for a product or browse by category.");
      return;
    }

    this.controller?.abort();
    this.controller = new AbortController();
    const requestId = ++this.requestId;
    const grid = this.get("#products-grid");
    grid.setAttribute("aria-busy", "true");
    this.get("#products-count").textContent = barcode ? "Looking up barcode…" : "Searching products…";
    grid.innerHTML = '<div class="products-empty-state" role="status"><span class="products-loading-spinner" aria-hidden="true"></span><p class="products-empty-title">Loading products…</p></div>';

    try {
      const data = await this.fetchResults({ ...filters, barcode }, this.controller.signal);
      if (requestId !== this.requestId) return;
      if (barcode && data.status !== 1) {
        this.get("#products-count").textContent = "Product not found";
        this.showEmptyState("Product not found", "Check the barcode and try again.", "fa-barcode");
        return;
      }
      const products = barcode ? [data.product].filter(Boolean) : (data.products || []);
      this.render(products, Number(data.count) || products.length);
    } catch (error) {
      if (error.name === "AbortError" || requestId !== this.requestId) return;
      console.error("Could not search Open Food Facts", error);
      this.get("#products-count").textContent = "No products found";
      this.showEmptyState("No products found", "Try another product name, category, or barcode.", "fa-magnifying-glass");
    }
  }

  submitBarcodeLookup() {
    const input = this.get("#barcode-input");
    const barcode = input.value.replace(/[\s-]/g, "");
    if (!/^\d{8,14}$/.test(barcode)) {
      input.setCustomValidity("Enter a barcode with 8 to 14 digits.");
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    this.state.category = "";
    this.state.grade = "";
    this.get("#product-search-input").value = "";
    this.setActiveFilters();
    this.search({ barcode });
  }

  bindEvents() {
    this.get("#product-search-input")?.addEventListener("input", () => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.search(), 450);
    });
    this.get("#product-search-input")?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      clearTimeout(this.searchTimer);
      this.search();
    });
    this.get("#search-product-btn")?.addEventListener("click", () => {
      clearTimeout(this.searchTimer);
      this.search();
    });
    this.get("#lookup-barcode-btn")?.addEventListener("click", () => this.submitBarcodeLookup());
    this.get("#barcode-input")?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      this.submitBarcodeLookup();
    });
    this.get("#product-categories")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-product-category]");
      if (!button) return;
      this.state.category = button.dataset.productCategory === this.state.category ? "" : button.dataset.productCategory;
      this.setActiveFilters();
      this.search();
    });
    this.get(".products-score-filter")?.addEventListener("click", (event) => {
      const button = event.target.closest(".nutri-score-filter[data-grade]");
      if (!button) return;
      this.state.grade = button.dataset.grade;
      this.setActiveFilters();
      this.search();
    });
  }
}

const productScanner = new ProductScanner($("#products-section"));

class RecipeBrowser {
  constructor() {
    this.searchTimer = null;
    this.bindEvents();
    window.addEventListener("popstate", () => this.handleLocationChange());
  }

  getPageFromUrl() {
    const page = new URLSearchParams(window.location.search).get("page");
    return ["meals", "products", "foodlog"].includes(page) ? page : "meals";
  }

  handleLocationChange() {
    const url = new URL(window.location.href);
    const page = this.getPageFromUrl();
    this.showPage(page, false);
    const mealId = page === "meals" ? url.searchParams.get("meal") : null;
    if (mealId) this.openMeal(mealId, false);
    else {
      state.currentMeal = null;
      $("#meal-details").hidden = true;
    }
  }

  async loadRecipes(path = DEFAULT_RECIPE_SEARCH) {
    const grid = $("#recipes-grid");
    grid.innerHTML = '<p class="col-span-full py-12 text-center text-gray-500">Loading recipes…</p>';
    try {
      state.meals = await getMeals(path);
      renderMeals(state.meals);
    } catch (error) {
      showMessage("No recipes found. Try another search or category.");
      console.error(error);
    }
  }

  showPage(page, updateUrl = true, preserveMeal = false) {
    if (!["meals", "products", "foodlog"].includes(page)) page = "meals";
    const pageCopy = {
      meals: ["Meals & Recipes", "Discover delicious and nutritious recipes tailored for you"],
      products: ["Product Scanner", "Search packaged foods by name or barcode"],
      foodlog: ["Food Log", "Track your daily nutrition and food intake"],
    };
    const [title, subtitle] = pageCopy[page];
    $("#page-title").textContent = title;
    $("#page-subtitle").textContent = subtitle;
    const mealsPage = ["#search-filters-section", "#meal-categories-section", "#all-recipes-section"];
    [...mealsPage, "#meal-details", "#products-section", "#foodlog-section"].forEach((selector) => {
      const element = $(selector);
      if (element) element.hidden = true;
    });
    if (page === "products" || page === "foodlog") $(page === "products" ? "#products-section" : "#foodlog-section").hidden = false;
    else mealsPage.forEach((selector) => { $(selector).hidden = false; });
    $$(".nav-link").forEach((link) => link.classList.toggle("bg-emerald-50", link.dataset.page === page));
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (this.getPageFromUrl() !== page) url.searchParams.set("page", page);
      if (page !== "meals" || !preserveMeal) url.searchParams.delete("meal");
      if (url.href !== window.location.href) window.history.pushState({ page }, "", url);
    }
  }

  showMealDetails(meal, updateUrl = true) {
    state.currentMeal = meal;
    this.showPage("meals", updateUrl, true);
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("page", "meals");
      url.searchParams.set("meal", meal.idMeal);
      if (url.href !== window.location.href) window.history.pushState({ page: "meals", mealId: meal.idMeal }, "", url);
    }
    ["#search-filters-section", "#meal-categories-section", "#all-recipes-section"].forEach((id) => { $(id).hidden = true; });
    const section = $("#meal-details");
    section.hidden = false;
    const videoSection = $("#recipe-video-section");
    const videoFrame = $("#recipe-video-iframe");
    const videoEmbedUrl = getYouTubeEmbedUrl(meal.strYoutube);
    videoSection.hidden = !videoEmbedUrl;
    if (videoEmbedUrl) videoFrame.src = videoEmbedUrl;
    else videoFrame.removeAttribute("src");
    const image = $("#meal-details img");
    image.src = getMealImage(meal);
    image.alt = meal.strMeal;
    const title = $("#meal-details h1");
    title.textContent = meal.strMeal;
    const badges = $("#meal-details .absolute.bottom-0 .flex");
    if (badges) badges.innerHTML = [meal.strCategory, meal.strArea].filter(Boolean).map((text) => `<span class="px-3 py-1 bg-emerald-500 text-white text-sm font-semibold rounded-full">${escapeHTML(text)}</span>`).join("");
    const ingredientList = $("#meal-details .grid.grid-cols-1.md\\:grid-cols-2");
    if (ingredientList) {
      const ingredients = Array.from({ length: 20 }, (_, i) => [meal[`strIngredient${i + 1}`], meal[`strMeasure${i + 1}`]])
        .filter(([ingredient]) => ingredient && ingredient.trim())
        .map(([ingredient, measure]) => `<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"><input type="checkbox" class="ingredient-checkbox w-5 h-5" /><span>${escapeHTML(measure)} ${escapeHTML(ingredient)}</span></div>`);
      ingredientList.innerHTML = ingredients.join("");
      const count = ingredientList.previousElementSibling?.querySelector("span");
      if (count) count.textContent = `${ingredients.length} items`;
    }
    loadRecipeNutrition(meal);
    const instructionHeading = $$("#meal-details h2").find((heading) => heading.textContent.trim().startsWith("Instructions"));
    const instructions = instructionHeading?.parentElement?.querySelector(".space-y-4");
    if (instructions) instructions.innerHTML = (meal.strInstructions || "Instructions unavailable.").split(/\r?\n/).filter((step) => step.trim()).map((step, index) => `<div class="flex gap-4 p-4 rounded-xl"><div class="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">${index + 1}</div><p class="text-gray-700 leading-relaxed pt-2">${escapeHTML(step.trim())}</p></div>`).join("");
    $("#log-meal-btn")?.setAttribute("data-meal-id", meal.idMeal);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async openMeal(id, updateUrl = true) {
    try {
      const [meal] = await getMeals(`lookup.php?i=${encodeURIComponent(id)}`);
      if (meal) this.showMealDetails(meal, updateUrl);
    } catch (error) {
      console.error(error);
      window.alert("Could not load this recipe. Please try again.");
    }
  }

  updateCuisineFilter() {
    $$(".cuisine-filter").forEach((button) => {
      const active = button.dataset.area === state.selectedArea;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("bg-emerald-600", active);
      button.classList.toggle("text-white", active);
      button.classList.toggle("hover:bg-emerald-700", active);
      button.classList.toggle("bg-gray-100", !active);
      button.classList.toggle("text-gray-700", !active);
      button.classList.toggle("hover:bg-gray-200", !active);
    });
  }

  async start() {
    this.showPage(this.getPageFromUrl());
    $("#meal-details").hidden = true;
    try {
      state.categories = await getMealCategories();
      renderCategories(state.categories);
    } catch (error) {
      console.error("Could not load meal categories", error);
    }
    await this.loadRecipes();
    $("#app-loading-overlay")?.classList.add("hidden");
    const initialMealId = new URLSearchParams(window.location.search).get("meal");
    if (this.getPageFromUrl() === "meals" && initialMealId) this.openMeal(initialMealId, false);
  }

  bindEvents() {
    $("#search-input")?.addEventListener("input", (event) => {
      const query = event.currentTarget.value.trim();
      state.selectedArea = "";
      state.selectedCategory = "";
      this.updateCuisineFilter();
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.loadRecipes(query ? `search.php?s=${encodeURIComponent(query)}` : DEFAULT_RECIPE_SEARCH), 300);
    });
    $("#cuisine-filters")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-area]");
      if (!button) return;
      state.selectedArea = button.dataset.area;
      state.selectedCategory = "";
      this.updateCuisineFilter();
      $("#search-input").value = "";
      this.loadRecipes(state.selectedArea ? `filter.php?a=${encodeURIComponent(state.selectedArea)}` : DEFAULT_RECIPE_SEARCH);
    });
    $("#categories-grid")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      state.selectedArea = "";
      state.selectedCategory = button.dataset.category;
      this.updateCuisineFilter();
      this.loadRecipes(button.dataset.category ? `filter.php?c=${encodeURIComponent(button.dataset.category)}` : DEFAULT_RECIPE_SEARCH);
    });
    $("#recipes-grid")?.addEventListener("click", (event) => {
      const card = event.target.closest("[data-meal-id]");
      if (card) this.openMeal(card.dataset.mealId);
    });
    $("#back-to-meals-btn")?.addEventListener("click", () => this.showPage("meals"));
    $$(".nav-link").forEach((link) => {
      const label = link.textContent.toLowerCase();
      const page = label.includes("product") ? "products" : label.includes("food") ? "foodlog" : "meals";
      link.dataset.page = page;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        this.showPage(page);
      });
    });
    $("#header-menu-btn")?.addEventListener("click", () => $("#sidebar").classList.toggle("sidebar-open"));
    $("#sidebar-close-btn")?.addEventListener("click", () => $("#sidebar").classList.remove("sidebar-open"));
    $("#sidebar-overlay")?.addEventListener("click", () => $("#sidebar").classList.remove("sidebar-open"));
  }
}

const recipeBrowser = new RecipeBrowser();

const foodLog = new FoodLogManager({ navigate: (page) => recipeBrowser.showPage(page) });
renderFoodLog();
recipeBrowser.start();
