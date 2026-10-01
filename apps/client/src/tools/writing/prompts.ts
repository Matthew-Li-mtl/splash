import { seededRandom, todayKey } from "../../lib/util";

export interface Prompt {
  text: string;
  category: "memory" | "imagine" | "notice" | "reflect" | "poem" | "story";
}

const p = (category: Prompt["category"], ...texts: string[]): Prompt[] => texts.map((text) => ({ text, category }));

export const PROMPTS: Prompt[] = [
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

/** Same prompt for everyone on the same day, so neighbors can compare takes. */
export function dailyPrompt(date = new Date()): Prompt {
  const rand = seededRandom(`prompt-${todayKey(date)}`);
  return PROMPTS[Math.floor(rand() * PROMPTS.length)];
}

export function randomPrompt(except?: string): Prompt {
  let prompt: Prompt;
  do prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  while (prompt.text === except && PROMPTS.length > 1);
  return prompt;
}
