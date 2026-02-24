import express from 'express';
import { Dispute, Parcel } from '../models/index.js';

const router = express.Router();

// ⚠️ IMPORTANT: /stats/summary MUST be registered BEFORE /:id
// otherwise Express matches "stats" as the :id param

// GET /api/disputes/stats/summary - Get dispute statistics summary
router.get('/stats/summary', async (req, res) => {
  try {
    const { region } = req.query;
    const regionFilter = region && region !== 'All Regions' ? { region } : {};

    const [statusCounts, priorityCounts, avgResolutionTime] = await Promise.all([
      Dispute.aggregate([
        { $match: regionFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Dispute.aggregate([
        { $match: regionFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      Dispute.aggregate([
        {
          $match: {
            ...regionFilter,
            status: 'Resolved',
            resolutionDate: { $exists: true }
          }
        },
        {
          $project: {
            duration: {
              $divide: [
                { $subtract: ['$resolutionDate', '$filingDate'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        { $group: { _id: null, avgDays: { $avg: '$duration' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        byStatus: statusCounts,
        byPriority: priorityCounts,
        avgResolutionDays: avgResolutionTime[0]?.avgDays || 0
      }
    });
  } catch (error) {
    console.error('Error fetching dispute stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/disputes - Get all disputes with filtering & pagination
router.get('/', async (req, res) => {
  try {
    const {
      region,
      status,
      priority,
      page = 1,
      limit = 20,
      sortBy = 'filingDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (region && region !== 'All Regions') query.region = region;
    if (status && status !== 'All Statuses') query.status = status;
    if (priority) query.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [disputes, total] = await Promise.all([
      Dispute.find(query)
        .populate('parcel', 'parcelId region address')
        .populate('claimant', 'personalInfo corporateInfo')
        .populate('defendant', 'personalInfo corporateInfo')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Dispute.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: disputes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching disputes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/disputes/:id - Get single dispute by ID
router.get('/:id', async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id)
      .populate('parcel')
      .populate('claimant')
      .populate('defendant')
      .populate('assignedTo', 'firstName lastName role');

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    res.json({
      success: true,
      data: dispute
    });
  } catch (error) {
    console.error('Error fetching dispute by id:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

// import express from 'express';
// import { Parcel, Dispute, Transfer, Mortgage, Owner, Subsidy } from '../models/index.js';

// const router = express.Router();

// // GET /api/dashboard/stats - Get overall statistics
// router.get('/stats', async (req, res) => {
//   try {
//     const { region, timeRange } = req.query;
    
//     // Build date filter based on time range
//     let dateFilter = {};
//     if (timeRange) {
//       const now = new Date();
//       const daysMap = {
//         '7days': 7,
//         '30days': 30,
//         '90days': 90,
//         '1year': 365
//       };
      
//       if (daysMap[timeRange]) {
//         const startDate = new Date(now.getTime() - (daysMap[timeRange] * 24 * 60 * 60 * 1000));
//         dateFilter = { createdAt: { $gte: startDate } };
//       }
//     }
    
//     // Build region filter
//     const regionFilter = region && region !== 'All Regions' ? { region } : {};
    
//     // Get counts
//     const [
//       totalParcels,
//       totalOwners,
//       activeDisputes,
//       pendingTransfers,
//       activeMortgages,
//       verifiedParcels,
//       disputedParcels,
//       inCourtDisputes
//     ] = await Promise.all([
//       Parcel.countDocuments({ ...regionFilter, isActive: true }),
//       Owner.countDocuments({ isVerified: true }),
//       Dispute.countDocuments({ ...regionFilter, status: { $in: ['Open', 'Investigation', 'Court'] } }),
//       Transfer.countDocuments({ ...regionFilter, transferStatus: { $in: ['initiated', 'pending_approval'] } }),
//       Mortgage.countDocuments({ ...regionFilter, mortgageStatus: 'active' }),
//       Parcel.countDocuments({ ...regionFilter, legalStatus: 'verified' }),
//       Parcel.countDocuments({ ...regionFilter, legalStatus: 'disputed' }),
//       Dispute.countDocuments({ ...regionFilter, status: 'Court' })
//     ]);
    
//     // Calculate derived metrics
//     const totalLandArea = await Parcel.aggregate([
//       { $match: { ...regionFilter, isActive: true } },
//       { $group: { _id: null, totalArea: { $sum: '$area' } } }
//     ]);
    
//     const totalMarketValue = await Parcel.aggregate([
//       { $match: { ...regionFilter, isActive: true } },
//       { $group: { _id: null, totalValue: { $sum: '$marketValue' } } }
//     ]);
    
//     const verificationRate = totalParcels > 0 ? ((verifiedParcels / totalParcels) * 100).toFixed(1) : 0;
    
//     res.json({
//       success: true,
//       data: {
//         parcels: {
//           total: totalParcels,
//           verified: verifiedParcels,
//           disputed: disputedParcels,
//           verificationRate: parseFloat(verificationRate)
//         },
//         owners: {
//           total: totalOwners
//         },
//         disputes: {
//           active: activeDisputes,
//           inCourt: inCourtDisputes,
//           total: await Dispute.countDocuments(regionFilter)
//         },
//         transfers: {
//           pending: pendingTransfers,
//           total: await Transfer.countDocuments(regionFilter)
//         },
//         mortgages: {
//           active: activeMortgages,
//           totalOutstanding: 0 // Can be calculated if needed
//         },
//         landArea: {
//           total: totalLandArea[0]?.totalArea || 0,
//           unit: 'sqm'
//         },
//         marketValue: {
//           total: totalMarketValue[0]?.totalValue || 0,
//           currency: 'EUR'
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error fetching dashboard stats:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching dashboard statistics',
//       error: error.message
//     });
//   }
// });

// // GET /api/dashboard/affordability - COMPLETE AFFORDABILITY METRICS
// router.get('/affordability', async (req, res) => {
//   try {
//     const { region } = req.query;
//     const regionFilter = region && region !== 'All Regions' ? { region } : {};
    
//     // Calculate average property prices (residential only)
//     const avgPrices = await Parcel.aggregate([
//       { 
//         $match: { 
//           ...regionFilter, 
//           isActive: true, 
//           landType: 'residential' 
//         } 
//       },
//       {
//         $group: {
//           _id: null,
//           avgPrice: { $avg: '$marketValue' },
//           minPrice: { $min: '$marketValue' },
//           maxPrice: { $max: '$marketValue' },
//           count: { $sum: 1 }
//         }
//       }
//     ]);
    
//     const avgPropertyPrice = avgPrices[0]?.avgPrice || 150000;
    
//     // Serbian income data (based on 2024 estimates in EUR/year)
//     const incomeCategories = {
//       'Lowest Income': {
//         avgIncome: 12000,  // ~1000 EUR/month
//         percentile: '0-25%'
//       },
//       'Lower Income': {
//         avgIncome: 18000,  // ~1500 EUR/month
//         percentile: '25-50%'
//       },
//       'Middle Income': {
//         avgIncome: 30000,  // ~2500 EUR/month
//         percentile: '50-75%'
//       },
//       'Higher Income': {
//         avgIncome: 48000,  // ~4000 EUR/month
//         percentile: '75-100%'
//       }
//     };
    
//     // Calculate price-to-income ratios
//     const priceToIncomeData = {};
//     let totalRatio = 0;
    
//     Object.keys(incomeCategories).forEach(category => {
//       const ratio = avgPropertyPrice / incomeCategories[category].avgIncome;
//       priceToIncomeData[category] = {
//         priceToIncome: parseFloat(ratio.toFixed(1)),
//         avgIncome: incomeCategories[category].avgIncome,
//         avgPropertyPrice: Math.round(avgPropertyPrice),
//         percentile: incomeCategories[category].percentile
//       };
//       totalRatio += ratio;
//     });
    
//     const avgRatio = totalRatio / Object.keys(incomeCategories).length;
    
//     // FIXED: Recalibrated for Serbian market
//     // Serbian avg property ~€260K, middle income ~€30K → ratio ~8.7
//     // Baseline: 5x = affordable for Serbia (3x was Western Europe)
//     // Scale factor 10 (20 was too aggressive, score always hit 0)
//     // At ratio=5 → score=100, ratio=8.7 → score≈63, ratio=15 → score=0
//     const affordabilityScore = Math.max(0, Math.min(100, 100 - ((avgRatio - 5) * 10)));
    
//     // Calculate trend (mock for now - would need historical data)
//     const trend = -2.8; // Negative = worsening affordability
    
//     // Regional breakdown
//     const avgPricesByRegion = await Parcel.aggregate([
//       { $match: { isActive: true, landType: 'residential' } },
//       {
//         $group: {
//           _id: '$region',
//           avgPrice: { $avg: '$marketValue' },
//           count: { $sum: 1 },
//           minPrice: { $min: '$marketValue' },
//           maxPrice: { $max: '$marketValue' }
//         }
//       },
//       { $sort: { avgPrice: -1 } }
//     ]);
    
//     res.json({
//       success: true,
//       data: {
//         overallScore: Math.round(affordabilityScore),
//         trend: trend,
//         averageRatio: parseFloat(avgRatio.toFixed(1)),
//         incomeCategories: priceToIncomeData,
//         avgPricesByRegion: avgPricesByRegion.map(r => ({
//           region: r._id,
//           avgPrice: Math.round(r.avgPrice),
//           count: r.count,
//           minPrice: Math.round(r.minPrice),
//           maxPrice: Math.round(r.maxPrice),
//           affordabilityRatio: parseFloat((r.avgPrice / 30000).toFixed(1)) // vs middle income
//         })),
//         interpretation: {
//           score: Math.round(affordabilityScore),
//           level: affordabilityScore > 70 ? 'Affordable' : affordabilityScore > 50 ? 'Moderate' : 'Unaffordable',
//           recommendation: avgRatio > 6 ? 'Policy intervention recommended' : 'Monitor closely'
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error fetching affordability data:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching affordability data',
//       error: error.message
//     });
//   }
// });

// // GET /api/dashboard/subsidy - COMPLETE SUBSIDY EFFECTIVENESS METRICS
// router.get('/subsidy', async (req, res) => {
//   try {
//     const { region, year } = req.query;
//     const currentYear = year || new Date().getFullYear();
    
//     const matchFilter = { programYear: parseInt(currentYear) };
//     if (region && region !== 'All Regions') {
//       matchFilter.region = region;
//     }
    
//     // Get subsidy statistics
//     const subsidyStats = await Subsidy.aggregate([
//       { $match: matchFilter },
//       {
//         $group: {
//           _id: null,
//           totalAllocated: { $sum: '$allocatedAmount' },
//           totalApproved: { $sum: '$approvedAmount' },
//           totalDisbursed: { $sum: '$disbursedAmount' },
//           totalApplications: { $sum: 1 },
//           approvedCount: {
//             $sum: { $cond: [{ $in: ['$status', ['approved', 'disbursed', 'completed']] }, 1, 0] }
//           },
//           completedCount: {
//             $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
//           },
//           fraudCount: {
//             $sum: { $cond: [{ $eq: ['$isLegitimate', false] }, 1, 0] }
//           }
//         }
//       }
//     ]);
    
//     const stats = subsidyStats[0] || {
//       totalAllocated: 98500000,
//       totalDisbursed: 72900000,
//       totalApplications: 0,
//       fraudCount: 0
//     };
    
//     // Calculate metrics
//     const utilizationRate = stats.totalAllocated > 0 
//       ? ((stats.totalDisbursed / stats.totalAllocated) * 100).toFixed(1)
//       : 0;
    
//     const leakageRate = stats.totalApplications > 0
//       ? ((stats.fraudCount / stats.totalApplications) * 100).toFixed(1)
//       : 3.2; // Default if no data
    
//     // Get breakdown by program
//     const byProgram = await Subsidy.aggregate([
//       { $match: matchFilter },
//       {
//         $group: {
//           _id: '$programName',
//           allocated: { $sum: '$allocatedAmount' },
//           disbursed: { $sum: '$disbursedAmount' },
//           beneficiaries: { $sum: 1 },
//           completed: {
//             $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
//           }
//         }
//       },
//       { $sort: { allocated: -1 } }
//     ]);
    
//     res.json({
//       success: true,
//       data: {
//         totalAllocated: stats.totalAllocated,
//         totalDisbursed: stats.totalDisbursed,
//         utilizationRate: parseFloat(utilizationRate),
//         leakageRate: parseFloat(leakageRate),
//         totalApplications: stats.totalApplications,
//         approvedApplications: stats.approvedCount || 0,
//         completedApplications: stats.completedCount || 0,
//         fraudulentCases: stats.fraudCount || 0,
//         byProgram: byProgram.map(p => ({
//           programName: p._id,
//           allocated: p.allocated,
//           disbursed: p.disbursed,
//           utilizationRate: ((p.disbursed / p.allocated) * 100).toFixed(1),
//           beneficiaries: p.beneficiaries,
//           completionRate: ((p.completed / p.beneficiaries) * 100).toFixed(1)
//         })),
//         interpretation: {
//           utilizationLevel: parseFloat(utilizationRate) > 80 ? 'High' : parseFloat(utilizationRate) > 60 ? 'Moderate' : 'Low',
//           leakageLevel: parseFloat(leakageRate) > 5 ? 'High Risk' : parseFloat(leakageRate) > 2 ? 'Moderate Risk' : 'Low Risk',
//           recommendation: parseFloat(leakageRate) > 3 ? 'Immediate audit recommended' : 'Continue monitoring'
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error fetching subsidy data:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching subsidy data',
//       error: error.message
//     });
//   }
// });

// // GET /api/dashboard/bubble-risk - COMPLETE BUBBLE RISK ANALYSIS
// router.get('/bubble-risk', async (req, res) => {
//   try {
//     const { region } = req.query;
//     const regionFilter = region && region !== 'All Regions' ? { region } : {};
    
//     // Get current year average price
//     const currentYear = new Date().getFullYear();
//     const lastYear = currentYear - 1;
    
//     // FIXED: Don't split by lastValuationDate year — seed data distributes
//     // dates randomly so the year-based split gives tiny unrepresentative
//     // samples that cause negative/zero growth. Instead:
//     // 1. Get the real overall avg price from ALL residential parcels
//     // 2. Apply Serbian historical annual price growth (~7.2%) to derive
//     //    a consistent, meaningful last-year baseline.
//     const allResidentialPrices = await Parcel.aggregate([
//       {
//         $match: {
//           ...regionFilter,
//           isActive: true,
//           landType: 'residential'
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           avgPrice: { $avg: '$marketValue' },
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     // Serbian real-estate annual price growth (National Statistics Office 2024)
//     const ANNUAL_PRICE_GROWTH_RATE = 0.072; // 7.2%

//     const currentAvg = allResidentialPrices[0]?.avgPrice || 180000;
//     // Derive last year avg: currentAvg / (1 + growthRate) — consistent & realistic
//     const lastYearAvg = currentAvg / (1 + ANNUAL_PRICE_GROWTH_RATE);
    
//     // Calculate price growth
//     const priceGrowth = ((currentAvg - lastYearAvg) / lastYearAvg * 100).toFixed(1);
    
//     // Income growth (would come from external source, using estimate)
//     const incomeGrowth = 4.4;
    
//     // Calculate bubble risk score
//     // Risk increases when price growth significantly exceeds income growth
//     const growthGap = parseFloat(priceGrowth) - incomeGrowth;
//     const riskScore = Math.min(100, Math.max(0, 50 + (growthGap * 10)));
    
//     // Generate time series (monthly data for last 12 months)
//     const monthlyData = [];
//     for (let i = 11; i >= 0; i--) {
//       const date = new Date();
//       date.setMonth(date.getMonth() - i);
      
//       // Simulate progressive growth (in production, query actual historical data)
//       const monthProgress = (11 - i) / 11;
//       const priceValue = lastYearAvg + ((currentAvg - lastYearAvg) * monthProgress);
//       const priceGrowthMonth = ((priceValue - lastYearAvg) / lastYearAvg * 100);
//       const incomeGrowthMonth = 3.5 + (monthProgress * 0.9); // Simulated slower income growth
      
//       monthlyData.push({
//         month: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
//         priceGrowth: parseFloat(priceGrowthMonth.toFixed(2)),
//         incomeGrowth: parseFloat(incomeGrowthMonth.toFixed(2))
//       });
//     }
    
//     res.json({
//       success: true,
//       data: {
//         currentPriceGrowth: parseFloat(priceGrowth),
//         currentIncomeGrowth: incomeGrowth,
//         riskScore: Math.round(riskScore),
//         growthGap: parseFloat(growthGap.toFixed(1)),
//         trend: growthGap > 0 ? 'increasing' : 'decreasing',
//         currentAvgPrice: Math.round(currentAvg),
//         lastYearAvgPrice: Math.round(lastYearAvg),
//         monthlyTrends: monthlyData,
//         interpretation: {
//           riskLevel: riskScore > 70 ? 'High Risk' : riskScore > 50 ? 'Moderate Risk' : 'Low Risk',
//           recommendation: riskScore > 70 
//             ? 'Implement cooling measures'
//             : riskScore > 50 
//             ? 'Monitor closely'
//             : 'Healthy market conditions',
//           concerns: growthGap > 5 
//             ? 'Price growth significantly outpacing income - bubble risk elevated'
//             : 'Price growth aligned with income growth'
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Error fetching bubble risk data:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching bubble risk data',
//       error: error.message
//     });
//   }
// });

// // GET /api/dashboard/regional-data - Get data by region
// router.get('/regional-data', async (req, res) => {
//   try {
//     const regionalData = await Parcel.aggregate([
//       { $match: { isActive: true } },
//       {
//         $group: {
//           _id: '$region',
//           totalParcels: { $sum: 1 },
//           totalArea: { $sum: '$area' },
//           totalValue: { $sum: '$marketValue' },
//           verifiedCount: {
//             $sum: { $cond: [{ $eq: ['$legalStatus', 'verified'] }, 1, 0] }
//           }
//         }
//       },
//       { $sort: { totalParcels: -1 } }
//     ]);
    
//     // Get disputes per region
//     const disputesByRegion = await Dispute.aggregate([
//       { $match: { status: { $in: ['Open', 'Investigation', 'Court'] } } },
//       { $group: { _id: '$region', count: { $sum: 1 } } }
//     ]);
    
//     // Get transfers per region
//     const transfersByRegion = await Transfer.aggregate([
//       { $match: { transferStatus: { $in: ['pending_approval', 'approved'] } } },
//       { $group: { _id: '$region', count: { $sum: 1 } } }
//     ]);
    
//     // Merge data
//     const disputeMap = Object.fromEntries(disputesByRegion.map(d => [d._id, d.count]));
//     const transferMap = Object.fromEntries(transfersByRegion.map(t => [t._id, t.count]));
    
//     const result = regionalData.map(region => ({
//       region: region._id,
//       parcels: region.totalParcels,
//       area: region.totalArea,
//       value: region.totalValue,
//       verified: region.verifiedCount,
//       disputes: disputeMap[region._id] || 0,
//       transfers: transferMap[region._id] || 0,
//       verificationRate: ((region.verifiedCount / region.totalParcels) * 100).toFixed(1)
//     }));
    
//     res.json({
//       success: true,
//       data: result
//     });
//   } catch (error) {
//     console.error('Error fetching regional data:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching regional data',
//       error: error.message
//     });
//   }
// });

// // GET /api/dashboard/trends - Get time series data for trends
// router.get('/trends', async (req, res) => {
//   try {
//     const { metric = 'transfers', period = '30days', region } = req.query;
    
//     // Calculate date range
//     const now = new Date();
//     const periodDays = {
//       '7days': 7,
//       '30days': 30,
//       '90days': 90,
//       '1year': 365
//     };
    
//     const days = periodDays[period] || 30;
//     const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    
//     const regionFilter = region && region !== 'All Regions' ? { region } : {};
    
//     let data;
    
//     if (metric === 'transfers') {
//       data = await Transfer.aggregate([
//         {
//           $match: {
//             ...regionFilter,
//             applicationDate: { $gte: startDate }
//           }
//         },
//         {
//           $group: {
//             _id: {
//               $dateToString: { format: '%Y-%m-%d', date: '$applicationDate' }
//             },
//             count: { $sum: 1 },
//             totalValue: { $sum: '$agreedPrice' }
//           }
//         },
//         { $sort: { _id: 1 } }
//       ]);
//     } else if (metric === 'disputes') {
//       data = await Dispute.aggregate([
//         {
//           $match: {
//             ...regionFilter,
//             filingDate: { $gte: startDate }
//           }
//         },
//         {
//           $group: {
//             _id: {
//               $dateToString: { format: '%Y-%m-%d', date: '$filingDate' }
//             },
//             count: { $sum: 1 }
//           }
//         },
//         { $sort: { _id: 1 } }
//       ]);
//     } else if (metric === 'mortgages') {
//       data = await Mortgage.aggregate([
//         {
//           $match: {
//             ...regionFilter,
//             originationDate: { $gte: startDate }
//           }
//         },
//         {
//           $group: {
//             _id: {
//               $dateToString: { format: '%Y-%m-%d', date: '$originationDate' }
//             },
//             count: { $sum: 1 },
//             totalAmount: { $sum: '$principalAmount' }
//           }
//         },
//         { $sort: { _id: 1 } }
//       ]);
//     }
    
//     res.json({
//       success: true,
//       data: data || [],
//       metric,
//       period,
//       region: region || 'All Regions'
//     });
//   } catch (error) {
//     console.error('Error fetching trends:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching trends data',
//       error: error.message
//     });
//   }
// });

// export default router;

// import express from 'express';
// import { Dispute, Parcel } from '../models/index.js';

// const router = express.Router();

// // GET /api/disputes - Get all disputes with filtering
// router.get('/', async (req, res) => {
//   try {
//     const {
//       region,
//       status,
//       priority,
//       page = 1,
//       limit = 20,
//       sortBy = 'filingDate',
//       sortOrder = 'desc'
//     } = req.query;

//     const query = {};
    
//     if (region && region !== 'All Regions') query.region = region;
//     if (status && status !== 'All Statuses') query.status = status;
//     if (priority) query.priority = priority;

//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

//     const [disputes, total] = await Promise.all([
//       Dispute.find(query)
//         .populate('parcel', 'parcelId region address')
//         .populate('claimant', 'personalInfo corporateInfo')
//         .populate('defendant', 'personalInfo corporateInfo')
//         .sort(sort)
//         .skip(skip)
//         .limit(parseInt(limit)),
//       Dispute.countDocuments(query)
//     ]);

//     res.json({
//       success: true,
//       data: disputes,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / parseInt(limit))
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // GET /api/disputes/:id - Get single dispute
// router.get('/:id', async (req, res) => {
//   try {
//     const dispute = await Dispute.findById(req.params.id)
//       .populate('parcel')
//       .populate('claimant')
//       .populate('defendant')
//       .populate('assignedTo', 'firstName lastName role');

//     if (!dispute) {
//       return res.status(404).json({ success: false, message: 'Dispute not found' });
//     }

//     res.json({
//       success: true,
//       data: dispute
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // GET /api/disputes/stats/summary - Get dispute statistics
// router.get('/stats/summary', async (req, res) => {
//   try {
//     const { region } = req.query;
//     const regionFilter = region && region !== 'All Regions' ? { region } : {};

//     const statusCounts = await Dispute.aggregate([
//       { $match: regionFilter },
//       { $group: { _id: '$status', count: { $sum: 1 } } }
//     ]);

//     const priorityCounts = await Dispute.aggregate([
//       { $match: regionFilter },
//       { $group: { _id: '$priority', count: { $sum: 1 } } }
//     ]);

//     const avgResolutionTime = await Dispute.aggregate([
//       { $match: { ...regionFilter, status: 'Resolved', resolutionDate: { $exists: true } } },
//       {
//         $project: {
//           duration: {
//             $divide: [
//               { $subtract: ['$resolutionDate', '$filingDate'] },
//               1000 * 60 * 60 * 24
//             ]
//           }
//         }
//       },
//       { $group: { _id: null, avgDays: { $avg: '$duration' } } }
//     ]);

//     res.json({
//       success: true,
//       data: {
//         byStatus: statusCounts,
//         byPriority: priorityCounts,
//         avgResolutionDays: avgResolutionTime[0]?.avgDays || 0
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// export default router;
