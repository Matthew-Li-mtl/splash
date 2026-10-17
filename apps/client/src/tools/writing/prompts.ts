import { seededRandom, shuffle, todayKey } from "../../lib/util";

export interface Prompt {
  text: string;
  /** "opinion" prompts (tier lists, would-you-rathers, hot takes) are the daily prompt. */
  category: "opinion" | "fun" | "memory" | "imagine" | "notice" | "reflect" | "poem" | "story";
}

const p = (category: Prompt["category"], ...texts: string[]): Prompt[] => texts.map((text) => ({ text, category }));

export const PROMPTS: Prompt[] = [
  // Opinions are easy to answer and fun to compare, which is what makes a good daily prompt.
  // Keep each one answerable in a few lines; the daily rotation walks this list in a shuffled order.
  ...p(
    "opinion",
    // Tier lists
    "Make a tier list of breakfast foods. S tier to F tier, and defend your S.",
    "Make a tier list of the seasons. Explain your bottom pick.",
    "Make a tier list of pizza toppings. Pineapple goes where?",
    "Make a tier list of ways to spend a rainy day.",
    "Make a tier list of kitchen utensils, ranked by how much they carry the team.",
    "Make a tier list of board games or card games you've played.",
    "Make a tier list of holidays, ranked purely on vibes.",
    "Make a tier list of snacks you'd bring on a road trip.",
    "Make a tier list of chores, from \"honestly relaxing\" to \"never again\".",
    "Make a tier list of the apps on your home screen.",
    "Make a tier list of potato forms: fries, mashed, chips, hash browns and more.",
    "Make a tier list of the places you've lived or the rooms in your home.",
    "Make a tier list of drinks you'd order at a café.",
    "Make a tier list of animals you'd want as a sidekick.",
    // Would you rather
    "Would you rather live in a treehouse or a houseboat? Make your case.",
    "Would you rather be able to talk to animals or speak every human language?",
    "Would you rather only eat breakfast food or only eat dessert, forever?",
    "Would you rather always be ten minutes early or always be ten minutes late?",
    "Would you rather have a rewind button or a pause button for your life?",
    "Would you rather explore the deep ocean or outer space?",
    "Would you rather have no internet for a month or no music for a month?",
    "Would you rather live 100 years in the past or 100 years in the future?",
    "Would you rather have a personal chef or a personal chauffeur?",
    "Would you rather know how every movie ends, or never be able to finish one?",
    "Would you rather be famous in your town or unknown everywhere?",
    // Underrated / overrated
    "What's an underrated snack that deserves more love?",
    "What's an underrated movie or show you'd recommend to anyone?",
    "What's an underrated household item that makes your life better?",
    "What's an underrated way to spend a Saturday?",
    "What's an underrated song that should have been a hit?",
    "What's an underrated small pleasure most people overlook?",
    "What's something everyone loves that you think is overrated? Be honest.",
    "What's an underrated skill everyone should learn?",
    // Hot takes and rankings
    "What's your most harmless hot take? Defend it.",
    "Rank the five senses from most to least essential.",
    "What's the best smell in the world, and why is it obviously that one?",
    "Is a hot dog a sandwich? Settle it once and for all.",
    "What's the perfect number of pillows? Show your reasoning.",
    "Name the best decade for music and argue for it.",
    "What's the correct way to eat an Oreo, and why are the others wrong?",
    "Which is better: sunrise or sunset? Pick a side.",
    "What's the most useful thing you own that cost under $10?",
    "What's the ideal temperature for a perfect day? Exact numbers only.",
    "Cats or dogs? Then name the one exception to your answer.",
  ),
  ...p(
    "fun",
    "Write the terms and conditions for being your friend.",
    "Describe your morning as a nature documentary narrator.",
    "Write a one-star review of something you secretly love.",
    "Invent a holiday. What do people eat, wear and do?",
    "Write a motivational speech for a houseplant that won't grow.",
    "Your autobiography's chapter titles. Just the titles.",
    "Write a horoscope for your neighborhood this week.",
    "Explain your job, or your day, using only words a five-year-old knows.",
    "Write a wanted poster for the sock thief in your laundry.",
    "Design the perfect sandwich, ingredient by ingredient.",
    "Write the patch notes for the latest version of yourself.",
    "Plan a heist where the treasure is the last slice of cake.",
  ),
  ...p(
    "memory",
    "Describe the kitchen you grew up in, using all five senses.",
    "Write about a time you were brave without meaning to be.",
    "What's a smell that takes you somewhere? Take us there.",
    "Write a thank-you note to someone you never properly thanked.",
    "The best meal you've ever had. Who was there?",
    "A song that was playing during an important moment.",
    "Write about the first money you ever earned.",
    "Describe a childhood friend you've lost touch with.",
    "A rule you broke, and whether it was worth it.",
    "Your favorite place to sit and think.",
  ),
  ...p(
    "imagine",
    "You find a door in your home that wasn't there yesterday. What's behind it?",
    "Write a weather report for your mood today.",
    "A lighthouse keeper receives a letter addressed to the lighthouse.",
    "Write a conversation between your houseplants while you're out.",
    "The moon decides to take a day off. What happens?",
    "Something in your pocket is secretly magic. What does it do?",
    "Write the first page of a book that will never be written.",
    "A town where everyone can hear each other's thoughts on Tuesdays.",
    "Review a restaurant that only serves memories.",
    "A ghost who is very bad at haunting.",
    "You wake up fluent in the language of birds. What are they saying?",
    "Write a recipe for a perfect lazy Sunday.",
    "The last bookstore on Earth gets one more customer.",
    "Write a letter from you, ten years from now.",
    "Two strangers share an umbrella. Write what neither of them says out loud.",
  ),
  ...p(
    "notice",
    "Look out the nearest window. Write exactly what you see, then one thing you imagine.",
    "Describe your hands and what they've done today.",
    "Write about the sounds around you right now.",
    "Pick a color and write about everywhere you saw it this week.",
    "Describe someone you passed today in three sentences.",
    "What's on your nightstand, and what does it say about you?",
    "Describe your walk or commute as if seeing it for the first time.",
  ),
  ...p(
    "reflect",
    "What's something small that made you happy this week?",
    "Write about something you're looking forward to.",
    "What would you tell a friend on a hard day? Now tell it to yourself.",
    "Something you changed your mind about.",
    "What does home mean to you right now?",
    "A compliment you still remember.",
    "A habit you're proud of, or one you're trying to build.",
    "Something you love that nobody else seems to get.",
  ),
  ...p(
    "poem",
    "Write a poem that starts with \"This morning…\"",
    "Write a love letter to an ordinary object.",
    "A poem made only of questions.",
    "Write about rain without using the word \"rain\".",
    "A poem where every line starts with \"I remember\".",
    "Write an ode to your favorite snack.",
    "Describe a city at 3 a.m.",
    "A poem in the voice of an old tree.",
  ),
  ...p(
    "story",
    "Start with: \"I wasn't supposed to open it, but…\"",
    "End with: \"…and that's why I never eat pancakes on Thursdays.\"",
    "Tell a story as a text message thread.",
    "Start with: \"The note on the fridge said…\"",
    "Two old friends meet after twenty years. One of them is lying.",
    "A small dog is the hero of this story.",
    "A scene that takes place entirely in an elevator.",
    "Start with: \"Nobody in the village had ever seen snow.\"",
    "Someone finds a photo of themselves they don't remember taking.",
    "A story where the twist is that everyone is kind.",
  ),
];

const OPINIONS = PROMPTS.filter((pr) => pr.category === "opinion");
/** A fixed shuffle (same seed for everyone), so the daily order feels random but is shared. */
const DAILY_ORDER = shuffle(OPINIONS, seededRandom("daily-opinions"));

/**
 * Today's prompt: always an opinion prompt, and the same for everyone on the same day so
 * neighbors can compare takes. Walking a shuffled list by day number (instead of picking at
 * random each day) means no repeats until every opinion prompt has had its day.
 */
export function dailyPrompt(date = new Date()): Prompt {
  const [y, m, d] = todayKey(date).split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return DAILY_ORDER[dayNumber % DAILY_ORDER.length];
}

/** Tier-list prompts get a S-to-F skeleton as the writing box's placeholder. */
export const isTierList = (text: string) => /^make a tier list/i.test(text);

export function randomPrompt(except?: string): Prompt {
  let prompt: Prompt;
  do prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  while (prompt.text === except && PROMPTS.length > 1);
  return prompt;
}
