/**
 * 30 days of knowing each other: one question a day, five chapters of six,
 * each a little deeper than the last. Every question has four answers (easier
 * than a blank box), you guess which one your person picked, and you can add
 * a line if you want to say more.
 *
 * Written to work for any couple, anywhere.
 */

export interface JourneyChapter {
  title: string;
  /** a line under the title */
  blurb: string;
  questions: Array<[string, string, string, string, string]>;
}

export const JOURNEY: JourneyChapter[] = [
  {
    title: 'Little things',
    blurb: 'The small stuff that makes you, you.',
    questions: [
      ['What makes an ordinary day better?', 'A really good meal', 'A message from you', 'Getting things done', 'Time alone to recharge'],
      ['Your perfect lazy Sunday?', 'Sleeping in, no plans', 'Brunch and a long walk', 'A film marathon in bed', 'A little adventure somewhere new'],
      ['What are you quietly good at?', 'Remembering small details', 'Making people laugh', 'Fixing things', 'Listening'],
      ['How do you recharge after a long week?', 'Alone, in silence', 'Out with friends', 'Doing something active', 'Bed and a good show'],
      ['Which of my habits do you secretly love?', 'The way I text you', 'My laugh', 'How excited I get about things', 'My little routines'],
      ['One free day together, anywhere. Where are we?', 'A beach far away', 'A big city we’ve never seen', 'A cabin in the mountains', 'Home, phones off'],
    ],
  },
  {
    title: 'Your story',
    blurb: 'Where you come from, and what shaped you.',
    questions: [
      ['What did you love most as a kid?', 'Being outdoors', 'Books and stories', 'Drawing or making things', 'Games with friends'],
      ['Who shaped you most growing up?', 'A parent', 'A grandparent', 'A friend', 'A teacher or mentor'],
      ['What did home feel like when you were little?', 'Loud and busy', 'Calm and quiet', 'Warm but strict', 'It changed a lot'],
      ['What shaped who you are the most?', 'A hard time I got through', 'Someone I met', 'A place I lived', 'A choice I made'],
      ['Before you’d been in love, what did you think love was?', 'Fireworks and butterflies', 'Something from the movies', 'Comfort and feeling safe', 'I didn’t really believe in it'],
      ['What did you dream of becoming?', 'Something creative', 'Someone who helps people', 'Rich and successful', 'I had no idea'],
    ],
  },
  {
    title: 'Us',
    blurb: 'How you found each other, and how you love.',
    questions: [
      ['What did you first notice about me?', 'Your smile', 'Your voice', 'How easy you were to talk to', 'Your sense of humour'],
      ['When did you know this was more than a crush?', 'Our first long conversation', 'The first time I missed you', 'When you were there on a bad day', 'It crept up slowly'],
      ['What makes you feel most loved by me?', 'You telling me', 'Time together, even on a call', 'Little surprises and notes', 'You showing up for me'],
      ['When we disagree, what helps you most?', 'Talking it out right away', 'A little space first', 'Hearing that we’re okay', 'A hug, or a call, first'],
      ['What’s the hardest part of the distance?', 'Missing the everyday moments', 'Time zones and schedules', 'Not being able to touch', 'Not knowing when we’ll next meet'],
      ['What do you never want us to lose?', 'How we laugh together', 'Our honesty', 'Feeling like a team', 'Our little rituals'],
    ],
  },
  {
    title: 'Inside',
    blurb: 'The things you don’t say out loud very often.',
    questions: [
      ['Which fear do you carry most?', 'Not being enough', 'Losing people I love', 'Failing at what matters', 'Being misunderstood'],
      ['When do you feel most like yourself?', 'Alone with my thoughts', 'With the people I love', 'Making or building something', 'Out in nature'],
      ['What do you regret most?', 'Things I didn’t say', 'Chances I didn’t take', 'People I hurt', 'Time I spent worrying'],
      ['What are you proud of that few people know?', 'Something I got through', 'Something I taught myself', 'Someone I helped', 'How much I’ve changed'],
      ['What are you still learning to accept about yourself?', 'How I look', 'How deeply I feel things', 'My mistakes', 'That I can’t please everyone'],
      ['When you’re struggling, what helps most?', 'Being asked how I really am', 'Being made to laugh', 'Space until I’m ready', 'Help fixing the problem'],
    ],
  },
  {
    title: 'Big questions',
    blurb: 'Life, meaning, and the two of you, later.',
    questions: [
      ['What makes a life well lived?', 'Love and close people', 'Adventure and new things', 'Making a difference', 'Peace and contentment'],
      ['If you had one year left, what would you do first?', 'See the world', 'Spend it with the people I love', 'Finish something that matters', 'Change nothing, just savour it'],
      ['How do you want to be remembered?', 'As kind', 'As brave', 'As someone who made people laugh', 'As someone who made things better'],
      ['What do you think happens after we die?', 'Something of us goes on', 'We come back, somehow', 'Nothing, and that’s okay', 'I don’t know, and I wonder'],
      ['Ten years from now, where are we?', 'A quiet home with a garden', 'A big, busy city', 'Travelling the world', 'Anywhere, as long as it’s together'],
      ['What has this month shown you about us?', 'We know each other well', 'There’s so much left to discover', 'We want the same things', 'I’m luckier than I knew'],
    ],
  },
];

export const JOURNEY_DAYS = JOURNEY.reduce((n, c) => n + c.questions.length, 0);
