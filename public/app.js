// API Base URL
const API_URL = ''; // Relative paths since hosted on same server

// Application State
let requirements = [];
let vendors = [];
let selectedRequirementId = null;
let selectedVendorRequirementId = null;

// DOM Elements
const btnClientView = document.getElementById('btn-client-view');
const btnVendorView = document.getElementById('btn-vendor-view');
const clientSection = document.getElementById('client-section');
const vendorSection = document.getElementById('vendor-section');

// Client Views
const postRequirementForm = document.getElementById('post-requirement-form');
const requirementsList = document.getElementById('requirements-list');
const bidsRankingCard = document.getElementById('bids-ranking-card');
const bidsList = document.getElementById('bids-list');
const selectedReqTitle = document.getElementById('selected-req-title');
const selectedReqBudget = document.getElementById('selected-req-budget');
const selectedReqDeadline = document.getElementById('selected-req-deadline');
const selectedReqBadge = document.getElementById('selected-req-badge');
const auctionResultBanner = document.getElementById('auction-result-banner');
const winnerText = document.getElementById('winner-text');
const savingsText = document.getElementById('savings-text');

// Vendor Views
const vendorAuctionsList = document.getElementById('vendor-auctions-list');
const vendorBidSubmission = document.getElementById('vendor-bid-submission');
const vendorBidPrompt = document.getElementById('vendor-bid-prompt');
const bidTargetTitle = document.getElementById('bid-target-title');
const bidTargetBudget = document.getElementById('bid-target-budget');
const bidTargetDeadline = document.getElementById('bid-target-deadline');
const bidTargetDesc = document.getElementById('bid-target-desc');
const bidVendorSelect = document.getElementById('bid-vendor-select');
const miniRating = document.getElementById('mini-rating');
const miniRespRate = document.getElementById('mini-resp-rate');
const miniRespCount = document.getElementById('mini-resp-count');
const vendorPreviewStats = document.getElementById('vendor-preview-stats');
const submitBidForm = document.getElementById('submit-bid-form');
const bidPriceInput = document.getElementById('bid-price');
const bidPriceHelper = document.getElementById('bid-price-helper');

