export const garments = [
  { id: "black-overshirt", name: "Black Overshirt", image: "/closet/black-overshirt.jpg", garmentType: "upper_body", tags: ["class", "casual", "dinner", "going out"], mood: "Day to night" },
  { id: "grey-hoodie", name: "Grey Hoodie", image: "/closet/grey-hoodie.jpg", garmentType: "upper_body", tags: ["class", "casual", "comfortable", "study"], mood: "Keep it easy" },
  { id: "white-sweater", name: "White Sweater", image: "/closet/white-sweater.jpg", garmentType: "upper_body", tags: ["class", "dinner", "smart casual", "going out"], mood: "A little sharper" },
] as const;

export type Garment = (typeof garments)[number];
export type Recommendation = { garment: Garment; reason: string };
export const defaultPlans = "Classes during the day, grabbing food with friends tonight. I want something casual that works for both.";

// Local rules only. No language model, network call, or stored user data.
export function wardrobeAgent(plans: string): Recommendation {
  const text = plans.toLowerCase();
  const daytime = /\b(class(?:es)?|campus|daytime|during the day|school|lecture(?:s)?)\b/.test(text);
  const social = /\b(dinner|date|restaurant|going out|event(?:s)?|friends|party|grabbing food)\b/.test(text);
  if (daytime && social) {
    return { garment: garments[0], reason: "Casual enough for class but put together enough for dinner, so you don't need to change later." };
  }
  if (/\b(dinner|date|restaurant|going out|event(?:s)?)\b/.test(text)) {
    return { garment: garments[0], reason: "An easy layer that feels put together for your plans out. The black overshirt has you covered." };
  }
  if (/\b(meeting(?:s)?|presentation(?:s)?|interview(?:s)?|formal|smart)\b/.test(text)) {
    return { garment: garments[2], reason: "A clean, simple knit for a day that calls for something a little sharper." };
  }
  if (/\b(study(?:ing)?|library|casual|relaxing|comfortable)\b/.test(text)) {
    return { garment: garments[1], reason: "Your day sounds laid back. The grey hoodie keeps things comfortable, from your first plan to your last." };
  }
  return { garment: garments[1], reason: "An easy everyday layer. The grey hoodie keeps you comfortable wherever the day takes you." };
}
