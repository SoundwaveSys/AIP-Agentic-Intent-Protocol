const commerceCatalog = [
  // -------------------------
  // LAPTOPS
  // -------------------------
  {
    id: "lap-001",
    store: "Amazon",
    name: "ASUS Vivobook 15",
    category: "laptop",
    useCases: ["coding", "work"],
    price: 74999,
    rating: 4.6,
    delivery: "Tomorrow",
    badge: "Best match"
  },

  {
    id: "lap-002",
    store: "Flipkart",
    name: "Lenovo IdeaPad Slim",
    category: "laptop",
    useCases: ["coding", "work"],
    price: 69999,
    rating: 4.4,
    delivery: "Monday",
    badge: "Best value"
  },

  {
    id: "lap-003",
    store: "ASUS",
    name: "ASUS Vivobook Go",
    category: "laptop",
    useCases: ["coding", "work"],
    price: 61490,
    rating: 4.3,
    delivery: "Tuesday",
    badge: "Budget pick"
  },

  {
    id: "lap-004",
    store: "Amazon",
    name: "Acer Aspire 5",
    category: "laptop",
    useCases: ["coding", "work"],
    price: 82990,
    rating: 4.5,
    delivery: "Wednesday",
    badge: "Performance"
  },

  {
    id: "lap-005",
    store: "Flipkart",
    name: "HP Pavilion Gaming",
    category: "laptop",
    useCases: ["gaming", "coding"],
    price: 77990,
    rating: 4.5,
    delivery: "Tomorrow",
    badge: "Gaming"
  },


  // -------------------------
  // AUDIO
  // -------------------------
  {
    id: "aud-001",
    store: "Amazon",
    name: "Sony WH-CH520",
    category: "audio",
    useCases: ["work", "music"],
    price: 4490,
    rating: 4.5,
    delivery: "Tomorrow",
    badge: "Best match"
  },

  {
    id: "aud-002",
    store: "Flipkart",
    name: "JBL Tune 770NC",
    category: "audio",
    useCases: ["music", "work"],
    price: 4999,
    rating: 4.4,
    delivery: "Monday",
    badge: "Best value"
  },

  {
    id: "aud-003",
    store: "Amazon",
    name: "boAt Rockerz 550",
    category: "audio",
    useCases: ["music", "work"],
    price: 1999,
    rating: 4.3,
    delivery: "Tomorrow",
    badge: "Budget pick"
  },


  // -------------------------
  // PHONES
  // -------------------------
  {
    id: "phone-001",
    store: "Amazon",
    name: "Google Pixel 9a",
    category: "phone",
    useCases: ["work", "photography"],
    price: 49999,
    rating: 4.5,
    delivery: "Tomorrow",
    badge: "Best match"
  },

  {
    id: "phone-002",
    store: "Flipkart",
    name: "Samsung Galaxy S25",
    category: "phone",
    useCases: ["work", "photography", "gaming"],
    price: 74999,
    rating: 4.6,
    delivery: "Monday",
    badge: "Premium"
  },

  {
    id: "phone-003",
    store: "Amazon",
    name: "OnePlus 13R",
    category: "phone",
    useCases: ["gaming", "work"],
    price: 42999,
    rating: 4.5,
    delivery: "Tomorrow",
    badge: "Best value"
  },


  // -------------------------
  // SHOES
  // -------------------------
  {
    id: "shoe-001",
    store: "Nike",
    name: "Nike Revolution 7",
    category: "shoes",
    useCases: ["running"],
    price: 3995,
    rating: 4.5,
    delivery: "Tomorrow",
    badge: "Best match"
  },

  {
    id: "shoe-002",
    store: "Adidas",
    name: "Adidas Duramo SL",
    category: "shoes",
    useCases: ["running"],
    price: 3499,
    rating: 4.4,
    delivery: "Monday",
    badge: "Best value"
  },

  {
    id: "shoe-003",
    store: "Amazon",
    name: "ASICS Gel Contend",
    category: "shoes",
    useCases: ["running"],
    price: 4799,
    rating: 4.6,
    delivery: "Tomorrow",
    badge: "Performance"
  }
];


// ------------------------------------
// SEARCH COMMERCE CATALOG
// ------------------------------------

export function searchCommerce(intent) {
  if (!intent) {
    return [];
  }

  const maximum = intent.budget?.maximum;

  let matches = commerceCatalog.filter(product => {

    // Category must match
    if (product.category !== intent.category) {
      return false;
    }

    // Budget must match when provided
    if (
      maximum !== null &&
      maximum !== undefined &&
      product.price > maximum
    ) {
      return false;
    }

    return true;
  });


  // ------------------------------------
  // Calculate intent match
  // ------------------------------------

  matches = matches.map(product => {

    let match = 80;

    // Use case match
    if (
      intent.useCase &&
      product.useCases.includes(intent.useCase)
    ) {
      match += 15;
    }

    // Price efficiency
    if (
      maximum &&
      product.price <= maximum
    ) {
      const savings =
        ((maximum - product.price) / maximum) * 100;

      if (savings >= 10) {
        match += 5;
      }
    }

    return {
      ...product,
      match: Math.min(match, 100)
    };
  });


  // ------------------------------------
  // Best matches first
  // ------------------------------------

  matches.sort((a, b) => {
    return b.match - a.match;
  });


  // Return top 3
  return matches.slice(0, 3);
}