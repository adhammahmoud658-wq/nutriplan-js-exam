const BASE_URL = "https://www.themealdb.com/api/json/v1/1";

async function requestJSON(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} request failed (${response.status})`);
  return response.json();
}

export async function getMealCategories() {
  const data = await requestJSON(`${BASE_URL}/categories.php`, "Meal categories");
  return data.categories || [];
}

export async function getMeals(path) {
  const data = await requestJSON(`${BASE_URL}/${path}`, "Recipes");
  return data.meals || [];
}
