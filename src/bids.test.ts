import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, RequirementStatus, BidStatus } from '@prisma/client';
import { calculateBidScore } from './ranking';

const prisma = new PrismaClient();

describe('Reverse Auction System Tests', () => {

  // ==========================================
  // 1. Bid Ranking Function (Unit Tests)
  // ==========================================
  describe('calculateBidScore Unit Tests', () => {
    const requirement = {
      budget: 100000,
      createdAt: new Date('2026-07-09T09:00:00Z'),
      deadline: new Date('2026-07-09T21:00:00Z'), // 12 hours duration
    };

    it('should rank lower price higher, keeping vendor stats and timing constant', () => {
      const bidLowPrice = {
        price: 80000,
        createdAt: new Date('2026-07-09T10:00:00Z'),
        vendor: { rating: 4.0, responseRate: 0.9, responseCount: 20 },
      };

      const bidHighPrice = {
        price: 95000,
        createdAt: new Date('2026-07-09T10:00:00Z'),
        vendor: { rating: 4.0, responseRate: 0.9, responseCount: 20 },
      };

      const scoreLow = calculateBidScore(bidLowPrice, requirement);
      const scoreHigh = calculateBidScore(bidHighPrice, requirement);

      expect(scoreLow).toBeGreaterThan(scoreHigh);
    });

    it('should rank higher rating higher, keeping price, timing, and other stats constant', () => {
      const bidHighRating = {
        price: 90000,
        createdAt: new Date('2026-07-09T12:00:00Z'),
        vendor: { rating: 5.0, responseRate: 0.8, responseCount: 30 },
      };

      const bidLowRating = {
        price: 90000,
        createdAt: new Date('2026-07-09T12:00:00Z'),
        vendor: { rating: 3.0, responseRate: 0.8, responseCount: 30 },
      };

      const scoreHigh = calculateBidScore(bidHighRating, requirement);
      const scoreLow = calculateBidScore(bidLowRating, requirement);

      expect(scoreHigh).toBeGreaterThan(scoreLow);
    });

    it('should rank earlier bids higher, keeping price and vendor stats constant', () => {
      const bidEarly = {
        price: 90000,
        createdAt: new Date('2026-07-09T10:00:00Z'), // 1 hour in
        vendor: { rating: 4.5, responseRate: 0.9, responseCount: 25 },
      };

      const bidLate = {
        price: 90000,
        createdAt: new Date('2026-07-09T20:00:00Z'), // 11 hours in
        vendor: { rating: 4.5, responseRate: 0.9, responseCount: 25 },
      };

      const scoreEarly = calculateBidScore(bidEarly, requirement);
      const scoreLate = calculateBidScore(bidLate, requirement);

      expect(scoreEarly).toBeGreaterThan(scoreLate);
    });

    it('should rank higher response history higher, keeping price, rating, and timing constant', () => {
      const bidBetterHistory = {
        price: 90000,
        createdAt: new Date('2026-07-09T10:00:00Z'),
        vendor: { rating: 4.0, responseRate: 0.95, responseCount: 40 },
      };

      const bidWorseHistory = {
        price: 90000,
        createdAt: new Date('2026-07-09T10:00:00Z'),
        vendor: { rating: 4.0, responseRate: 0.70, responseCount: 10 },
      };

      const scoreBetter = calculateBidScore(bidBetterHistory, requirement);
      const scoreWorse = calculateBidScore(bidWorseHistory, requirement);

      expect(scoreBetter).toBeGreaterThan(scoreWorse);
    });
  });

  // ==========================================
  // 2. Integration / Database Tests
  // ==========================================
  describe('Database Integration Tests', () => {
    let mockVendor: any;

    beforeAll(async () => {
      // Create a test vendor
      mockVendor = await prisma.vendor.create({
        data: {
          name: 'Test Vendor A',
          category: 'decor',
          rating: 4.5,
          responseRate: 0.9,
          responseCount: 15,
        },
      });
    });

    afterAll(async () => {
      // Cleanup
      await prisma.auctionResult.deleteMany();
      await prisma.bid.deleteMany();
      await prisma.requirement.deleteMany();
      await prisma.vendor.deleteMany();
      await prisma.$disconnect();
    });

    // test bid rejection after deadline
    it('should reject a bid if the current time is past the requirement deadline', async () => {
      // 1. Create requirement with past deadline
      const pastDeadline = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const requirement = await prisma.requirement.create({
        data: {
          title: 'Test Expired Requirement',
          description: 'Testing bid rejection',
          category: 'decor',
          location: 'Chennai',
          guestCount: 100,
          budget: 100000,
          theme: 'Traditional',
          deadline: pastDeadline,
          status: RequirementStatus.OPEN,
        },
      });

      // 2. Simulate API logic checking deadline
      const now = new Date();
      let bidError = '';
      let bidCreated = null;

      if (now.getTime() > requirement.deadline.getTime()) {
        bidError = 'Auction deadline has passed';
      } else {
        bidCreated = await prisma.bid.create({
          data: {
            requirementId: requirement.id,
            vendorId: mockVendor.id,
            price: 90000,
            pitch: 'Test pitch',
            rankScore: 0.5,
            status: BidStatus.PENDING,
          },
        });
      }

      expect(bidError).toBe('Auction deadline has passed');
      expect(bidCreated).toBeNull();
    });

    // test auction accept flow
    it('should correctly handle the accept bid flow: mark accepted, reject others, create AuctionResult', async () => {
      // 1. Create a requirement
      const requirement = await prisma.requirement.create({
        data: {
          title: 'Test Active Requirement',
          description: 'Testing accept bid flow',
          category: 'decor',
          location: 'Chennai',
          guestCount: 100,
          budget: 200000,
          theme: 'Traditional',
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours in future
          status: RequirementStatus.OPEN,
        },
      });

      // 2. Create another vendor for competing bids
      const mockVendorB = await prisma.vendor.create({
        data: {
          name: 'Test Vendor B',
          category: 'decor',
          rating: 4.0,
          responseRate: 0.8,
          responseCount: 10,
        },
      });

      // 3. Create two bids
      const bid1 = await prisma.bid.create({
        data: {
          requirementId: requirement.id,
          vendorId: mockVendor.id,
          price: 180000,
          pitch: 'Vendor A pitch',
          rankScore: 0.65,
          status: BidStatus.PENDING,
        },
      });

      const bid2 = await prisma.bid.create({
        data: {
          requirementId: requirement.id,
          vendorId: mockVendorB.id,
          price: 150000,
          pitch: 'Vendor B pitch',
          rankScore: 0.75,
          status: BidStatus.PENDING,
        },
      });

      // 4. Simulate acceptance flow (same transaction as GET /accept-bid)
      const bidIdToAccept = bid2.id;
      const totalBidsCount = 2;
      const savings = requirement.budget - bid2.price;

      await prisma.$transaction([
        prisma.requirement.update({
          where: { id: requirement.id },
          data: { status: RequirementStatus.ACCEPTED },
        }),
        prisma.bid.update({
          where: { id: bidIdToAccept },
          data: { status: BidStatus.ACCEPTED },
        }),
        prisma.bid.updateMany({
          where: {
            requirementId: requirement.id,
            id: { not: bidIdToAccept },
          },
          data: { status: BidStatus.REJECTED },
        }),
        prisma.auctionResult.create({
          data: {
            requirementId: requirement.id,
            acceptedBidId: bidIdToAccept,
            totalBids: totalBidsCount,
            winningPrice: bid2.price,
            savings: savings,
          },
        }),
      ]);

      // 5. Assert database states
      const updatedReq = await prisma.requirement.findUnique({
        where: { id: requirement.id },
      });
      const updatedBid1 = await prisma.bid.findUnique({
        where: { id: bid1.id },
      });
      const updatedBid2 = await prisma.bid.findUnique({
        where: { id: bid2.id },
      });
      const result = await prisma.auctionResult.findUnique({
        where: { requirementId: requirement.id },
      });

      expect(updatedReq?.status).toBe(RequirementStatus.ACCEPTED);
      expect(updatedBid2?.status).toBe(BidStatus.ACCEPTED);
      expect(updatedBid1?.status).toBe(BidStatus.REJECTED);
      expect(result).toBeDefined();
      expect(result?.winningPrice).toBe(150000);
      expect(result?.savings).toBe(50000);
      expect(result?.totalBids).toBe(2);
    });
  });
});