// Toast Elements
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Initialize Lucide Icons
function updateIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Show Toast message
function showToast(message, type = 'info') {
  toastMessage.textContent = message;
  toast.className = 'toast';
  
  // Set theme colors based on type or context
  if (type === 'error') {
    toast.style.borderLeft = '4px solid var(--danger-color)';
  } else if (type === 'success') {
    toast.style.borderLeft = '4px solid var(--success-color)';
  } else {
    toast.style.borderLeft = '4px solid var(--client-primary)';
  }

  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// Tab Switching
btnClientView.addEventListener('click', () => {
  btnClientView.classList.add('active');
  btnVendorView.classList.remove('active');
  clientSection.classList.add('active-view');
  vendorSection.classList.remove('active-view');
  loadData();
});

btnVendorView.addEventListener('click', () => {
  btnVendorView.classList.add('active');
  btnClientView.classList.remove('active');
  vendorSection.classList.add('active-view');
  clientSection.classList.remove('active-view');
  loadData();
});

// Load Requirements and Vendors
async function loadData() {
  try {
    const reqResponse = await fetch(`${API_URL}/api/requirements`);
    requirements = await reqResponse.json();

    const vendorResponse = await fetch(`${API_URL}/api/vendors`);
    vendors = await vendorResponse.json();

    renderRequirements();
    renderVendorAuctions();
    populateVendorSelect();

    if (selectedRequirementId) {
      loadRankedBids(selectedRequirementId);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    showToast('Failed to connect to backend server', 'error');
  }
}

// Format currency
function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

// Calculate remaining time
function getRemainingTimeText(deadlineStr) {
  const deadline = new Date(deadlineStr);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'Closed';
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24);
    const hours = diffHours % 24;
    return `${days}d ${hours}h left`;
  }
  
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHours}h ${diffMins}m left`;
}

// ----------------------------------------------------
// CLIENT DASHBOARD LOGIC
// ----------------------------------------------------

// Render Requirement List for Clients
function renderRequirements() {
  if (requirements.length === 0) {
    requirementsList.innerHTML = `<div class="loading-state"><span>No requirements posted yet.</span></div>`;
    return;
  }

  requirementsList.innerHTML = '';
  requirements.forEach(req => {
    const card = document.createElement('div');
    card.className = `item-card ${selectedRequirementId === req.id ? 'selected' : ''}`;
    
    let statusBadge = '';
    if (req.status === 'OPEN') statusBadge = '<span class="badge badge-open">Open</span>';
    else if (req.status === 'CLOSED') statusBadge = '<span class="badge badge-closed">Closed</span>';
    else if (req.status === 'ACCEPTED') statusBadge = '<span class="badge badge-accepted">Accepted</span>';

    const bidsCount = req.bids ? req.bids.length : 0;

    card.innerHTML = `
      <div class="item-details">
        <h3>${req.title}</h3>
        <div class="item-meta">
          <span>Budget: ${formatCurrency(req.budget)}</span>
          <span>Bids: <strong>${bidsCount}</strong></span>
          <span>${getRemainingTimeText(req.deadline)}</span>
        </div>
      </div>
      <div>
        ${statusBadge}
      </div>
    `;

    card.addEventListener('click', () => {
      // Toggle selection
      document.querySelectorAll('#requirements-list .item-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedRequirementId = req.id;
      loadRankedBids(req.id);
    });

    requirementsList.appendChild(card);
  });
}

// Fetch and display Ranked Bids
async function loadRankedBids(requirementId) {
  try {
    bidsRankingCard.classList.remove('hidden');
    bidsList.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Retrieving live bids...</span>
      </div>
    `;

    const response = await fetch(`${API_URL}/api/requirements/${requirementId}/bids`);
    if (!response.ok) throw new Error('Failed to load bids');
    
    const { requirement, bids } = await response.json();

    // Set header details
    selectedReqTitle.textContent = requirement.title;
    selectedReqBudget.textContent = `Budget: ${formatCurrency(requirement.budget)}`;
    selectedReqDeadline.textContent = getRemainingTimeText(requirement.deadline);
    
    // Status Badge
    selectedReqBadge.className = 'badge';
    if (requirement.status === 'OPEN') {
      selectedReqBadge.classList.add('badge-open');
      selectedReqBadge.textContent = 'Open';
    } else if (requirement.status === 'CLOSED') {
      selectedReqBadge.classList.add('badge-closed');
      selectedReqBadge.textContent = 'Closed';
    } else if (requirement.status === 'ACCEPTED') {
      selectedReqBadge.classList.add('badge-accepted');
      selectedReqBadge.textContent = 'Accepted';
    }

    // Winner banner
    if (requirement.status === 'ACCEPTED' && requirement.result) {
      auctionResultBanner.classList.remove('hidden');
      const winningBid = bids.find(b => b.status === 'ACCEPTED');
      if (winningBid) {
        winnerText.innerHTML = `Winning Bid by <strong>${winningBid.vendor.name}</strong> at <strong>${formatCurrency(winningBid.price)}</strong>`;
        
        const savingsPercent = ((requirement.budget - winningBid.price) / requirement.budget * 100).toFixed(1);
        savingsText.textContent = `Total Savings: ${formatCurrency(requirement.budget - winningBid.price)} (${savingsPercent}%)`;
      }
    } else {
      auctionResultBanner.classList.add('hidden');
    }

    // Render bids
    if (bids.length === 0) {
      bidsList.innerHTML = `<div class="loading-state"><span>No bids submitted yet for this requirement.</span></div>`;
      return;
    }

    bidsList.innerHTML = '';
    bids.forEach((bid, index) => {
      const isTopBid = index === 0 && requirement.status !== 'ACCEPTED';
      const bidCard = document.createElement('div');
      
      let cardClass = 'bid-item-card';
      if (isTopBid) cardClass += ' rank-1';
      if (bid.status === 'ACCEPTED') cardClass += ' rank-1'; // Gold border for selected winner
      
      bidCard.className = cardClass;

      let rankLabel = '';
      if (bid.status === 'ACCEPTED') {
        rankLabel = `<span class="rank-badge"><i data-lucide="crown"></i> Selected Winner</span>`;
      } else if (isTopBid) {
        rankLabel = `<span class="rank-badge"><i data-lucide="sparkles"></i> Highest Ranked</span>`;
      } else {
        rankLabel = `<span class="rank-badge">Rank #${index + 1}</span>`;
      }

      // Show Accept button if requirement is open and this bid is pending
      const showAcceptBtn = requirement.status === 'OPEN' || requirement.status === 'CLOSED';
      const actionHtml = showAcceptBtn 
        ? `<div class="bid-actions">
             <button class="btn btn-success btn-accept-bid" data-bid-id="${bid.id}">
               <i data-lucide="check"></i> Accept Bid
             </button>
           </div>`
        : '';

      const ratingStars = '★'.repeat(Math.round(bid.vendor.rating)) + '☆'.repeat(5 - Math.round(bid.vendor.rating));
      const respPercent = Math.round(bid.vendor.responseRate * 100);

      bidCard.innerHTML = `
        ${rankLabel}
        <div class="bid-header">
          <div class="vendor-info">
            <h4>${bid.vendor.name}</h4>
            <div class="vendor-stats">
              <span>Rating: <strong>${bid.vendor.rating.toFixed(1)} ${ratingStars}</strong></span>
              <span>Resp Rate: <strong>${respPercent}%</strong></span>
              <span>Resp Count: <strong>${bid.vendor.responseCount}</strong></span>
            </div>
          </div>
          <div class="bid-pricing">
            <div class="bid-price">${formatCurrency(bid.price)}</div>
            <div class="bid-score">Score: ${bid.rankScore.toFixed(4)}</div>
          </div>
        </div>
        <p class="bid-pitch-text">"${bid.pitch}"</p>
        ${actionHtml}
      `;

      // Accept bid click handler
      const acceptBtn = bidCard.querySelector('.btn-accept-bid');
      if (acceptBtn) {
        acceptBtn.addEventListener('click', async () => {
          if (confirm(`Are you sure you want to accept the bid of ${formatCurrency(bid.price)} from ${bid.vendor.name}? This will lock the auction.`)) {
            await acceptBid(requirementId, bid.id);
          }
        });
      }

      bidsList.appendChild(bidCard);
    });

    updateIcons();
  } catch (error) {
    console.error('Error rendering bids:', error);
    bidsList.innerHTML = `<div class="loading-state"><span class="helper-danger">Failed to fetch bids list.</span></div>`;
  }
}

