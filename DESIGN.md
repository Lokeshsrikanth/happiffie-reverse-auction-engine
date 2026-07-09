# Happiffie Reverse Auction System — Technical Design Document

* **GitHub Repository**: [happiffie-reverse-auction-engine](https://github.com/Lokeshsrikanth/happiffie-reverse-auction-engine.git)
* **Live Application URL**: [happiffie-reverse-auction-engine.onrender.com](https://happiffie-reverse-auction-engine.onrender.com)

---

## 1. Problem Understanding & Key Challenges

A reverse auction system allows event clients to post their service requirements (e.g., Catering, Decoration) and lets qualified vendors compete in real-time by submitting downward bids (price + pitch). 

### Key Challenges:
1. **Bid Sniping (Last-Second Bids)**: 
   * *Risk*: Vendors wait until the last second to bid slightly below the lowest bid, preventing others from responding and locking clients into suboptimal late deals.
   * *Solution*: Implemented a **Timing Penalty** in the ranking formula. Bids placed earlier receive a higher score boost, whereas bids placed near the deadline are penalized (score boost falls to 0).
2. **Vendor Collusion Risk**:
   * *Risk*: Competitors coordinate to keep bid prices artificially high.
   * *Solution*: Vendor names and specific pitches are kept confidential or masked from *other vendors* (the Vendor Portal only shows the budget limit and count of current bids, but hides competing pitches/prices from competitors). Only the event Client can view the full ranked bid details.
3. **Ensuring Genuine Price Competition**:
   * *Risk*: Disclosing the full budget upfront leads to "budget anchoring" where all vendors bid near or exactly at the budget.
   * *Solution*: The system allows bids to meet or exceed budget, but heavily penalizes any bid above the budget limit inside the ranking score (negative price factor).
4. **Balancing Price against Quality**:
   * *Risk*: Relying purely on price can lead to low-quality/unprofessional vendors winning.
   * *Solution*: Multi-factor ranking that incorporates vendor ratings (30%) and historical response rates/volume (15%), ensuring that premium, highly responsive vendors score well even if their price is slightly higher.

---

## 2. Assumptions
1. Bids are binding once submitted by the vendor.
2. Only one bid can be active per vendor, per requirement (if a vendor bids again, it updates their previous bid).
3. The deadline is determined relative to the creation time (defaults to 24 hours, but customizable via the API).
4. Bids received after the deadline are strictly rejected at the database/API layer.

---

## 3. User Journey
1. **Requirement Posted**: Client posts an event requirement (e.g. "Wedding Decorator, Chennai, 500 guests, budget ₹5L, traditional theme") with an auction close time.
2. **Vendors Notified**: Vendors see the requirement on their portal.
3. **Bids Submitted**: Qualified vendors submit competing bids containing a price and a short pitch.
4. **Auction Closes**: The system automatically transitions requirement status when deadline passes.
5. **Bids Ranked**: Bids are dynamically ranked using the multi-factor scoring formula.
6. **User Reviews & Accepts**: Client reviews the ranked list and clicks "Accept Bid" on one, closing the auction.

---

## 4. Database Schema (Prisma)

The active entities used in this prototype are defined in the schema as follows:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum RequirementStatus {
  OPEN
  CLOSED
  ACCEPTED
}

enum BidStatus {
  PENDING
  ACCEPTED
  REJECTED
}

model Requirement {
  id          String            @id @default(uuid())
  title       String
  description String
  category    String
  location    String
  guestCount  Int
  budget      Float
  theme       String
  deadline    DateTime
  status      RequirementStatus @default(OPEN)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  bids        Bid[]
  result      AuctionResult?
}

model Vendor {
  id            String   @id @default(uuid())
  name          String
  category      String
  rating        Float    // 1.0 to 5.0
  responseRate  Float    // 0.0 to 1.0
  responseCount Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  bids          Bid[]
}

model Bid {
  id            String      @id @default(uuid())
  requirementId String
  requirement   Requirement @relation(fields: [requirementId], references: [id], onDelete: Cascade)
  vendorId      String
  vendor        Vendor      @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  price         Float
  pitch         String
  rankScore     Float
  status        BidStatus   @default(PENDING)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model AuctionResult {
  id            String      @id @default(uuid())
  requirementId String      @unique
  requirement   Requirement @relation(fields: [requirementId], references: [id], onDelete: Cascade)
  acceptedBidId String
  totalBids     Int
  winningPrice  Float
  savings       Float
  closedAt      DateTime    @default(now())
  createdAt     DateTime    @default(now())
}
```

---

## 5. API Design

The following routes are fully implemented and verified:

### 1. `GET /api/requirements`
* **Description**: List all requirements with their bids.
* **Example Live Response**:
```json
[
  {
    "id": "592351bc-dd20-47ea-ada7-a5ce78992301",
    "title": "Wedding Decorator, Chennai",
    "description": "Traditional theme wedding decoration for 500 guests.",
    "category": "decor",
    "location": "Chennai",
    "guestCount": 500,
    "budget": 500000,
    "theme": "Traditional",
    "deadline": "2026-07-10T05:43:00.370Z",
    "status": "OPEN",
    "createdAt": "2026-07-09T05:43:00.370Z",
    "updatedAt": "2026-07-09T05:43:00.371Z",
    "bids": [
      {
        "id": "9ae09804-3dea-4d19-b85a-e7c952bc009f",
        "requirementId": "592351bc-dd20-47ea-ada7-a5ce78992301",
        "vendorId": "82ed84b5-c8d4-48f8-87b4-06f53d0824d8",
        "price": 480000,
        "pitch": "Elite floral and traditional decors with premium imported marigolds and roses. We have 10+ years experience in South Indian weddings.",
        "rankScore": 0.7998,
        "status": "PENDING",
        "createdAt": "2026-07-09T06:43:00.370Z",
        "updatedAt": "2026-07-09T05:43:00.614Z"
      },
      {
        "id": "79778114-ac4b-4803-adfe-6fb9fb7776c6",
        "requirementId": "592351bc-dd20-47ea-ada7-a5ce78992301",
        "vendorId": "46aadf4f-c3dd-4994-aee1-357833ec3a39",
        "price": 390000,
        "pitch": "Best price traditional setup with high-quality artificial and fresh flower mix. Customizable lighting layout included.",
        "rankScore": 0.782,
        "status": "PENDING",
        "createdAt": "2026-07-09T07:43:00.370Z",
        "updatedAt": "2026-07-09T05:43:00.734Z"
      },
      {
        "id": "f88f654e-9bcd-4f94-8911-87b8171a7ef6",
        "requirementId": "592351bc-dd20-47ea-ada7-a5ce78992301",
        "vendorId": "2dac7707-b17c-4c12-a95b-ac4c186c30b2",
        "price": 450000,
        "pitch": "Stunning LED light backdrop, traditional kolam entrance, and stage floral arrangements. Full setup & cleanup included.",
        "rankScore": 0.7677,
        "status": "PENDING",
        "createdAt": "2026-07-09T09:43:00.370Z",
        "updatedAt": "2026-07-09T05:43:00.794Z"
      },
      {
        "id": "3e2c9e93-3fb8-4dcd-a642-1e24682bd1a1",
        "requirementId": "592351bc-dd20-47ea-ada7-a5ce78992301",
        "vendorId": "6456e552-86b0-4dd4-8575-a096945231dc",
        "price": 520000,
        "pitch": "Absolute royal experience, custom wooden carved mandapam, standard high-grade fresh flowers.",
        "rankScore": 0.4034,
        "status": "PENDING",
        "createdAt": "2026-07-10T04:43:00.370Z",
        "updatedAt": "2026-07-09T05:43:00.855Z"
      },
      {
        "id": "9fd0782d-440e-424d-96ca-3024f424c749",
        "requirementId": "592351bc-dd20-47ea-ada7-a5ce78992301",
        "vendorId": "7a317623-920f-4e41-9bc5-7876de3e84af",
        "price": 495000,
        "pitch": "We are very new and still learning the ropes, but we can do a basic job for you near budget ceiling.",
        "rankScore": 0.4631,
        "status": "PENDING",
        "createdAt": "2026-07-10T05:38:00.370Z",
        "updatedAt": "2026-07-09T05:43:00.915Z"
      }
    ],
    "result": null
  }
]
```

### 2. `POST /api/requirements`
* **Description**: Create a new event requirement.
* **Example Request**:
```json
{
  "title": "Wedding Decorator, Chennai Test",
  "description": "My test desc",
  "category": "decor",
  "location": "Chennai",
  "guestCount": 500,
  "budget": 500000,
  "theme": "Traditional",
  "hoursToClose": 24
}
```
* **Example Response**:
```json
{
  "id": "5b7eee40-ae98-42a5-ae40-c61ac06f1c3a",
  "title": "Wedding Decorator, Chennai Test",
  "description": "My test desc",
  "category": "decor",
  "location": "Chennai",
  "guestCount": 500,
  "budget": 500000,
  "theme": "Traditional",
  "deadline": "2026-07-10T03:57:56.448Z",
  "status": "OPEN",
  "createdAt": "2026-07-09T03:57:56.448Z",
  "updatedAt": "2026-07-09T03:57:56.449Z"
}
```

### 3. `POST /api/requirements/:id/bids`
* **Description**: Submit a bid for a requirement. Rejects if past deadline or already accepted.
* **Example Request**:
```json
{
  "vendorId": "6f181785-9ab5-4359-8ed0-f953357d1b97",
  "price": 420000,
  "pitch": "Hey there! We can offer a very high quality traditional setup for 4.2L."
}
```
* **Example Response**:
```json
{
  "id": "3883f56b-9d2e-44a8-9c8a-738ff7d6897d",
  "requirementId": "5b7eee40-ae98-42a5-ae40-c61ac06f1c3a",
  "vendorId": "6f181785-9ab5-4359-8ed0-f953357d1b97",
  "price": 420000,
  "pitch": "Hey there! We can offer a very high quality traditional setup for 4.2L.",
  "rankScore": 0.7967,
  "status": "PENDING",
  "createdAt": "2026-07-09T03:58:06.203Z",
  "updatedAt": "2026-07-09T03:58:06.208Z"
}
```

### 4. `GET /api/requirements/:id/bids`
* **Description**: Fetch all bids for a requirement ranked by `rankScore` desc.
* **Example Live Response (Wedding Decorator, Chennai)**:
```json
{
  "requirement": {
    "id": "592351bc-dd20-47ea-ada7-a5ce78992301",
    "title": "Wedding Decorator, Chennai",
    "description": "Traditional theme wedding decoration for 500 guests.",
    "category": "decor",
    "location": "Chennai",
    "guestCount": 500,
    "budget": 500000,
    "theme": "Traditional",
    "deadline": "2026-07-10T05:43:00.370Z",
    "status": "OPEN",
    "createdAt": "2026-07-09T05:43:00.370Z",
    "updatedAt": "2026-07-09T05:43:00.371Z"
  },
  "bids": [
    {
      "id": "9ae09804-3dea-4d19-b85a-e7c952bc009f",
      "requirementId": "592351bc-dd20-47ea-ada7-a5ce78992301",
      "vendorId": "82ed84b5-c8d4-48f8-87b4-06f53d0824d8",
      "price": 480000,
      "pitch": "Elite floral and traditional decors with premium imported marigolds and roses. We have 10+ years experience in South Indian weddings.",
      "rankScore": 0.7998,
      "status": "PENDING",
      "createdAt": "2026-07-09T06:43:00.370Z",
      "updatedAt": "2026-07-09T05:43:00.614Z",
      "vendor": {
        "name": "Elite Decorators"
      }
    },
    {
      "id": "79778114-ac4b-4803-adfe-6fb9fb7776c6",
      "requirementId": "592351bc-dd20-47ea-ada7-a5ce78992301",
      "vendorId": "46aadf4f-c3dd-4994-aee1-357833ec3a39",
      "price": 390000,
      "pitch": "Best price traditional setup with high-quality artificial and fresh flower mix. Customizable lighting layout included.",
      "rankScore": 0.782,
      "status": "PENDING",
      "createdAt": "2026-07-09T07:43:00.370Z",
      "updatedAt": "2026-07-09T05:43:00.734Z",
      "vendor": {
        "name": "Budget Decorators"
      }
    },
    {
      "id": "f88f654e-9bcd-4f94-8911-87b8171a7ef6",
      "requirementId": "592351bc-dd20-47ea-ada7-a5ce78992301",
      "vendorId": "2dac7707-b17c-4c12-a95b-ac4c186c30b2",
      "price": 450000,
      "pitch": "Stunning LED light backdrop, traditional kolam entrance, and stage floral arrangements. Full setup & cleanup included.",
      "rankScore": 0.7677,
      "status": "PENDING",
      "createdAt": "2026-07-09T09:43:00.370Z",
      "updatedAt": "2026-07-09T05:43:00.794Z",
      "vendor": {
        "name": "Sparkle Lights & Decor"
      }
    },
    {
      "id": "9fd0782d-440e-424d-96ca-3024f424c749",
      "requirementId": "592351bc-dd20-47ea-ada7-a5ce78992301",
      "vendorId": "7a317623-920f-4e41-9bc5-7876de3e84af",
      "price": 495000,
      "pitch": "We are very new and still learning the ropes, but we can do a basic job for you near budget ceiling.",
      "rankScore": 0.4631,
      "status": "PENDING",
      "createdAt": "2026-07-10T05:38:00.370Z",
      "updatedAt": "2026-07-09T05:43:00.915Z",
      "vendor": {
        "name": "Amateur Decorators"
      }
    },
    {
      "id": "3e2c9e93-3fb8-4dcd-a642-1e24682bd1a1",
      "requirementId": "592351bc-dd20-47ea-ada7-a5ce78992301",
      "vendorId": "6456e552-86b0-4dd4-8575-a096945231dc",
      "price": 520000,
      "pitch": "Absolute royal experience, custom wooden carved mandapam, standard high-grade fresh flowers.",
      "rankScore": 0.4034,
      "status": "PENDING",
      "createdAt": "2026-07-10T04:43:00.370Z",
      "updatedAt": "2026-07-09T05:43:00.855Z",
      "vendor": {
        "name": "Traditional Decors Chennai"
      }
    }
  ]
}
```

### 5. `POST /api/requirements/:id/accept-bid`
* **Description**: Accept one bid, close the auction, mark others as rejected, and create the AuctionResult.
* **Example Request**:
```json
{
  "bidId": "3883f56b-9d2e-44a8-9c8a-738ff7d6897d"
}
```
* **Example Response**:
```json
{
  "message": "Bid accepted successfully",
  "requirement": {
    "id": "5b7eee40-ae98-42a5-ae40-c61ac06f1c3a",
    "status": "ACCEPTED"
  },
  "acceptedBid": {
    "id": "3883f56b-9d2e-44a8-9c8a-738ff7d6897d",
    "status": "ACCEPTED"
  },
  "auctionResult": {
    "requirementId": "5b7eee40-ae98-42a5-ae40-c61ac06f1c3a",
    "acceptedBidId": "3883f56b-9d2e-44a8-9c8a-738ff7d6897d",
    "totalBids": 1,
    "winningPrice": 420000,
    "savings": 80000
  }
}
```

---

## 6. Bid Ranking Logic

Ranking is a deterministic weighted formula rather than an LLM-based system. This was a deliberate choice to prioritize transparency, auditability, zero inference cost, and predictable behavior for a marketplace decision that involves real money. An LLM-based re-ranking or bid-quality-summary layer is a natural future enhancement but is explicitly NOT implemented in this version.

The exact ranking algorithm is located in [src/ranking.ts](file:///Users/apple/developer/happiffie-reverse-auction-engine/src/ranking.ts#L29-L69).

### Formula:
$$\text{Score} = (0.50 \times \text{PriceScore}) + (0.30 \times \text{RatingScore}) + (0.15 \times \text{ResponseHistoryScore}) + (0.05 \times \text{TimingScore})$$

* **Price Score** (50% weight):
  $$\text{priceScoreBase} = \frac{\text{Budget} - \text{Price}}{\text{Budget} \times 0.3}$$
  $$\text{priceScore} = 0.6 + 0.4 \times \text{priceScoreBase}$$
  If $\text{Price} > \text{Budget}$: $\text{priceScore} = \text{priceScore} - 0.5$ (over-budget penalty)

  *In plain terms: a bid exactly at budget scores a base 0.6. Every 30% of budget saved below the budget adds up to 0.4 more (so a bid ~30% under budget approaches 1.0). A bid that exceeds the budget gets a flat 0.5 penalty subtracted, which is why over-budget bids rank far lower even before considering rating or history.*

* **Rating Score** (30% weight): `(Rating - 1) / 4`. Maps the 1-5 star scale onto 0-1.
* **Response History Score** (15% weight): `(ResponseRate * 0.7) + (min(ResponseCount, 50) / 50 * 0.3)`. Combines response percentage and bid count.
* **Timing Score** (5% weight): `(Deadline - BidTime) / (Deadline - CreatedAt)`. Rewards early bid entries and penalizes sniping.

---

## 7. Automated Tests

Automated tests are configured via **Vitest** in [src/bids.test.ts](file:///Users/apple/developer/happiffie-reverse-auction-engine/src/bids.test.ts).

### List of Covered Tests:
1. **Price Unit Test**: Asserts that lower prices yield higher scores when rating, response history, and timing are constant.
2. **Rating Unit Test**: Asserts that higher rating scores yield higher overall bid scores when price, timing, and response history are constant.
3. **Timing Unit Test**: Asserts that earlier bids receive a timing boost compared to late-stage bids, keeping other factors constant.
4. **Response History Unit Test**: Asserts that vendors with higher response rates and history volumes score higher when price, rating, and timing are constant.
5. **Score Spread Unit Test**: Asserts that a deliberately weak bid (near ceiling price, low rating, low response rate/volume, and late timing) scores at least 30 points (0.30) lower than a strong bid on the same requirement.
6. **Rejection Integration Test**: Verifies that bids placed after the requirement deadline are blocked and return a `400 Bad Request`.
7. **Acceptance Flow Integration Test**: Verifies that the accept bid transaction atomically updates requirement status to `ACCEPTED`, target bid to `ACCEPTED`, other bids to `REJECTED`, and creates an `AuctionResult` with the computed savings.

### Real Automated Test Output:
```
 RUN  v1.6.1 /Users/apple/developer/happiffie-reverse-auction-engine

 ✓ src/bids.test.ts  (7 tests) 91ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  11:11:45
   Duration  616ms (transform 87ms, setup 0ms, collect 109ms, tests 91ms, environment 0ms, prepare 102ms)
```

---

## 8. What's Explicitly NOT Implemented
* **User Authentication & Authorization**: There are no real user accounts. Identity is simulated by selecting a vendor from a dropdown list to demonstrate portal switching. (Out of scope for this demo).
* **Real-time Push Notifications**: Bid updates rely on a lightweight 10-second client-side polling loop instead of active WebSockets. (Out of scope).
* **Payment Gateways & Escrow**: Handled out-of-system. No financial clearing or deposit collection is implemented. (Out of scope).

---

## 9. Future Roadmap
1. **WebSocket Updates**: Transition from client-side polling to WebSocket/Redis pub-sub to broadcast incoming bids to clients instantly.
2. **Bid Quality LLM Summaries**: Introduce a generative summary layer that parses pitches and highlights the pros/cons of competing bids for complex decors or caterers.
3. **Dynamic Auction Extension**: Add soft deadlines (e.g. extending the auction by 3 minutes if a bid is placed in the last 2 minutes) to completely defeat sniping.
