import { type SearchResult, type Venue } from "./evidence";

export function demoSearch(): SearchResult {
  const retrievedAt = new Date().toISOString();
  const report = (excerpt: string, supports = true) => ({
    supports,
    excerpt,
    source: "Illustrative visitor report · fictional demo",
    retrievedAt,
  });
  const make = (
    id: string,
    name: string,
    address: string,
    rating: number,
    evidence: Partial<Venue["evidence"]>,
  ): Venue => ({
    id,
    name,
    address,
    category: "Café · fictional venue",
    rating,
    evidence: { entrance: [], seating: [], restroom: [], ...evidence },
  });
  return {
    mode: "demo",
    location: "Indiranagar, Bengaluru",
    query: "cafés",
    retrievedAt,
    warnings: [],
    venues: [
      make(
        "demo-1",
        "The Open Table",
        "12th Main · Indiranagar · Demo address",
        4.6,
        {
          entrance: [report("The main entrance has a ramp and no steps.")],
          seating: [report("We used a table with space for a wheelchair.")],
          restroom: [
            report("The ground-floor toilet has grab rails and room to turn."),
          ],
        },
      ),
      make(
        "demo-2",
        "Juniper Coffee House",
        "100 Feet Road · Indiranagar · Demo address",
        4.8,
        {
          entrance: [report("There is a step-free side entrance.")],
          seating: [
            report(
              "Wheelchair-accessible tables are available on the ground floor.",
            ),
          ],
        },
      ),
      make(
        "demo-3",
        "Little Courtyard",
        "CMH Road · Indiranagar · Demo address",
        4.5,
        {
          entrance: [
            report("There is a ramp at the front entrance."),
            report("The ramp was removed; there are now two steps.", false),
          ],
          seating: [
            report("There is space for a wheelchair at the courtyard tables."),
          ],
          restroom: [
            report("The only toilet is upstairs, with no lift.", false),
          ],
        },
      ),
      make(
        "demo-4",
        "Paper & Pour",
        "80 Feet Road · Indiranagar · Demo address",
        4.3,
        {
          entrance: [report("The entrance is level with the pavement.")],
          restroom: [
            report("The toilet is upstairs with stair access only.", false),
          ],
        },
      ),
      make(
        "demo-5",
        "Sunday Social Café",
        "Double Road · Indiranagar · Demo address",
        4.7,
        {},
      ),
    ],
  };
}
