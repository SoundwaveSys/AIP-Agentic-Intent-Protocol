
const travelOptions = [
  {
    id: "travel-de-001",
    destination: "Germany",
    type: "international-trip",
    estimatedBudget: 100000,
    currency: "INR",
    durationDays: 7,
    highlights: [
      "Berlin city exploration",
      "Munich sightseeing",
      "Neuschwanstein Castle day trip"
    ],
    note: "Illustrative itinerary and budget, not live travel pricing."
  },
  {
    id: "travel-de-002",
    destination: "Germany",
    type: "international-trip",
    estimatedBudget: 75000,
    currency: "INR",
    durationDays: 5,
    highlights: [
      "Berlin landmarks",
      "Museum Island",
      "Local food and culture"
    ],
    note: "Illustrative itinerary and budget, not live travel pricing."
  }
];

export function planTravel(intent) {
  if (!intent || intent.category !== "travel") {
    return [];
  }

  const destinationMatch =
    intent.rawCommand?.toLowerCase().includes("germany") ||
    intent.rawCommand?.toLowerCase().includes("german");

  if (!destinationMatch) {
    return [];
  }

  const maximum = intent.budget?.maximum;

  return travelOptions
    .filter(option => {
      return maximum == null || option.estimatedBudget <= maximum;
    })
    .map(option => ({
      ...option,
      match: 90
    }));
}
