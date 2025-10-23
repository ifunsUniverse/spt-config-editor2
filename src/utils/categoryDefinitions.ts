export interface Category {
  name: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export const CATEGORIES: Category[] = [
  {
    name: "Traders",
    color: "bg-purple-500 hover:bg-purple-600",
    bgColor: "bg-purple-500",
    textColor: "text-white"
  },
  {
    name: "AI Behavior",
    color: "bg-purple-500 hover:bg-purple-600",
    bgColor: "bg-purple-500",
    textColor: "text-white"
  },
  {
    name: "Loot & Economy",
    color: "bg-green-500 hover:bg-green-600",
    bgColor: "bg-green-500",
    textColor: "text-white"
  },
  {
    name: "Weapons & Gear",
    color: "bg-red-500 hover:bg-red-600",
    bgColor: "bg-red-500",
    textColor: "text-white"
  },
  {
    name: "Movement & Stamina",
    color: "bg-blue-500 hover:bg-blue-600",
    bgColor: "bg-blue-500",
    textColor: "text-white"
  },
  {
    name: "Quests & Progression",
    color: "bg-yellow-500 hover:bg-yellow-600",
    bgColor: "bg-yellow-500",
    textColor: "text-white"
  },
  {
    name: "Visual Tweaks",
    color: "bg-pink-500 hover:bg-pink-600",
    bgColor: "bg-pink-500",
    textColor: "text-white"
  },
  {
    name: "Debug & Dev Tools",
    color: "bg-gray-500 hover:bg-gray-600",
    bgColor: "bg-gray-500",
    textColor: "text-white"
  }
];

export const getCategoryColor = (categoryName: string): string => {
  const category = CATEGORIES.find(c => c.name === categoryName);
  return category ? category.color : "bg-gray-500";
};

export const getCategoryBgColor = (categoryName: string): string => {
  const category = CATEGORIES.find(c => c.name === categoryName);
  return category ? category.bgColor : "bg-gray-500";
};
