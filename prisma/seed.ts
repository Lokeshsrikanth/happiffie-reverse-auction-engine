import { PrismaClient, RequirementStatus, BidStatus, Vendor } from '@prisma/client';
import { calculateBidScore } from '../src/ranking';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing database...');
  await prisma.auctionResult.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.vendor.deleteMany();

  console.log('Seeding vendors...');
  const vendors = [
    { name: 'Elite Decorators', category: 'decor', rating: 4.8, responseRate: 0.95, responseCount: 45 },
    { name: 'Budget Decorators', category: 'decor', rating: 3.5, responseRate: 0.80, responseCount: 20 },
    { name: 'Sparkle Lights & Decor', category: 'decor', rating: 4.2, responseRate: 0.88, responseCount: 30 },
    { name: 'Traditional Decors Chennai', category: 'decor', rating: 4.6, responseRate: 0.90, responseCount: 15 },
    
    { name: 'Royal Catering Services', category: 'catering', rating: 4.9, responseRate: 0.98, responseCount: 120 },
    { name: 'Standard Catering', category: 'catering', rating: 4.0, responseRate: 0.75, responseCount: 15 },
    { name: 'Feast Organizers', category: 'catering', rating: 4.5, responseRate: 0.92, responseCount: 60 },
    
    { name: 'Star Photography', category: 'photography', rating: 4.7, responseRate: 0.90, responseCount: 35 },
    { name: 'Cheap Photography', category: 'photography', rating: 3.8, responseRate: 0.60, responseCount: 8 },
    { name: 'Focus Studio', category: 'photography', rating: 4.3, responseRate: 0.82, responseCount: 25 },
    
    { name: 'Dream Planners', category: 'planning', rating: 4.6, responseRate: 0.85, responseCount: 50 },
    { name: 'Grand Event Planners', category: 'planning', rating: 4.9, responseRate: 0.99, responseCount: 110 },
  ];

  const createdVendors: Vendor[] = [];
  for (const v of vendors) {
    const dbVendor = await prisma.vendor.create({ data: v });
    createdVendors.push(dbVendor);
  }
  console.log(`Seeded ${createdVendors.length} vendors.`);

  const now = new Date();

  console.log('Seeding requirements...');
  
  // Requirement 1: Wedding Decorator, Chennai (Active)
  const req1 = await prisma.requirement.create({
    data: {
      title: 'Wedding Decorator, Chennai',
      description: 'Traditional theme wedding decoration for 500 guests.',
      category: 'decor',
      location: 'Chennai',
      guestCount: 500,
      budget: 500000,
      theme: 'Traditional',
      deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours from now
      createdAt: now,
      status: RequirementStatus.OPEN,
    },
  });

  // Requirement 2: Birthday Party Catering, Bangalore (Active)
  const req2 = await prisma.requirement.create({
    data: {
      title: 'Birthday Party Catering, Bangalore',
      description: 'Veg and non-veg buffet catering for 150 guests.',
      category: 'catering',
      location: 'Bangalore',
      guestCount: 150,
      budget: 150000,
      theme: 'Superhero',
      deadline: new Date(now.getTime() + 12 * 60 * 60 * 1000), // 12 hours from now
      createdAt: now,
      status: RequirementStatus.OPEN,
    },
  });

  // Requirement 3: Corporate Event Photography, Mumbai (Expired)
  const req3 = await prisma.requirement.create({
    data: {
      title: 'Corporate Event Photography, Mumbai',
      description: 'Full day event coverage, candid + video.',
      category: 'photography',
      location: 'Mumbai',
      guestCount: 200,
      budget: 80000,
      theme: 'Corporate Professional',
      deadline: new Date(now.getTime() - 2 * 60 * 60 * 1000), // expired 2 hours ago
      createdAt: new Date(now.getTime() - 26 * 60 * 60 * 1000), // created 26 hours ago
      status: RequirementStatus.CLOSED,
    },
  });

  console.log('Seeding bids...');

  // Helper function to find vendor by name
  const findVendor = (name: string) => createdVendors.find(v => v.name === name)!;

  // Bids for Requirement 1 (Budget ₹500,000)
  const bidsReq1 = [
    {
      vendorName: 'Elite Decorators',
      price: 480000,
      pitch: 'Elite floral and traditional decors with premium imported marigolds and roses. We have 10+ years experience in South Indian weddings.',
      timeOffsetMs: 1 * 60 * 60 * 1000, // submitted 1 hour after creation
    },
    {
      vendorName: 'Budget Decorators',
      price: 390000, // Significantly lower price
      pitch: 'Best price traditional setup with high-quality artificial and fresh flower mix. Customizable lighting layout included.',
      timeOffsetMs: 2 * 60 * 60 * 1000, // submitted 2 hours after creation
    },
    {
      vendorName: 'Sparkle Lights & Decor',
      price: 450000,
      pitch: 'Stunning LED light backdrop, traditional kolam entrance, and stage floral arrangements. Full setup & cleanup included.',
      timeOffsetMs: 4 * 60 * 60 * 1000,
    },
    {
      vendorName: 'Traditional Decors Chennai',
      price: 520000, // Over budget
      pitch: 'Absolute royal experience, custom wooden carved mandapam, standard high-grade fresh flowers.',
      timeOffsetMs: 23 * 60 * 60 * 1000, // submitted close to deadline (23 hours after creation)
    },
  ];

  for (const b of bidsReq1) {
    const vendor = findVendor(b.vendorName);
    const bidCreatedAt = new Date(req1.createdAt.getTime() + b.timeOffsetMs);
    const score = calculateBidScore(
      { price: b.price, createdAt: bidCreatedAt, vendor },
      req1
    );

    await prisma.bid.create({
      data: {
        requirementId: req1.id,
        vendorId: vendor.id,
        price: b.price,
        pitch: b.pitch,
        rankScore: score,
        status: BidStatus.PENDING,
        createdAt: bidCreatedAt,
      },
    });
  }

  // Bids for Requirement 2 (Budget ₹150,000)
  const bidsReq2 = [
    {
      vendorName: 'Royal Catering Services',
      price: 145000,
      pitch: '5-star rated buffet with 3 starters, 5 main courses, and 3 desserts. Premium presentation and uniformed service staff.',
      timeOffsetMs: 30 * 60 * 1000, // 30 mins after creation
    },
    {
      vendorName: 'Standard Catering',
      price: 120000, // Lower price but lower rating/response
      pitch: 'Delicious and clean home-style catering. Basic buffet setup with 2 starters, 4 main courses, 2 desserts.',
      timeOffsetMs: 1 * 60 * 60 * 1000,
    },
    {
      vendorName: 'Feast Organizers',
      price: 135000,
      pitch: 'Special superhero themed dessert counter included! Standard multi-cuisine buffet tailored for children and adults.',
      timeOffsetMs: 2 * 60 * 60 * 1000,
    },
  ];

  for (const b of bidsReq2) {
    const vendor = findVendor(b.vendorName);
    const bidCreatedAt = new Date(req2.createdAt.getTime() + b.timeOffsetMs);
    const score = calculateBidScore(
      { price: b.price, createdAt: bidCreatedAt, vendor },
      req2
    );

    await prisma.bid.create({
      data: {
        requirementId: req2.id,
        vendorId: vendor.id,
        price: b.price,
        pitch: b.pitch,
        rankScore: score,
        status: BidStatus.PENDING,
        createdAt: bidCreatedAt,
      },
    });
  }

  // Bids for Requirement 3 (Expired)
  const bidsReq3 = [
    {
      vendorName: 'Star Photography',
      price: 75000,
      pitch: 'High-end corporate coverage, standard 4K video reel + 150 edited high-res photos.',
      timeOffsetMs: 4 * 60 * 60 * 1000, // 4 hours after creation
    },
    {
      vendorName: 'Focus Studio',
      price: 70000,
      pitch: 'Professional corporate headshots + event coverage. 2 photographers onsite.',
      timeOffsetMs: 8 * 60 * 60 * 1000,
    },
  ];

  for (const b of bidsReq3) {
    const vendor = findVendor(b.vendorName);
    const bidCreatedAt = new Date(req3.createdAt.getTime() + b.timeOffsetMs);
    const score = calculateBidScore(
      { price: b.price, createdAt: bidCreatedAt, vendor },
      req3
    );

    await prisma.bid.create({
      data: {
        requirementId: req3.id,
        vendorId: vendor.id,
        price: b.price,
        pitch: b.pitch,
        rankScore: score,
        status: BidStatus.PENDING,
        createdAt: bidCreatedAt,
      },
    });
  }

  console.log('Seeded database successfully with mock requirements and bids!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
