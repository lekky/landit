/**
 * How Land The Trick came to exist, told by the rider whose idea it was.
 *
 * **This is an interview, not copy.** Every line here was said by Miles in
 * September 2026 and edited only for length and order; where a sentence is a
 * rewrite rather than a transcription it is because two of his answers were one
 * thought split across a follow-up question. Two lines are his exactly and
 * should not be tidied by anybody later — "I didn't decide to. I just went."
 * and "be brave. It'll be fine." They are the reason the page works.
 *
 * **What is deliberately not here**, agreed with the owner before it was
 * written (Rachid, 2026-09-04, in chat): no surname, no school, no home area,
 * no sister's name, and no home park beyond Greystone in Manchester — which is
 * a public indoor park and a destination, not an address. A story page on a
 * product used by children is exactly the page where an identifying detail
 * would get added without anybody meaning to. If a future session adds a fact
 * here, that is the list to check it against.
 *
 * **The ramp photos are the rider's own garden.** They were cleared on the same
 * basis: a hedge, some grass and a basketball hoop say nothing about where it
 * is. Do not replace them with a shot that has a house number, a street or a
 * school uniform in it.
 *
 * This is not the same page as `/legal/about`, which is the factual one — what
 * the product is, how it makes money, who to email. That page answers "what is
 * this"; this one answers "why does it exist", and the two link to each other
 * rather than being merged.
 */

/** A photo. `src` is unset while the picture is still to be taken. */
export type StoryPhoto = {
  /** Shown inside the placeholder frame while there is no `src`. */
  label: string;
  /** Public path, once the file exists. */
  src?: string;
  /** Required once `src` is set — the page will not render an undescribed photo. */
  alt?: string;
};

export type StoryBlock =
  | { kind: 'p'; text: string }
  /** The opening line of a chapter, set heavier than the paragraphs under it. */
  | { kind: 'lead'; text: string }
  /** A pulled line. `big` is for the two that carry the page. */
  | { kind: 'quote'; text: string; big?: boolean }
  | { kind: 'photos'; items: readonly StoryPhoto[] };

export type StoryChapter = {
  id: string;
  heading?: string;
  blocks: readonly StoryBlock[];
};

export const STORY_TITLE = 'I couldn’t find a website like this. So we made one.';
export const STORY_BYLINE = 'Miles, 12, scooter';
export const STORY_UPDATED = 'September 2026';
export const STORY_DESCRIPTION =
  'Miles is 12, rides a scooter, and could not find anywhere to keep track of the tricks he had landed. So he and his dad built one.';

export const STORY: readonly StoryChapter[] = [
  {
    id: 'start',
    blocks: [
      { kind: 'lead', text: 'I wanted to be a mountain biker because of a video game.' },
      {
        kind: 'p',
        text: 'I was playing Descenders, and it looked so cool that I wanted to try it in real life. I stuck at it for a couple of months and I wasn’t really getting any better — and a good mountain bike costs a lot more than a skateboard or a scooter does.',
      },
      {
        kind: 'p',
        text: 'So I tried skateboarding instead, and went to some skate parks for a bit.',
      },
      {
        kind: 'p',
        text: 'Then I found Greystone, in Manchester. I only found it because I wanted to skateboard and my sister wanted to do gymnastics, and Greystone did both — so it was the one place that worked for the two of us.',
      },
      {
        kind: 'p',
        text: 'While I was there I borrowed one of their scooters. That was it, really. I started having lessons, and I got my own for Christmas — a 2 Bare Feet.',
      },
    ],
  },
  {
    id: 'dropping-in',
    heading: 'The first trick I learned was dropping in',
    blocks: [
      {
        kind: 'p',
        text: 'It took me about 20 tries, because it’s scary at the top. People tell you to just go, and you stand there, and you don’t go.',
      },
      { kind: 'quote', text: 'Then on one of them I went. I didn’t decide to. I just went.' },
    ],
  },
  {
    id: 'the-ramp',
    heading: 'Then I built a ramp in my garden',
    blocks: [
      {
        kind: 'p',
        text: 'I couldn’t keep going to Greystone all the time. You can’t go every day — it’s quite expensive, and my parents aren’t free to take me every day anyway.',
      },
      {
        kind: 'p',
        text: 'So I thought: what’s a way where I can still practise, and then just go and do it whenever I want?',
      },
      { kind: 'quote', text: 'I thought, oh. I should probably build a ramp.' },
      {
        kind: 'p',
        text: 'My birthday was coming up, so that’s what I asked for, and my grandad gave it to me as my present. He’s a builder and he still works, and he helped me do it. We built it over a few weeks, on and off, and then it was done. It’s about seven metres long and two metres wide, in the garden.',
      },
      { kind: 'p', text: 'Then my mum painted my name on it, in graffiti, as a surprise.' },
      {
        kind: 'photos',
        items: [
          {
            label: 'The ramp — photo to come',
            alt: 'The ramp Miles built in his garden, with his name painted across the flat in silver graffiti',
          },
          {
            label: 'The ramp from the deck — photo to come',
            alt: 'The same ramp seen from the top of the deck, looking down the transition',
          },
        ],
      },
      { kind: 'p', text: 'How much I ride it depends on the northern weather.' },
    ],
  },
  {
    id: 'since-then',
    heading: 'Since then',
    blocks: [
      {
        kind: 'p',
        text: 'The tailwhip took me ages. I can backflip on the mega ramp — I learned it into the foam pit first, then landed it on the real one. Right now I’m trying to get a fingerwhip. I’m really close. I just can’t land it.',
      },
      {
        kind: 'p',
        text: 'I’ve been lucky so far. The worst thing I’ve done is trap my finger under my scooter.',
      },
    ],
  },
  {
    id: 'why',
    blocks: [
      {
        kind: 'quote',
        big: true,
        text: 'Then I couldn’t remember what tricks I had learnt, or wanted to learn next.',
      },
      {
        kind: 'p',
        text: 'So I went looking for a website where you could tick off scooter tricks. A trick tracker. I searched, and there wasn’t one.',
      },
      {
        kind: 'p',
        text: 'And I thought: scooter is really popular. Why has nobody made this yet?',
      },
    ],
  },
  {
    id: 'so-we-made-it',
    heading: 'So we made it',
    blocks: [
      {
        kind: 'p',
        text: 'My dad Rachid did the coding. I had the idea, and I did the design, and I know the tricks — which sounds like the easy part and wasn’t.',
      },
      {
        kind: 'p',
        text: 'The hardest bit of the whole thing was the tricks themselves. Getting the names right. Getting them in the right order, so a beginner isn’t looking at something impossible and someone good isn’t bored. Loads of it kept going wrong.',
      },
      {
        kind: 'p',
        text: 'It’s for the scooter community. That’s who it’s for. I made it so people can track what they’ve landed and find the next thing to learn.',
      },
    ],
  },
  {
    id: 'be-brave',
    blocks: [
      {
        kind: 'quote',
        big: true,
        text: 'If you’re stuck on your first trick: be brave. It’ll be fine.',
      },
    ],
  },
  {
    id: 'a-year',
    heading: 'In a year?',
    blocks: [
      {
        kind: 'p',
        text: 'I reckon I’ll be a lot better at riding. And I hope the site is better too, and more people have used it to track their tricks and learn new ones.',
      },
      {
        kind: 'photos',
        items: [
          {
            label: 'Miles at Greystone — photo to come',
            alt: 'Miles riding his scooter at Greystone',
          },
        ],
      },
    ],
  },
];
