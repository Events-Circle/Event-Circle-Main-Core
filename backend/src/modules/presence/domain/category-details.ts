export type DetailField = {
  key: string;
  label: string;
  kind: 'number' | 'select' | 'multi' | 'boolean' | 'text';
  hint: string;
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
};
export type DetailType = { id: string; label: string; categories: string[]; fields: DetailField[] };
export type CategoryDetails = { type: string; values: Record<string, string | number | boolean | string[]> };
export const detailTypes: DetailType[] = [
  {
    id: 'VENUE',
    label: 'Venue',
    categories: ['venue'],
    fields: [
      {
        key: 'seatedCapacity',
        label: 'Seated capacity',
        kind: 'number',
        hint: 'Maximum guests with seating. Leave blank if not confirmed.',
        min: 1,
        max: 100000,
        unit: 'guests',
      },
      {
        key: 'standingCapacity',
        label: 'Standing capacity',
        kind: 'number',
        hint: 'Maximum guests for a standing reception.',
        min: 1,
        max: 100000,
        unit: 'guests',
      },
      {
        key: 'spaceType',
        label: 'Event space',
        kind: 'select',
        hint: 'Choose the spaces available to clients.',
        options: ['Indoor', 'Outdoor', 'Indoor and outdoor'],
      },
      {
        key: 'parking',
        label: 'On-site parking',
        kind: 'boolean',
        hint: 'Is parking available at the venue?',
      },
      {
        key: 'stepFreeAccess',
        label: 'Step-free access',
        kind: 'boolean',
        hint: 'Can guests reach the event space without using stairs?',
      },
      {
        key: 'cateringPolicy',
        label: 'Catering arrangement',
        kind: 'select',
        hint: 'Explain whether clients can bring their own caterer.',
        options: [
          'In-house catering only',
          'External catering allowed',
          'In-house or external catering',
          'No catering facilities',
        ],
      },
    ],
  },
  {
    id: 'PHOTO_VIDEO',
    label: 'Photography & video',
    categories: ['photography', 'videography'],
    fields: [
      {
        key: 'services',
        label: 'Services offered',
        kind: 'multi',
        hint: 'Select all that apply.',
        options: ['Photography', 'Videography', 'Drone coverage', 'Live streaming', 'Photo booth'],
      },
      {
        key: 'styles',
        label: 'Visual styles',
        kind: 'multi',
        hint: 'Help clients understand the style of your work.',
        options: ['Documentary', 'Traditional', 'Editorial', 'Fine art', 'Cinematic'],
      },
      {
        key: 'deliveryDays',
        label: 'Typical delivery time',
        kind: 'number',
        hint: 'Typical calendar days after the event. Confirm the exact timeline in your agreement.',
        min: 1,
        max: 365,
        unit: 'days',
      },
      {
        key: 'travels',
        label: 'Travel outside your city',
        kind: 'boolean',
        hint: 'Are you available for events outside your base city?',
      },
    ],
  },
  {
    id: 'CATERING',
    label: 'Catering',
    categories: ['catering'],
    fields: [
      {
        key: 'minimumGuests',
        label: 'Minimum guest count',
        kind: 'number',
        hint: 'Smallest event you usually cater for.',
        min: 1,
        max: 100000,
        unit: 'guests',
      },
      {
        key: 'maximumGuests',
        label: 'Maximum guest count',
        kind: 'number',
        hint: 'Largest event you can serve.',
        min: 1,
        max: 100000,
        unit: 'guests',
      },
      {
        key: 'serviceStyles',
        label: 'Service styles',
        kind: 'multi',
        hint: 'Select all the formats you provide.',
        options: ['Buffet', 'Plated dining', 'Food stations', 'Cocktail reception', 'Delivery only'],
      },
      {
        key: 'dietaryOptions',
        label: 'Dietary options',
        kind: 'multi',
        hint: 'Select only options you can provide. Clients should confirm specific allergy requirements directly.',
        options: ['Vegetarian', 'Vegan', 'Halal', 'Gluten-free options', 'Dairy-free options'],
      },
    ],
  },
  {
    id: 'ENTERTAINMENT',
    label: 'Entertainment & DJs',
    categories: ['entertainment', 'dj'],
    fields: [
      {
        key: 'acts',
        label: 'Entertainment offered',
        kind: 'multi',
        hint: 'Select the types of performance you offer.',
        options: [
          'DJ',
          'Live band',
          'Solo musician',
          'MC / host',
          'Dance performance',
          'Children’s entertainment',
          'Other performance',
        ],
      },
      {
        key: 'performanceMinutes',
        label: 'Typical performance duration',
        kind: 'number',
        hint: 'Typical total performance time; package durations can differ.',
        min: 1,
        max: 1440,
        unit: 'minutes',
      },
      {
        key: 'setupMinutes',
        label: 'Setup time needed',
        kind: 'number',
        hint: 'How long do you need before the performance? Zero means no setup time.',
        min: 0,
        max: 1440,
        unit: 'minutes',
      },
      {
        key: 'equipmentIncluded',
        label: 'Own performance equipment provided',
        kind: 'boolean',
        hint: 'Do you bring the equipment needed for your performance?',
      },
    ],
  },
  {
    id: 'GENERAL',
    label: 'Other event services',
    categories: [],
    fields: [
      {
        key: 'specialties',
        label: 'Specialties',
        kind: 'text',
        hint: 'Describe the specific services you offer, for example floral installations or event lighting.',
        max: 500,
      },
      {
        key: 'eventTypes',
        label: 'Events you serve',
        kind: 'multi',
        hint: 'Select all that apply.',
        options: [
          'Weddings',
          'Engagements',
          'Corporate events',
          'Birthdays',
          'Private parties',
          'Public events',
        ],
      },
      {
        key: 'travels',
        label: 'Travel outside your city',
        kind: 'boolean',
        hint: 'Are you available for events outside your base city?',
      },
    ],
  },
];
export function validateCategoryDetails(input: unknown): CategoryDetails {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Choose a valid details type.');
  const data = input as CategoryDetails;
  if (Object.keys(data).some((key) => !['type', 'values'].includes(key)))
    throw new Error('Unknown category-details property.');
  const schema = detailTypes.find((type) => type.id === data.type);
  if (!schema || !data.values || typeof data.values !== 'object' || Array.isArray(data.values))
    throw new Error('Choose a valid details type and fields.');
  const values: CategoryDetails['values'] = {};
  for (const [key, value] of Object.entries(data.values)) {
    const field = schema.fields.find((item) => item.key === key);
    if (!field) throw new Error('A field does not belong to the selected details type.');
    if (
      field.kind === 'number' &&
      (typeof value !== 'number' || !Number.isInteger(value) || value < field.min! || value > field.max!)
    )
      throw new Error(`${field.label} must be a whole number from ${field.min} to ${field.max}.`);
    if (field.kind === 'boolean' && typeof value !== 'boolean')
      throw new Error(`${field.label} must be yes or no.`);
    if (field.kind === 'select' && (typeof value !== 'string' || !field.options!.includes(value)))
      throw new Error(`Choose a valid ${field.label.toLowerCase()}.`);
    if (
      field.kind === 'multi' &&
      (!Array.isArray(value) ||
        value.length > field.options!.length ||
        new Set(value).size !== value.length ||
        value.some((item) => !field.options!.includes(item)))
    )
      throw new Error(`Choose valid ${field.label.toLowerCase()}.`);
    if (field.kind === 'text' && (typeof value !== 'string' || value.length > field.max!))
      throw new Error(`${field.label} must be at most ${field.max} characters.`);
    // Empty answers are omitted; explicit false and zero are retained.
    if ((typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)) continue;
    values[key] = typeof value === 'string' ? value.trim() : value;
  }
  if (
    typeof values.minimumGuests === 'number' &&
    typeof values.maximumGuests === 'number' &&
    values.minimumGuests > values.maximumGuests
  )
    throw new Error('Maximum guest count must be at least the minimum guest count.');
  return { type: schema.id, values };
}
