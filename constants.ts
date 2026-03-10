
import { Product } from './types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'set-sky-blue',
    name: 'Sky Blue Yoga Set',
    imageUrl: 'https://superbeautiful.de/thumbnail/39/d5/84/1688393421/produktfotoskyblue5_800x800.png',
    description: 'Dein sky-blue Set mit High-Neck Crop Top und perfekt sitzenden Leggings für maximale Bewegungsfreiheit.'
  },
  {
    id: 'set-maroon',
    name: 'Maroon Performance Set',
    imageUrl: 'https://superbeautiful.de/thumbnail/d1/a6/9f/1688394345/produktfotored1_800x800.png',
    description: 'Das exklusive Maroon Set kombiniert Style mit Performance. Atmungsaktiv und blickdicht.'
  },
  {
    id: 'set-black',
    name: 'Midnight Black Set',
    imageUrl: 'https://superbeautiful.de/thumbnail/b2/e7/77/1688394134/produktfotoblack6_800x800.png',
    description: 'Der Klassiker in Midnight Black. Zeitloses Design für jedes Workout und den Alltag.'
  },
  {
    id: 'set-swimsuit-white',
    name: 'White One-Piece Swimsuit',
    imageUrl: 'https://superbeautiful.de/thumbnail/d1/55/84/1708106989/all-over-print-one-piece-swimsuit-white-front-65cfa37e1de4e_800x800.png',
    description: 'Dein eleganter weißer Einteiler für den perfekten Sommerlook am Pool oder Strand.'
  }
];

export const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const APP_CONFIG = {
  TEXT_MODEL: 'gemini-3-flash-preview',
  IMAGE_MODEL: 'gemini-2.5-flash-image',
};
