# 🥗 NutriPlan — Food, Nutrition & Wellness Planner

**NutriPlan** is a responsive single-page web application designed to help users discover nutritious recipes, scan packaged grocery products for health ratings, and log daily macronutrient intake in real time.

🌐 **Live Demo:** [https://dapper-dodol-6098c1.netlify.app](https://dapper-dodol-6098c1.netlify.app)  
💻 **Repository:** [https://github.com/adhammahmoud658-wq/nutriplan-js-exam](https://github.com/adhammahmoud658-wq/nutriplan-js-exam)

## ✨ Key Features

- **Meals & Recipes Discovery:** Browse and filter recipes across global cuisines (e.g., Italian, Australian, Indian) and meal categories (Beef, Chicken, Pasta, Seafood, Vegan) with real-time keyword search powered by [TheMealDB API](https://www.themealdb.com/api.php).
- **Detailed Recipe Breakdown & Video Tutorials:** Inspect ingredient lists, step-by-step preparation instructions, embedded YouTube cooking tutorials, and per-serving macro calculations.
- **Smart Product Scanner:** Search packaged grocery items by product name or barcode number, filter by **Nutri-Score** (`A` through `E`), and view **NOVA** food processing classifications alongside per-100g nutrition stats.
- **Interactive Daily Food Log:** Log custom meal portions or scanned products directly into your daily tracker with real-time progress bars for Calories (`kcal`), Protein (`g`), Carbohydrates (`g`), and Fat (`g`), plus a 7-day weekly overview and persistent `localStorage` state.

## 🛠️ Tech Stack & Libraries

| Category | Technology |
| :--- | :--- |
| **Core Languages** | HTML5, CSS3, Modern JavaScript (ES6+ Modules) |
| **Styling & UI** | Tailwind CSS, [Font Awesome 7.0.1](https://www.google.com/search?q=https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.1/js/all.min.js), [Google Fonts (Inter)](https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap) |
| **Alerts & Modals** | [SweetAlert2](https://cdn.jsdelivr.net/npm/sweetalert2@11) |
| **Data Visualization** | [Plotly.js 3.1.1](https://www.google.com/search?q=https://cdn.plot.ly/plotly-3.1.1.min.js) |
| **REST APIs** | [TheMealDB API](https://www.themealdb.com/api/json/v1/1/categories.php) & Open Food Facts Product Data |

## 📁 Project Architecture

```text
nutriplan-js-exam/
├── index.html               # Single-page application shell & views
├── README.md                # Project documentation
├── css/                     # Stylesheets & Tailwind utilities
└── src/
    └── src/
        ├── css/
        │   ├── index.css    # Utility & layout styles
        │   └── style.css    # Custom component styles
        ├── images/
        │   └── favicon.png  # Application icon
        └── js/
            ├── main.js      # Application entry point & event orchestration
            ├── api/         # Asynchronous API fetchers (TheMealDB & Product lookup)
            ├── state/       # Centralized state & localStorage persistence
            └── ui/          # Reusable DOM rendering components
```

## 🚀 Getting Started Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/adhammahmoud658-wq/nutriplan-js-exam.git
   ```
2. **Navigate to the project folder:**
   ```bash
   cd nutriplan-js-exam
   ```
3. **Launch with a local server:**
   Open `index.html` using the **Live Server** extension in VS Code (or run `npx serve .`) so ES6 modules load properly over HTTP.

## 👤 Author

**Adham Mahmoud**  
- GitHub: [@adhammahmoud658-wq](https://github.com/adhammahmoud658-wq)
