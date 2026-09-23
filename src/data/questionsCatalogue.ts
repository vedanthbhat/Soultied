import { Question } from '../types';

export const QUESTIONS_CATALOGUE: Question[] = [
  // 1. Little Joys
  {
    id: 'q-joy-1',
    category: 'Little Joys',
    prompt: 'What would make today feel a little better?',
    options: [
      { id: 'opt-1', text: 'A long call' },
      { id: 'opt-2', text: 'A funny photo' },
      { id: 'opt-3', text: 'A game together' },
      { id: 'opt-4', text: 'Planning our next date' },
    ],
  },
  {
    id: 'q-joy-2',
    category: 'Little Joys',
    prompt: "We've unexpectedly got an hour together. What sounds best?",
    options: [
      { id: 'opt-1', text: 'A slow walk outside' },
      { id: 'opt-2', text: 'Playing a quick co-op game' },
      { id: 'opt-3', text: 'Watching a show together' },
      { id: 'opt-4', text: 'Tea and a long chat' },
    ],
  },
  {
    id: 'q-joy-3',
    category: 'Little Joys',
    prompt: 'Which tiny surprise always brings an instant smile?',
    options: [
      { id: 'opt-1', text: 'A surprise snack delivery' },
      { id: 'opt-2', text: 'An unexpected sweet text' },
      { id: 'opt-3', text: 'A meme saved just for me' },
      { id: 'opt-4', text: 'A song recommendation' },
    ],
  },
  {
    id: 'q-joy-4',
    category: 'Little Joys',
    prompt: 'On a lazy Sunday afternoon, our ideal vibe is:',
    options: [
      { id: 'opt-1', text: 'Reading side-by-side in quiet cozy comfort' },
      { id: 'opt-2', text: 'Baking or cooking something warm' },
      { id: 'opt-3', text: 'Curled under blankets streaming a movie' },
      { id: 'opt-4', text: 'Wandering through a quiet park or cafe' },
    ],
  },
  {
    id: 'q-joy-5',
    category: 'Little Joys',
    prompt: 'What beverage best fits our evening mood right now?',
    options: [
      { id: 'opt-1', text: 'Hot chamomile or peppermint tea' },
      { id: 'opt-2', text: 'Rich dark hot cocoa with marshmallows' },
      { id: 'opt-3', text: 'A sparkling fruit mocktail' },
      { id: 'opt-4', text: 'Ice-cold lemon water' },
    ],
  },
  {
    id: 'q-joy-6',
    category: 'Little Joys',
    prompt: 'When you are having a tiring day, what do you crave most?',
    options: [
      { id: 'opt-1', text: 'A long warm uninterrupted hug' },
      { id: 'opt-2', text: 'Ranting freely while you listen' },
      { id: 'opt-3', text: 'Complete silence and restful company' },
      { id: 'opt-4', text: 'A distraction that makes me laugh out loud' },
    ],
  },

  // 2. Us
  {
    id: 'q-us-1',
    category: 'Us',
    prompt: 'Which little habit of ours feels most "us"?',
    options: [
      { id: 'opt-1', text: 'Our made-up nicknames and slang' },
      { id: 'opt-2', text: 'Sending each other countdowns to seeing each other' },
      { id: 'opt-3', text: 'Sharing random mundane moments of the day' },
      { id: 'opt-4', text: 'Synchronized bedtime or morning greetings' },
    ],
  },
  {
    id: 'q-us-2',
    category: 'Us',
    prompt: 'If our relationship had a seasonal aesthetic, what is it?',
    options: [
      { id: 'opt-1', text: 'Crisp autumn breeze & wool sweaters' },
      { id: 'opt-2', text: 'Golden hour summer evening on a patio' },
      { id: 'opt-3', text: 'Cozy snowy winter fireplace & blankets' },
      { id: 'opt-4', text: 'Fresh sunny spring morning with open windows' },
    ],
  },
  {
    id: 'q-us-3',
    category: 'Us',
    prompt: 'What is our strongest collaborative super-power as a duo?',
    options: [
      { id: 'opt-1', text: 'Calming each other down when stressed' },
      { id: 'opt-2', text: 'Planning exciting adventures and trips' },
      { id: 'opt-3', text: 'Finding humor in awkward situations' },
      { id: 'opt-4', text: 'Encouraging each other’s personal dreams' },
    ],
  },
  {
    id: 'q-us-4',
    category: 'Us',
    prompt: 'What song tempo describes our conversations?',
    options: [
      { id: 'opt-1', text: 'Lofi mellow beats that ease into the night' },
      { id: 'opt-2', text: 'Rapid upbeat indie acoustic banter' },
      { id: 'opt-3', text: 'Warm acoustic folk ballads' },
      { id: 'opt-4', text: 'Eclectic playlist with abrupt hilarious genre jumps' },
    ],
  },
  {
    id: 'q-us-5',
    category: 'Us',
    prompt: 'What was your favorite early memory between us?',
    options: [
      { id: 'opt-1', text: 'The first time we laughed so hard our ribs ached' },
      { id: 'opt-2', text: 'A late-night talk that lasted way past bedtime' },
      { id: 'opt-3', text: 'The moment we realized we had the same niche quirk' },
      { id: 'opt-4', text: 'The look on your face when we first met up' },
    ],
  },
  {
    id: 'q-us-6',
    category: 'Us',
    prompt: 'If we adopted a shared pet together right now, what would it be?',
    options: [
      { id: 'opt-1', text: 'A floppy-eared golden retriever' },
      { id: 'opt-2', text: 'A sleepy loafing calico cat' },
      { id: 'opt-3', text: 'Two tiny bonded guinea pigs' },
      { id: 'opt-4', text: 'A charismatic talking cockatiel' },
    ],
  },

  // 3. Dream Days
  {
    id: 'q-dream-1',
    category: 'Dream Days',
    prompt: 'Our imaginary weekend escape starts where?',
    options: [
      { id: 'opt-1', text: 'By the sea in a breezy cottage' },
      { id: 'opt-2', text: 'In the mountains hiking shaded trails' },
      { id: 'opt-3', text: 'Exploring cafes and museums in a city' },
      { id: 'opt-4', text: 'In a quiet timber cabin with no cell service' },
    ],
  },
  {
    id: 'q-dream-2',
    category: 'Dream Days',
    prompt: 'Our dream road trip playlist would mostly feature:',
    options: [
      { id: 'opt-1', text: '90s and 2000s nostalgic throwback anthems' },
      { id: 'opt-2', text: 'Chill indie folk and melodic guitars' },
      { id: 'opt-3', text: 'True crime or fascinating storytelling podcasts' },
      { id: 'opt-4', text: 'High-energy singalongs and Broadway tunes' },
    ],
  },
  {
    id: 'q-dream-3',
    category: 'Dream Days',
    prompt: 'If we could teleport to dinner anywhere tonight, what is on the table?',
    options: [
      { id: 'opt-1', text: 'Authentic steaming ramen in a Kyoto back-alley' },
      { id: 'opt-2', text: 'Handmade fresh pasta and wine on a Tuscan terrace' },
      { id: 'opt-3', text: 'A bustling night market with skewers and street bites' },
      { id: 'opt-4', text: 'Wood-fired sourdough pizza by the harbor' },
    ],
  },
  {
    id: 'q-dream-4',
    category: 'Dream Days',
    prompt: 'The ultimate vacation morning looks like:',
    options: [
      { id: 'opt-1', text: 'Sleeping in until 11am with zero alarms' },
      { id: 'opt-2', text: 'Waking early to catch the sunrise with bakery pastries' },
      { id: 'opt-3', text: 'Breakfast in bed while plotting the day leisurely' },
      { id: 'opt-4', text: 'A refreshing morning swim before breakfast' },
    ],
  },
  {
    id: 'q-dream-5',
    category: 'Dream Days',
    prompt: 'If we designed our dream home, what is a mandatory cozy feature?',
    options: [
      { id: 'opt-1', text: 'A floor-to-ceiling library wall with a rolling ladder' },
      { id: 'opt-2', text: 'A sunlit kitchen with a giant butcher-block island' },
      { id: 'opt-3', text: 'A screened-in porch with string lights and porch swing' },
      { id: 'opt-4', text: 'A dedicated game room with retro consoles and big couch' },
    ],
  },
  {
    id: 'q-dream-6',
    category: 'Dream Days',
    prompt: 'Which stargazing setting would you choose for us?',
    options: [
      { id: 'opt-1', text: 'Lying in the truck bed with lots of quilts' },
      { id: 'opt-2', text: 'Sitting around a campfire on a sand dune' },
      { id: 'opt-3', text: 'On a rooftop deck with hot tea in our mugs' },
      { id: 'opt-4', text: 'Through the panoramic skylight of a cabin' },
    ],
  },

  // 4. Silly Things
  {
    id: 'q-silly-1',
    category: 'Silly Things',
    prompt: 'In a harmless zombie apocalypse, what is our survival strategy?',
    options: [
      { id: 'opt-1', text: 'Fortifying an IKEA and living off Swedish meatballs' },
      { id: 'opt-2', text: 'Stealing a sailboat and living peacefully offshore' },
      { id: 'opt-3', text: 'Befriending the zombies with sweet music' },
      { id: 'opt-4', text: 'We get taken out in the first 10 minutes because we debated groceries' },
    ],
  },
  {
    id: 'q-silly-2',
    category: 'Silly Things',
    prompt: 'Which reality show would we somehow be hilarious on as partners?',
    options: [
      { id: 'opt-1', text: 'The Amazing Race (frantic airport sprints)' },
      { id: 'opt-2', text: 'Great British Baking Show (collapsing cakes)' },
      { id: 'opt-3', text: 'Escape Room Championship' },
      { id: 'opt-4', text: 'Survivor (negotiating rice for blankets)' },
    ],
  },
  {
    id: 'q-silly-3',
    category: 'Silly Things',
    prompt: 'Who is more likely to accidentally leave their keys behind?',
    options: [
      { id: 'opt-1', text: 'Definitely you' },
      { id: 'opt-2', text: 'Definitely me' },
      { id: 'opt-3', text: 'Both of us equally—we need a leash for keys' },
      { id: 'opt-4', text: 'Neither, we are terrifyingly organized' },
    ],
  },
  {
    id: 'q-silly-4',
    category: 'Silly Things',
    prompt: 'If we opened a bizarre food truck together, our specialty would be:',
    options: [
      { id: 'opt-1', text: 'Over-the-top grilled cheeses with unusual jams' },
      { id: 'opt-2', text: 'Midnight dessert cookies warm from the oven' },
      { id: 'opt-3', text: 'Gourmet loaded French fries with 20 dips' },
      { id: 'opt-4', text: 'Breakfast burritos all day and night' },
    ],
  },
  {
    id: 'q-silly-5',
    category: 'Silly Things',
    prompt: 'When building flat-pack furniture together, what usually happens?',
    options: [
      { id: 'opt-1', text: 'We finish in record time high-fiving like engineers' },
      { id: 'opt-2', text: 'One extra screw remains and we decide not to question it' },
      { id: 'opt-3', text: 'A step is backwards and we have to disassemble the entire thing' },
      { id: 'opt-4', text: 'One person gives orders while the other spins the allen key' },
    ],
  },
  {
    id: 'q-silly-6',
    category: 'Silly Things',
    prompt: 'What kind of video game character are you in our relationship?',
    options: [
      { id: 'opt-1', text: 'The dedicated healer carrying all the snacks' },
      { id: 'opt-2', text: 'The tank who charges in first without looking' },
      { id: 'opt-3', text: 'The scout picking up every useless shiny collectible' },
      { id: 'opt-4', text: 'The wizard reading the walkthrough map' },
    ],
  },

  // 5. Feeling Close
  {
    id: 'q-close-1',
    category: 'Feeling Close',
    prompt: 'Which tiny gesture makes you feel loved most deeply?',
    options: [
      { id: 'opt-1', text: 'Remembering a small detail I mentioned days ago' },
      { id: 'opt-2', text: 'Reaching out just to hear my voice or say you miss me' },
      { id: 'opt-3', text: 'Bringing or making my favorite drink without asking' },
      { id: 'opt-4', text: 'A gentle hand resting on mine during a quiet moment' },
    ],
  },
  {
    id: 'q-close-2',
    category: 'Feeling Close',
    prompt: 'When we are apart, what brings the comforting feeling of home?',
    options: [
      { id: 'opt-1', text: 'Holding something you gave me or wearing your hoodie' },
      { id: 'opt-2', text: 'A quick voice memo hearing your warm laugh' },
      { id: 'opt-3', text: 'Falling asleep on the phone together' },
      { id: 'opt-4', text: 'Opening this shared little pixel space' },
    ],
  },
  {
    id: 'q-close-3',
    category: 'Feeling Close',
    prompt: 'What is something you appreciate about me that I might not know?',
    options: [
      { id: 'opt-1', text: 'The calm and grounding energy you bring when I panic' },
      { id: 'opt-2', text: 'How genuinely passionate and curious you get about topics' },
      { id: 'opt-3', text: 'Your sweet patience and generosity with others' },
      { id: 'opt-4', text: 'How safe and completely myself I feel around you' },
    ],
  },
  {
    id: 'q-close-4',
    category: 'Feeling Close',
    prompt: 'What are you most excited to do together in the upcoming month?',
    options: [
      { id: 'opt-1', text: 'Just sitting together without needing to talk or rush' },
      { id: 'opt-2', text: 'Cooking a new delicious recipe from scratch' },
      { id: 'opt-3', text: 'Going somewhere new we’ve never been before' },
      { id: 'opt-4', text: 'A cozy marathon movie or gaming night' },
    ],
  },
  {
    id: 'q-close-5',
    category: 'Feeling Close',
    prompt: 'What words would you want to hear at the end of a hard day?',
    options: [
      { id: 'opt-1', text: '“You did so well today. I’m proud of you.”' },
      { id: 'opt-2', text: '“I’ve got everything handled now. Just rest.”' },
      { id: 'opt-3', text: '“I love you and I’m right here with you.”' },
      { id: 'opt-4', text: '“Let’s order your comfort food and laugh together.”' },
    ],
  },
  {
    id: 'q-close-6',
    category: 'Feeling Close',
    prompt: 'What makes our connection feel unique compared to anything else?',
    options: [
      { id: 'opt-1', text: 'We can talk about silly nonsense and deep truths in the same breath' },
      { id: 'opt-2', text: 'The unspoken understanding where a single look says everything' },
      { id: 'opt-3', text: 'How comfortable and effortless silence feels between us' },
      { id: 'opt-4', text: 'How we always find our way back to laughter and kindness' },
    ],
  },
];