// Action: Accept Bid
async function acceptBid(requirementId, bidId) {
  try {
    const response = await fetch(`${API_URL}/api/requirements/${requirementId}/accept-bid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bidId }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to accept bid');
    }

    showToast('Bid accepted successfully!', 'success');
    loadData(); // Reload all requirements data to reflect change
  } catch (error) {
    console.error('Error accepting bid:', error);
    showToast(error.message, 'error');
  }
}

// Submit post requirement
postRequirementForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = document.getElementById('req-title').value;
  const category = document.getElementById('req-category').value;
  const location = document.getElementById('req-location').value;
  const guestCount = document.getElementById('req-guests').value;
  const budget = document.getElementById('req-budget').value;
  const theme = document.getElementById('req-theme').value;
  const hoursToClose = document.getElementById('req-hours').value;
  const description = document.getElementById('req-desc').value;

  try {
    const response = await fetch(`${API_URL}/api/requirements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        category,
        location,
        guestCount,
        budget,
        theme,
        hoursToClose,
        description,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create requirement');
    }

    showToast('Requirement posted successfully!', 'success');
    postRequirementForm.reset();
    selectedRequirementId = data.id; // Automatically focus on new requirement
    loadData();
  } catch (error) {
    console.error('Error posting requirement:', error);
    showToast(error.message, 'error');
  }
});

// ----------------------------------------------------
// VENDOR DASHBOARD LOGIC
// ----------------------------------------------------

