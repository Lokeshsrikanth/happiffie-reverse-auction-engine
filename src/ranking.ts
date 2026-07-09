export interface BidInput {
  price: number;
  createdAt: Date;
  vendor: {
    rating: number;
    responseRate: number;
    responseCount: number;
  };
}

export interface RequirementInput {
  budget: number;
  createdAt: Date;
  deadline: Date;
}

/**
 * Calculates a score for a bid. Higher score means a better/higher-ranked bid.
 * 
 * Score Formula:
 *   Score = (0.50 * PriceScore) + (0.30 * RatingScore) + (0.15 * ResponseHistoryScore) + (0.05 * TimingScore)
 * 
 * Where:
 *   - PriceScore = (Budget - Price) / Budget
 *   - RatingScore = (Rating - 1) / 4
 *   - ResponseHistoryScore = (ResponseRate * 0.7) + (min(ResponseCount, 50) / 50 * 0.3)
 *   - TimingScore = (Deadline - BidTime) / (Deadline - RequirementCreatedAt)
 */
export function calculateBidScore(bid: BidInput, requirement: RequirementInput): number {
  // 1. Price Score (50% weight)
  // Maps bids at budget to a base score of 0.6. Bids with a 30% or greater discount get 1.0+.
  // Bids above budget are penalized by 0.5.
  let priceScore = 0;
  if (requirement.budget > 0) {
    const priceScoreBase = (requirement.budget - bid.price) / (requirement.budget * 0.3);
    priceScore = 0.6 + 0.4 * priceScoreBase;
    if (bid.price > requirement.budget) {
      priceScore -= 0.5; // Apply over-budget penalty
    }
  }

  // 2. Rating Score (30% weight)
  // Normalizes vendor rating (1 to 5 scale) to (0 to 1 scale).
  const ratingScore = Math.max(0, Math.min(1, (bid.vendor.rating - 1) / 4));

  // 3. Response History Score (15% weight)
  // Combines response rate (0 to 1) and response count (capped at 50 to avoid over-weighting massive vendors).
  const cappedResponseCount = Math.min(bid.vendor.responseCount, 50);
  const responseHistoryScore = (bid.vendor.responseRate * 0.7) + ((cappedResponseCount / 50) * 0.3);

  // 4. Timing Score (5% weight)
  // Promotes early bids and slightly penalizes last-second/sniped bids.
  const totalDuration = requirement.deadline.getTime() - requirement.createdAt.getTime();
  const timeRemaining = requirement.deadline.getTime() - bid.createdAt.getTime();
  
  let timingScore = 0;
  if (totalDuration > 0 && timeRemaining >= 0) {
    timingScore = timeRemaining / totalDuration;
  }
  // Clamp timing score between 0 and 1
  timingScore = Math.max(0, Math.min(1, timingScore));

  // Final Weighted Score
  const score = (0.50 * priceScore) + (0.30 * ratingScore) + (0.15 * responseHistoryScore) + (0.05 * timingScore);
  
  // Round to 4 decimal places for clean representation
  return Math.round(score * 10000) / 10000;
}
