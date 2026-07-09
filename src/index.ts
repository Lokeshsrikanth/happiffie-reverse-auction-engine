import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient, RequirementStatus, BidStatus } from '@prisma/client';
import { calculateBidScore } from './ranking';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// GET /api/requirements - List all requirements (useful for frontend)
app.get('/api/requirements', async (req: Request, res: Response) => {
  try {
    const requirements = await prisma.requirement.findMany({
      include: {
        bids: true,
        result: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(requirements);
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/requirements/:id - Get a single requirement
app.get('/api/requirements/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: {
        result: true,
      },
    });
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }
    res.json(requirement);
  } catch (error) {
    console.error('Error fetching requirement:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/vendors - List all vendors (useful for vendor selection in frontend)
app.get('/api/vendors', async (req: Request, res: Response) => {
  try {
    const vendors = await prisma.vendor.findMany({
      orderBy: {
        name: 'asc',
      },
    });
    res.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/requirements - Create a new event requirement
app.post('/api/requirements', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      category,
      location,
      guestCount,
      budget,
      theme,
      hoursToClose,
    } = req.body;

    // Validation
    if (!title || !category || !location || !guestCount || !budget) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const durationMs = (hoursToClose || 24) * 60 * 60 * 1000;
    const now = new Date();
    const deadline = new Date(now.getTime() + durationMs);

    const requirement = await prisma.requirement.create({
      data: {
        title,
        description: description || '',
        category,
        location,
        guestCount: parseInt(guestCount, 10),
        budget: parseFloat(budget),
        theme: theme || 'General',
        deadline,
        status: RequirementStatus.OPEN,
        createdAt: now,
      },
    });

    res.status(201).json(requirement);
  } catch (error) {
    console.error('Error creating requirement:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/requirements/:id/bids - Vendor submits a bid
app.post('/api/requirements/:id/bids', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vendorId, price, pitch } = req.body;

    if (!vendorId || price === undefined || !pitch) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Fetch requirement
    const requirement = await prisma.requirement.findUnique({
      where: { id },
    });

    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    // 2. Validate auction state and deadline
    const now = new Date();
    if (requirement.status !== RequirementStatus.OPEN) {
      return res.status(400).json({ error: 'Auction is not open for bids' });
    }
    if (now.getTime() > requirement.deadline.getTime()) {
      // Update status to CLOSED as deadline passed
      await prisma.requirement.update({
        where: { id },
        data: { status: RequirementStatus.CLOSED },
      });
      return res.status(400).json({ error: 'Auction deadline has passed' });
    }

    // 3. Fetch vendor
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // 4. Calculate rank score
    const rankScore = calculateBidScore(
      { price: parseFloat(price), createdAt: now, vendor },
      requirement
    );

    // 5. Create bid
    const bid = await prisma.bid.create({
      data: {
        requirementId: id,
        vendorId,
        price: parseFloat(price),
        pitch,
        rankScore,
        status: BidStatus.PENDING,
        createdAt: now,
      },
      include: {
        vendor: true,
      },
    });

    res.status(201).json(bid);
  } catch (error) {
    console.error('Error creating bid:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/requirements/:id/bids - Get ranked bids for a requirement
app.get('/api/requirements/:id/bids', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check requirement existence
    const requirement = await prisma.requirement.findUnique({
      where: { id },
    });

    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    // Check if the current time is past the deadline, and if so, auto-transition status
    const now = new Date();
    if (requirement.status === RequirementStatus.OPEN && now.getTime() > requirement.deadline.getTime()) {
      await prisma.requirement.update({
        where: { id },
        data: { status: RequirementStatus.CLOSED },
      });
      requirement.status = RequirementStatus.CLOSED;
    }

    const bids = await prisma.bid.findMany({
      where: { requirementId: id },
      include: {
        vendor: true,
      },
      orderBy: {
        rankScore: 'desc', // Highest score first
      },
    });

    res.json({
      requirement,
      bids,
    });
  } catch (error) {
    console.error('Error fetching ranked bids:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/requirements/:id/accept-bid - Accept a bid and close auction
app.post('/api/requirements/:id/accept-bid', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { bidId } = req.body;

    if (!bidId) {
      return res.status(400).json({ error: 'Missing bidId' });
    }

    // 1. Fetch requirement
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: { bids: true },
    });

    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    if (requirement.status === RequirementStatus.ACCEPTED) {
      return res.status(400).json({ error: 'An auction bid has already been accepted' });
    }

    // 2. Fetch target bid
    const targetBid = requirement.bids.find(b => b.id === bidId);
    if (!targetBid) {
      return res.status(404).json({ error: 'Bid not found for this requirement' });
    }

    const now = new Date();
    const totalBidsCount = requirement.bids.length;
    const savings = requirement.budget - targetBid.price;

    // 3. Perform atomic operations using transaction
    const [updatedRequirement, updatedBid, otherBids, result] = await prisma.$transaction([
      // Update requirement status
      prisma.requirement.update({
        where: { id },
        data: { status: RequirementStatus.ACCEPTED },
      }),
      // Mark accepted bid
      prisma.bid.update({
        where: { id: bidId },
        data: { status: BidStatus.ACCEPTED },
      }),
      // Mark other bids as rejected
      prisma.bid.updateMany({
        where: {
          requirementId: id,
          id: { not: bidId },
        },
        data: { status: BidStatus.REJECTED },
      }),
      // Create AuctionResult
      prisma.auctionResult.create({
        data: {
          requirementId: id,
          acceptedBidId: bidId,
          totalBids: totalBidsCount,
          winningPrice: targetBid.price,
          savings: savings,
          closedAt: now,
          createdAt: now,
        },
      }),
    ]);

    res.json({
      message: 'Bid accepted successfully',
      requirement: updatedRequirement,
      acceptedBid: updatedBid,
      auctionResult: result,
    });
  } catch (error) {
    console.error('Error accepting bid:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export default app;