// Render Open Requirements for Vendors
function renderVendorAuctions() {
  const openReqs = requirements.filter(r => r.status === 'OPEN');
  
  if (openReqs.length === 0) {
    vendorAuctionsList.innerHTML = `<div class="loading-state"><span>No active auctions matching your category.</span></div>`;
    return;
  }

  vendorAuctionsList.innerHTML = '';
  openReqs.forEach(req => {
    const card = document.createElement('div');
    card.className = `item-card ${selectedVendorRequirementId === req.id ? 'selected' : ''}`;
    
    card.innerHTML = `
      <div class="item-details">
        <h3>${req.title}</h3>
        <div class="item-meta">
          <span>Budget: ${formatCurrency(req.budget)}</span>
          <span>Theme: <strong>${req.theme}</strong></span>
          <span>Bids: <strong>${req.bids ? req.bids.length : 0}</strong></span>
          <span>${getRemainingTimeText(req.deadline)}</span>
        </div>
      </div>
      <div>
        <span class="badge badge-open">Live</span>
      </div>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('#vendor-auctions-list .item-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedVendorRequirementId = req.id;
      showBidSubmissionForm(req);
    });

    vendorAuctionsList.appendChild(card);
  });
}

// Populate vendor list in select drop-down
function populateVendorSelect() {
  // Save current selection if any
  const currentSelection = bidVendorSelect.value;
  
  bidVendorSelect.innerHTML = `<option value="">-- Choose Vendor --</option>`;
  
  // Filter vendors based on selected requirement category if available
  let filteredVendors = vendors;
  if (selectedVendorRequirementId) {
    const req = requirements.find(r => r.id === selectedVendorRequirementId);
    if (req) {
      filteredVendors = vendors.filter(v => v.category === req.category);
    }
  }

  filteredVendors.forEach(vendor => {
    const opt = document.createElement('option');
    opt.value = vendor.id;
    opt.textContent = `${vendor.name} (${vendor.rating.toFixed(1)}★, ${vendor.category})`;
    bidVendorSelect.appendChild(opt);
  });

  if (currentSelection) {
    bidVendorSelect.value = currentSelection;
  }
}

// Display Bid submission form
function showBidSubmissionForm(req) {
  vendorBidPrompt.classList.add('hidden');
  vendorBidSubmission.classList.remove('hidden');
  
  bidTargetTitle.textContent = req.title;
  bidTargetBudget.textContent = `Budget Limit: ${formatCurrency(req.budget)}`;
  bidTargetDeadline.textContent = getRemainingTimeText(req.deadline);
  bidTargetDesc.textContent = req.description;
  
  bidPriceInput.max = req.budget;
  bidPriceHelper.textContent = `Target within budget: ${formatCurrency(req.budget)}`;
  
  populateVendorSelect();
  vendorPreviewStats.classList.add('hidden');
  submitBidForm.reset();
}

// Vendor Selection Details Change Listener
bidVendorSelect.addEventListener('change', () => {
  const vendorId = bidVendorSelect.value;
  if (!vendorId) {
    vendorPreviewStats.classList.add('hidden');
    return;
  }

  const vendor = vendors.find(v => v.id === vendorId);
  if (vendor) {
    vendorPreviewStats.classList.remove('hidden');
    miniRating.textContent = `${vendor.rating.toFixed(1)}★`;
    miniRespRate.textContent = `${Math.round(vendor.responseRate * 100)}%`;
    miniRespCount.textContent = vendor.responseCount;
  }
});

// Submit Vendor Bid
submitBidForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const vendorId = bidVendorSelect.value;
  const price = parseFloat(bidPriceInput.value);
  const pitch = document.getElementById('bid-pitch').value;
  
  if (!selectedVendorRequirementId) {
    showToast('Please select a requirement first', 'error');
    return;
  }

  const req = requirements.find(r => r.id === selectedVendorRequirementId);
  if (price > req.budget) {
    if (!confirm('Your bid price exceeds the requested budget. This will severely penalize your rank score. Proceed?')) {
      return;
    }
  }

  try {
    const response = await fetch(`${API_URL}/api/requirements/${selectedVendorRequirementId}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vendorId,
        price,
        pitch,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit bid');
    }

    showToast('Your bid has been placed in the reverse auction!', 'success');
    submitBidForm.reset();
    vendorPreviewStats.classList.add('hidden');
    
    // Auto switch to show bids in client tab to review it, or reload details
    loadData();
  } catch (error) {
    console.error('Error submitting bid:', error);
    showToast(error.message, 'error');
  }
});

// Load everything on startup
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  // Poll data every 10 seconds for real-time live bidding updates
  setInterval(loadData, 10000);
});
