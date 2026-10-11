// Kuratierte Datenbank mit echten EAN Barcodes, hochauflösenden offiziellen Bildern und Themen-Farben
const MONSTER_DATABASE = {
    "5060337502504": {
        id: "original",
        name: "Monster Energy Original",
        caffeine: 160,
        color: "#22c55e", // Green
        image: "https://images.openfoodfacts.org/images/products/506/033/750/2504/front_de.34.400.jpg"
    },
    "5060166768393": {
        id: "ultra_white",
        name: "Monster Ultra White (Zero)",
        caffeine: 150,
        color: "#f8fafc", // White/Silver
        image: "https://images.openfoodfacts.org/images/products/506/016/676/8393/front_de.19.400.jpg"
    },
    "5060603913075": {
        id: "pipeline_punch",
        name: "Monster Juiced Pipeline Punch",
        caffeine: 160,
        color: "#ec4899", // Pink
        image: "https://images.openfoodfacts.org/images/products/506/060/391/3075/front_de.16.400.jpg"
    },
    "5060337509459": {
        id: "mango_loco",
        name: "Monster Juiced Mango Loco",
        caffeine: 160,
        color: "#f97316", // Orange
        image: "https://images.openfoodfacts.org/images/products/506/033/750/9459/front_de.18.400.jpg"
    },
    "5060505330382": {
        id: "ultra_paradise",
        name: "Monster Ultra Paradise",
        caffeine: 150,
        color: "#10b981", // Emerald / Lime
        image: "https://images.openfoodfacts.org/images/products/506/050/533/0382/front_de.16.400.jpg"
    },
    "5060603913259": {
        id: "ultra_rosa",
        name: "Monster Ultra Rosa",
        caffeine: 150,
        color: "#f472b6", // Light Pink
        image: "https://images.openfoodfacts.org/images/products/506/060/391/3259/front_de.12.400.jpg"
    },
    "5060505338166": {
        id: "monarch",
        name: "Monster Juiced Monarch (The Doctor/Juice)",
        caffeine: 160,
        color: "#eab308", // Gold
        image: "https://images.openfoodfacts.org/images/products/506/050/533/8166/front_de.11.400.jpg"
    },
    "5060505331501": {
        id: "pacific_punch",
        name: "Monster Juiced Pacific Punch",
        caffeine: 160,
        color: "#3b82f6", // Blue
        image: "https://images.openfoodfacts.org/images/products/506/050/533/1501/front_de.10.400.jpg"
    },
    "5060166763435": {
        id: "assault",
        name: "Monster Assault",
        caffeine: 160,
        color: "#b91c1c", // Red
        image: "https://images.openfoodfacts.org/images/products/506/016/676/3435/front_de.7.400.jpg"
    },
    "5060059513018": {
        id: "doctor",
        name: "Monster VR46 The Doctor",
        caffeine: 160,
        color: "#84cc16", // Lime
        image: "https://images.openfoodfacts.org/images/products/506/005/951/3018/front_de.14.400.jpg"
    }
};

// Verfügbare Flavor Tags zur Auswahl
const AVAILABLE_FLAVOR_TAGS = [
    "Fruchtig", "Süß", "Sauer", "Erfrischend", "Beerig", 
    "Tropisch", "Künstlich", "Favorit", "Zu süß", "Kaffee/Espresso"
];
