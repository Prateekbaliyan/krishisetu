import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { calculateProcurement } from '../src/lib/calculations';
import { generateAuditHash } from '../src/lib/crypto';
import { generateBankBulkPaymentCsv } from '../src/lib/bankCsvAdapter';
import { formatMarathiSms } from '../src/lib/smsSimulator';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting KrishiSetu database seeding...');

  // 1. Clean existing records in sequence
  await prisma.smsLog.deleteMany({});
  await prisma.anomalyFlag.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.paymentRun.deleteMany({});
  await prisma.dispatch.deleteMany({});
  await prisma.priceHistory.deleteMany({});
  await prisma.priceBoard.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.syncRecord.deleteMany({});
  await prisma.farmer.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.collectionCentre.deleteMany({});

  // 2. Seed 5 Collection Centres in Latur district
  const centresData = [
    {
      code: 'C07',
      name: 'Ausa Central Collection Centre',
      village: 'Ausa',
      taluka: 'Ausa',
      district: 'Latur',
      operatorName: 'Dnyaneshwar Shinde',
      contactNumber: '9822012345'
    },
    {
      code: 'C12',
      name: 'Renapur Mandi Procurement Hub',
      village: 'Renapur',
      taluka: 'Renapur',
      district: 'Latur',
      operatorName: 'Balaji Patil',
      contactNumber: '9822054321'
    },
    {
      code: 'C01',
      name: 'Shirur Anantpal Farmers Centre',
      village: 'Shirur Anantpal',
      taluka: 'Shirur Anantpal',
      district: 'Latur',
      operatorName: 'Ganesh More',
      contactNumber: '9822098765'
    },
    {
      code: 'C03',
      name: 'Nilanga Agro Collection Centre',
      village: 'Nilanga',
      taluka: 'Nilanga',
      district: 'Latur',
      operatorName: 'Prakash Deshmukh',
      contactNumber: '9822045678'
    },
    {
      code: 'C18',
      name: 'Udgir Taluka Grain Hub',
      village: 'Udgir',
      taluka: 'Udgir',
      district: 'Latur',
      operatorName: 'Anil Kadam',
      contactNumber: '9822067890'
    }
  ];

  const centres: Record<string, any> = {};
  for (const c of centresData) {
    centres[c.code] = await prisma.collectionCentre.create({ data: c });
  }
  console.log(`✅ Seeded ${Object.keys(centres).length} collection centres.`);

  // 3. Seed Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@krishisetu.in',
      passwordHash,
      fullName: 'Vikramrao Deshmukh',
      role: 'MANAGER',
      centreId: null
    }
  });

  const operatorUser = await prisma.user.create({
    data: {
      email: 'operator.c07@krishisetu.in',
      passwordHash,
      fullName: 'Dnyaneshwar Shinde',
      role: 'OPERATOR',
      centreId: centres['C07'].id
    }
  });

  console.log('✅ Seeded demo accounts: Office Manager and Centre Operator.');

  // 4. Seed Daily Price Board and History
  const effectiveDate = new Date().toISOString().split('T')[0];
  const activePrices = [
    { crop: 'Soybean', grade: 'Grade A', ratePerQuintal: 4850.00 },
    { crop: 'Soybean', grade: 'FAQ', ratePerQuintal: 4650.00 },
    { crop: 'Tur', grade: 'Grade A', ratePerQuintal: 7200.00 },
    { crop: 'Tur', grade: 'FAQ', ratePerQuintal: 6950.00 }
  ];

  for (const p of activePrices) {
    await prisma.priceBoard.create({
      data: {
        ...p,
        effectiveDate,
        publishedBy: managerUser.fullName,
        isActive: true
      }
    });

    await prisma.priceHistory.create({
      data: {
        ...p,
        effectiveDate,
        changedBy: managerUser.fullName,
        changeReason: 'Daily MSP and Quality Grid Publication'
      }
    });
  }

  // Previous week prices for history
  await prisma.priceHistory.create({
    data: {
      crop: 'Soybean',
      grade: 'Grade A',
      ratePerQuintal: 4800.00,
      effectiveDate: '2026-10-28',
      changedBy: managerUser.fullName,
      changeReason: 'Weekly Opening Benchmark'
    }
  });
  console.log('✅ Seeded daily price board and historical rates.');

  // 5. Seed 35 Realistic Fictional Farmers (including Sunil, Kamal, Mohan)
  const fictionalFarmers = [
    // The 3 exact sample farmers
    {
      farmerId: 'MH-LTR-1001',
      fullName: 'Sunil Jadhav',
      village: 'Belkund',
      centreCode: 'C07',
      landAreaAcres: 6.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Sunil Baban Jadhav',
      bankAccountNumber: '60124458901',
      ifscCode: 'MAHB0000214',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110001'
    },
    {
      farmerId: 'MH-LTR-1002',
      fullName: 'Kamal Shinde',
      village: 'Almala',
      centreCode: 'C07',
      landAreaAcres: 4.5,
      primaryCrop: 'Soybean',
      bankAccountName: 'Kamal Sopan Shinde',
      bankAccountNumber: '30458891234',
      ifscCode: 'SBIN0001452',
      bankName: 'State Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110002'
    },
    {
      farmerId: 'MH-LTR-1003',
      fullName: 'Mohan Biradar',
      village: 'Renapur Khurd',
      centreCode: 'C12',
      landAreaAcres: 5.0,
      primaryCrop: 'Tur',
      bankAccountName: 'Mohan Tukaram Biradar',
      bankAccountNumber: '5201010045678',
      ifscCode: 'UBIN0552011',
      bankName: 'Union Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110003'
    },
    // Supporting farmers across centres
    {
      farmerId: 'MH-LTR-1004',
      fullName: 'Pandurang Bhosale',
      village: 'Matola',
      centreCode: 'C07',
      landAreaAcres: 8.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Pandurang R. Bhosale',
      bankAccountNumber: '60199451234',
      ifscCode: 'MAHB0000214',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110004'
    },
    {
      farmerId: 'MH-LTR-1005',
      fullName: 'Suresh Rathod',
      village: 'Lamjana',
      centreCode: 'C07',
      landAreaAcres: 3.5,
      primaryCrop: 'Soybean',
      bankAccountName: 'Suresh L. Rathod',
      bankAccountNumber: '30125587412',
      ifscCode: 'SBIN0001452',
      bankName: 'State Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110005'
    },
    {
      farmerId: 'MH-LTR-1006',
      fullName: 'Anusaya Gaikwad',
      village: 'Kasar Sirsi',
      centreCode: 'C03',
      landAreaAcres: 2.5,
      primaryCrop: 'Soybean',
      bankAccountName: 'Anusaya B. Gaikwad',
      bankAccountNumber: '20145589632',
      ifscCode: 'MAHB0000318',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110006'
    },
    {
      farmerId: 'MH-LTR-1007',
      fullName: 'Ganesh Chavan',
      village: 'Aurad Shahajani',
      centreCode: 'C03',
      landAreaAcres: 7.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Ganesh K. Chavan',
      bankAccountNumber: '60144785236',
      ifscCode: 'MAHB0000318',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110007'
    },
    {
      farmerId: 'MH-LTR-1008',
      fullName: 'Balasaheb Kadam',
      village: 'Hasori',
      centreCode: 'C03',
      landAreaAcres: 5.5,
      primaryCrop: 'Tur',
      bankAccountName: 'Balasaheb T. Kadam',
      bankAccountNumber: '30147852369',
      ifscCode: 'SBIN0001890',
      bankName: 'State Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110008'
    },
    {
      farmerId: 'MH-LTR-1009',
      fullName: 'Madhavrao Mane',
      village: 'Deoni',
      centreCode: 'C01',
      landAreaAcres: 6.5,
      primaryCrop: 'Soybean',
      bankAccountName: 'Madhavrao V. Mane',
      bankAccountNumber: '60188954123',
      ifscCode: 'MAHB0000452',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110009'
    },
    {
      farmerId: 'MH-LTR-1010',
      fullName: 'Shrikant Mule',
      village: 'Shirur',
      centreCode: 'C01',
      landAreaAcres: 4.0,
      primaryCrop: 'Tur',
      bankAccountName: 'Shrikant D. Mule',
      bankAccountNumber: '5201018874521',
      ifscCode: 'UBIN0552011',
      bankName: 'Union Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110010'
    },
    {
      farmerId: 'MH-LTR-1011',
      fullName: 'Laxman Dhas',
      village: 'Chakur',
      centreCode: 'C12',
      landAreaAcres: 3.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Laxman M. Dhas',
      bankAccountNumber: '30258963147',
      ifscCode: 'SBIN0001452',
      bankName: 'State Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110011'
    },
    {
      farmerId: 'MH-LTR-1012',
      fullName: 'Vijaykumar Suryawanshi',
      village: 'Nalegaon',
      centreCode: 'C12',
      landAreaAcres: 9.0,
      primaryCrop: 'Tur',
      bankAccountName: 'Vijaykumar P. Suryawanshi',
      bankAccountNumber: '60133256987',
      ifscCode: 'MAHB0000214',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110012'
    },
    {
      farmerId: 'MH-LTR-1013',
      fullName: 'Govind Somwanshi',
      village: 'Udgir Rural',
      centreCode: 'C18',
      landAreaAcres: 10.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Govind R. Somwanshi',
      bankAccountNumber: '60199852147',
      ifscCode: 'MAHB0000185',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110013'
    },
    {
      farmerId: 'MH-LTR-1014',
      fullName: 'Rajendra Kendre',
      village: 'Wadhona',
      centreCode: 'C18',
      landAreaAcres: 4.0,
      primaryCrop: 'Tur',
      bankAccountName: 'Rajendra B. Kendre',
      bankAccountNumber: '30147896541',
      ifscCode: 'SBIN0001890',
      bankName: 'State Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110014'
    },
    {
      farmerId: 'MH-LTR-1015',
      fullName: 'Baburao Solanke',
      village: 'Ausa',
      centreCode: 'C07',
      landAreaAcres: 2.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Baburao K. Solanke',
      bankAccountNumber: '60188741235',
      ifscCode: 'MAHB0000214',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'PENDING', // Demo unverified bank status
      mobileNumber: '9822110015'
    },
    // Adding 15 more farmers for full regional depth
    {
      farmerId: 'MH-LTR-1016',
      fullName: 'Ashok Giri',
      village: 'Belkund',
      centreCode: 'C07',
      landAreaAcres: 5.2,
      primaryCrop: 'Soybean',
      bankAccountName: 'Ashok M. Giri',
      bankAccountNumber: '60155236987',
      ifscCode: 'MAHB0000214',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110016'
    },
    {
      farmerId: 'MH-LTR-1017',
      fullName: 'Bhausaheb Thavare',
      village: 'Almala',
      centreCode: 'C07',
      landAreaAcres: 7.5,
      primaryCrop: 'Soybean',
      bankAccountName: 'Bhausaheb G. Thavare',
      bankAccountNumber: '30214589632',
      ifscCode: 'SBIN0001452',
      bankName: 'State Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110017'
    },
    {
      farmerId: 'MH-LTR-1018',
      fullName: 'Uttam Waghmare',
      village: 'Matola',
      centreCode: 'C07',
      landAreaAcres: 3.8,
      primaryCrop: 'Tur',
      bankAccountName: 'Uttam S. Waghmare',
      bankAccountNumber: '60177485214',
      ifscCode: 'MAHB0000214',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110018'
    },
    {
      farmerId: 'MH-LTR-1019',
      fullName: 'Tukaram Mote',
      village: 'Lamjana',
      centreCode: 'C07',
      landAreaAcres: 6.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Tukaram N. Mote',
      bankAccountNumber: '5201019658741',
      ifscCode: 'UBIN0552011',
      bankName: 'Union Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110019'
    },
    {
      farmerId: 'MH-LTR-1020',
      fullName: 'Kashinath Pawar',
      village: 'Renapur Khurd',
      centreCode: 'C12',
      landAreaAcres: 4.2,
      primaryCrop: 'Tur',
      bankAccountName: 'Kashinath R. Pawar',
      bankAccountNumber: '30125896314',
      ifscCode: 'SBIN0001452',
      bankName: 'State Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110020'
    },
    {
      farmerId: 'MH-LTR-1021',
      fullName: 'Santosh Garad',
      village: 'Chakur',
      centreCode: 'C12',
      landAreaAcres: 8.5,
      primaryCrop: 'Soybean',
      bankAccountName: 'Santosh K. Garad',
      bankAccountNumber: '60133698521',
      ifscCode: 'MAHB0000214',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110021'
    },
    {
      farmerId: 'MH-LTR-1022',
      fullName: 'Bhimrao Kamble',
      village: 'Nalegaon',
      centreCode: 'C12',
      landAreaAcres: 3.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Bhimrao S. Kamble',
      bankAccountNumber: '30245698741',
      ifscCode: 'SBIN0001452',
      bankName: 'State Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110022'
    },
    {
      farmerId: 'MH-LTR-1023',
      fullName: 'Prabhakar Kulkarni',
      village: 'Shirur',
      centreCode: 'C01',
      landAreaAcres: 12.0,
      primaryCrop: 'Tur',
      bankAccountName: 'Prabhakar V. Kulkarni',
      bankAccountNumber: '60144589632',
      ifscCode: 'MAHB0000452',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110023'
    },
    {
      farmerId: 'MH-LTR-1024',
      fullName: 'Maroti Lokhande',
      village: 'Deoni',
      centreCode: 'C01',
      landAreaAcres: 5.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Maroti B. Lokhande',
      bankAccountNumber: '5201017412589',
      ifscCode: 'UBIN0552011',
      bankName: 'Union Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110024'
    },
    {
      farmerId: 'MH-LTR-1025',
      fullName: 'Dhanraj Panchal',
      village: 'Kasar Sirsi',
      centreCode: 'C03',
      landAreaAcres: 4.8,
      primaryCrop: 'Soybean',
      bankAccountName: 'Dhanraj G. Panchal',
      bankAccountNumber: '60188965412',
      ifscCode: 'MAHB0000318',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110025'
    },
    {
      farmerId: 'MH-LTR-1026',
      fullName: 'Appasaheb Sutar',
      village: 'Aurad Shahajani',
      centreCode: 'C03',
      landAreaAcres: 6.2,
      primaryCrop: 'Tur',
      bankAccountName: 'Appasaheb M. Sutar',
      bankAccountNumber: '30145879632',
      ifscCode: 'SBIN0001890',
      bankName: 'State Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110026'
    },
    {
      farmerId: 'MH-LTR-1027',
      fullName: 'Vasantrao Thorat',
      village: 'Hasori',
      centreCode: 'C03',
      landAreaAcres: 9.5,
      primaryCrop: 'Soybean',
      bankAccountName: 'Vasantrao K. Thorat',
      bankAccountNumber: '60199658741',
      ifscCode: 'MAHB0000318',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110027'
    },
    {
      farmerId: 'MH-LTR-1028',
      fullName: 'Kalyan Devkate',
      village: 'Udgir Rural',
      centreCode: 'C18',
      landAreaAcres: 7.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Kalyan P. Devkate',
      bankAccountNumber: '60177896541',
      ifscCode: 'MAHB0000185',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110028'
    },
    {
      farmerId: 'MH-LTR-1029',
      fullName: 'Namdeo Sawant',
      village: 'Wadhona',
      centreCode: 'C18',
      landAreaAcres: 5.5,
      primaryCrop: 'Tur',
      bankAccountName: 'Namdeo R. Sawant',
      bankAccountNumber: '30258741963',
      ifscCode: 'SBIN0001890',
      bankName: 'State Bank of India',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110029'
    },
    {
      farmerId: 'MH-LTR-1030',
      fullName: 'Rameshwar Shelke',
      village: 'Belkund',
      centreCode: 'C07',
      landAreaAcres: 4.0,
      primaryCrop: 'Soybean',
      bankAccountName: 'Rameshwar B. Shelke',
      bankAccountNumber: '60122365412',
      ifscCode: 'MAHB0000214',
      bankName: 'Bank of Maharashtra',
      bankVerificationStatus: 'VERIFIED',
      mobileNumber: '9822110030'
    }
  ];

  const farmers: Record<string, any> = {};
  for (const f of fictionalFarmers) {
    const centre = centres[f.centreCode];
    const created = await prisma.farmer.create({
      data: {
        farmerId: f.farmerId,
        fullName: f.fullName,
        village: f.village,
        centreId: centre.id,
        landAreaAcres: f.landAreaAcres,
        primaryCrop: f.primaryCrop,
        bankAccountName: f.bankAccountName,
        bankAccountNumber: f.bankAccountNumber,
        ifscCode: f.ifscCode,
        bankName: f.bankName,
        bankVerificationStatus: f.bankVerificationStatus,
        mobileNumber: f.mobileNumber
      }
    });
    farmers[f.farmerId] = created;
  }
  console.log(`✅ Seeded ${Object.keys(farmers).length} farmers.`);

  // 6. Seed the 3 Exact Sample Purchases mandated by the prompt:
  // C07-24518 | Sunil Jadhav | Soybean | Gross 1250.0 kg | Tare 18.0 kg | Moisture 11.5% | Net 1232.0 kg | Rate ₹4850/quintal | Amount ₹59752.00
  // C07-24519 | Kamal Shinde | Soybean | Gross 860.0 kg | Tare 12.0 kg | Moisture 14.0% | Net 831.0 kg | Rate ₹4850/quintal | Amount ₹40303.50
  // C12-08876 | Mohan Biradar | Tur | Gross 640.0 kg | Tare 10.0 kg | Moisture 10.0% | Net 630.0 kg | Rate ₹7200/quintal | Amount ₹45360.00

  const exactPurchases = [
    {
      slipNumber: 'C07-24518',
      farmerIdKey: 'MH-LTR-1001', // Sunil Jadhav
      centreCode: 'C07',
      crop: 'Soybean',
      grade: 'Grade A',
      grossWeight: 1250.0,
      tareWeight: 18.0,
      moisture: 11.5,
      ratePerQuintal: 4850.00,
      status: 'APPROVED',
      isFlagged: false,
      aiVerificationStatus: 'MATCH',
      scaleAiWeight: 1250.0,
      moistureAiValue: 11.5,
      aiConfidence: 0.95
    },
    {
      slipNumber: 'C07-24519',
      farmerIdKey: 'MH-LTR-1002', // Kamal Shinde
      centreCode: 'C07',
      crop: 'Soybean',
      grade: 'Grade A',
      grossWeight: 860.0,
      tareWeight: 12.0,
      moisture: 14.0,
      ratePerQuintal: 4850.00,
      status: 'APPROVED',
      isFlagged: false,
      aiVerificationStatus: 'MATCH',
      scaleAiWeight: 860.0,
      moistureAiValue: 14.0,
      aiConfidence: 0.92
    },
    {
      slipNumber: 'C12-08876',
      farmerIdKey: 'MH-LTR-1003', // Mohan Biradar
      centreCode: 'C12',
      crop: 'Tur',
      grade: 'Grade A',
      grossWeight: 640.0,
      tareWeight: 10.0,
      moisture: 10.0,
      ratePerQuintal: 7200.00,
      status: 'APPROVED',
      isFlagged: false,
      aiVerificationStatus: 'MATCH',
      scaleAiWeight: 640.0,
      moistureAiValue: 10.0,
      aiConfidence: 0.97
    }
  ];

  const createdPurchases: any[] = [];

  for (const ep of exactPurchases) {
    const farmer = farmers[ep.farmerIdKey];
    const centre = centres[ep.centreCode];

    const calc = calculateProcurement({
      grossWeight: ep.grossWeight,
      tareWeight: ep.tareWeight,
      moisture: ep.moisture,
      ratePerQuintal: ep.ratePerQuintal
    });

    const p = await prisma.purchase.create({
      data: {
        slipNumber: ep.slipNumber,
        idempotencyKey: uuidv4(),
        farmerId: farmer.id,
        centreId: centre.id,
        crop: ep.crop,
        grade: ep.grade,
        grossWeight: ep.grossWeight,
        tareWeight: ep.tareWeight,
        actualWeight: calc.actualWeight,
        moisture: ep.moisture,
        moistureDeductionPercent: calc.moistureDeductionPercent,
        netWeight: calc.netWeight,
        ratePerQuintal: ep.ratePerQuintal,
        totalAmount: calc.totalAmount,
        status: ep.status,
        scaleAiWeight: ep.scaleAiWeight,
        moistureAiValue: ep.moistureAiValue,
        aiConfidence: ep.aiConfidence,
        aiVerificationStatus: ep.aiVerificationStatus,
        paymentEligibility: true,
        isFlagged: ep.isFlagged,
        clientDeviceTimestamp: new Date(),
        localCreationTimestamp: new Date(),
        serverReceivedTimestamp: new Date(),
        syncStatus: 'SYNCED'
      }
    });

    createdPurchases.push(p);

    // SMS log
    const smsMsg = formatMarathiSms({
      farmerName: farmer.fullName,
      farmerMobile: farmer.mobileNumber,
      crop: p.crop,
      slipNumber: p.slipNumber,
      grossWeight: p.grossWeight,
      netWeight: p.netWeight,
      rate: p.ratePerQuintal,
      amount: p.totalAmount
    });

    await prisma.smsLog.create({
      data: {
        purchaseId: p.id,
        farmerMobile: farmer.mobileNumber,
        farmerName: farmer.fullName,
        message: smsMsg,
        status: 'DELIVERED',
        providerResponse: `SIMULATED_MOCK_GATEWAY_ACK_${p.slipNumber}`
      }
    });
  }
  console.log('✅ Seeded 3 EXACT required purchases (C07-24518, C07-24519, C12-08876).');

  // 7. Seed Flagged Anomaly Purchases for Demo Review Queue
  // Anomaly 1: Unusual weight compared to land area (farmer with 2 acres bringing 6,500 kg Soybean)
  const smallFarmer = farmers['MH-LTR-1015']; // Baburao Solanke (2.0 acres)
  const calcAnomaly1 = calculateProcurement({
    grossWeight: 6520.0,
    tareWeight: 20.0,
    moisture: 12.0,
    ratePerQuintal: 4850.00
  });

  const flaggedPurchase1 = await prisma.purchase.create({
    data: {
      slipNumber: 'C07-24520',
      idempotencyKey: uuidv4(),
      farmerId: smallFarmer.id,
      centreId: centres['C07'].id,
      crop: 'Soybean',
      grade: 'Grade A',
      grossWeight: 6520.0,
      tareWeight: 20.0,
      actualWeight: calcAnomaly1.actualWeight,
      moisture: 12.0,
      moistureDeductionPercent: calcAnomaly1.moistureDeductionPercent,
      netWeight: calcAnomaly1.netWeight,
      ratePerQuintal: 4850.00,
      totalAmount: calcAnomaly1.totalAmount,
      status: 'FLAGGED',
      isFlagged: true,
      flagReason: `Net weight of ${calcAnomaly1.netWeight} kg exceeds the expected single delivery threshold for ${smallFarmer.landAreaAcres} acres of Soybean.`,
      paymentEligibility: false,
      syncStatus: 'SYNCED'
    }
  });

  await prisma.anomalyFlag.create({
    data: {
      purchaseId: flaggedPurchase1.id,
      flagType: 'WEIGHT_EXCEEDS_LAND_BENCHMARK',
      severity: 'HIGH',
      description: flaggedPurchase1.flagReason!,
      details: JSON.stringify({
        landAreaAcres: smallFarmer.landAreaAcres,
        netWeight: calcAnomaly1.netWeight,
        maxExpectedSingleLot: smallFarmer.landAreaAcres * 1200 * 1.5
      }),
      status: 'OPEN'
    }
  });

  // Anomaly 2: Duplicate purchase within 1 hour by same farmer
  const sunil = farmers['MH-LTR-1001'];
  const calcAnomaly2 = calculateProcurement({
    grossWeight: 1100.0,
    tareWeight: 15.0,
    moisture: 11.8,
    ratePerQuintal: 4850.00
  });

  const flaggedPurchase2 = await prisma.purchase.create({
    data: {
      slipNumber: 'C07-24521',
      idempotencyKey: uuidv4(),
      farmerId: sunil.id,
      centreId: centres['C07'].id,
      crop: 'Soybean',
      grade: 'Grade A',
      grossWeight: 1100.0,
      tareWeight: 15.0,
      actualWeight: calcAnomaly2.actualWeight,
      moisture: 11.8,
      moistureDeductionPercent: calcAnomaly2.moistureDeductionPercent,
      netWeight: calcAnomaly2.netWeight,
      ratePerQuintal: 4850.00,
      totalAmount: calcAnomaly2.totalAmount,
      status: 'FLAGGED',
      isFlagged: true,
      flagReason: 'Farmer already completed purchase C07-24518 within the last 60 minutes. Potential duplicate entry.',
      paymentEligibility: false,
      syncStatus: 'SYNCED'
    }
  });

  await prisma.anomalyFlag.create({
    data: {
      purchaseId: flaggedPurchase2.id,
      flagType: 'DUPLICATE_HOUR_PURCHASE',
      severity: 'HIGH',
      description: flaggedPurchase2.flagReason!,
      details: JSON.stringify({
        precedingSlip: 'C07-24518',
        windowMinutes: 60
      }),
      status: 'OPEN'
    }
  });

  console.log('✅ Seeded flagged purchases for anomaly review queue.');

  // 8. Seed Additional Approved Purchases across other centres
  const additionalPurchasesData = [
    { farmerKey: 'MH-LTR-1004', centreCode: 'C07', crop: 'Soybean', grade: 'Grade A', gross: 2400.0, tare: 25.0, moisture: 12.5, rate: 4850 },
    { farmerKey: 'MH-LTR-1005', centreCode: 'C07', crop: 'Soybean', grade: 'Grade A', gross: 1850.0, tare: 20.0, moisture: 13.0, rate: 4850 },
    { farmerKey: 'MH-LTR-1006', centreCode: 'C03', crop: 'Soybean', grade: 'Grade A', gross: 920.0, tare: 12.0, moisture: 11.0, rate: 4850 },
    { farmerKey: 'MH-LTR-1007', centreCode: 'C03', crop: 'Soybean', grade: 'Grade A', gross: 3100.0, tare: 30.0, moisture: 12.2, rate: 4850 },
    { farmerKey: 'MH-LTR-1008', centreCode: 'C03', crop: 'Tur', grade: 'Grade A', gross: 1250.0, tare: 15.0, moisture: 10.5, rate: 7200 },
    { farmerKey: 'MH-LTR-1009', centreCode: 'C01', crop: 'Soybean', grade: 'Grade A', gross: 2800.0, tare: 28.0, moisture: 11.8, rate: 4850 },
    { farmerKey: 'MH-LTR-1010', centreCode: 'C01', crop: 'Tur', grade: 'Grade A', gross: 1450.0, tare: 18.0, moisture: 9.8, rate: 7200 },
    { farmerKey: 'MH-LTR-1011', centreCode: 'C12', crop: 'Soybean', grade: 'Grade A', gross: 1350.0, tare: 15.0, moisture: 12.0, rate: 4850 },
    { farmerKey: 'MH-LTR-1012', centreCode: 'C12', crop: 'Tur', grade: 'Grade A', gross: 2100.0, tare: 22.0, moisture: 10.2, rate: 7200 },
    { farmerKey: 'MH-LTR-1013', centreCode: 'C18', crop: 'Soybean', grade: 'Grade A', gross: 4200.0, tare: 35.0, moisture: 12.0, rate: 4850 },
    { farmerKey: 'MH-LTR-1014', centreCode: 'C18', crop: 'Tur', grade: 'Grade A', gross: 1600.0, tare: 16.0, moisture: 10.0, rate: 7200 }
  ];

  let pCounter = 24522;
  const morePurchases = [];
  for (const ap of additionalPurchasesData) {
    const farmer = farmers[ap.farmerKey];
    const centre = centres[ap.centreCode];
    const calc = calculateProcurement({
      grossWeight: ap.gross,
      tareWeight: ap.tare,
      moisture: ap.moisture,
      ratePerQuintal: ap.rate
    });

    const slip = `${centre.code}-${pCounter++}`;
    const p = await prisma.purchase.create({
      data: {
        slipNumber: slip,
        idempotencyKey: uuidv4(),
        farmerId: farmer.id,
        centreId: centre.id,
        crop: ap.crop,
        grade: ap.grade,
        grossWeight: ap.gross,
        tareWeight: ap.tare,
        actualWeight: calc.actualWeight,
        moisture: ap.moisture,
        moistureDeductionPercent: calc.moistureDeductionPercent,
        netWeight: calc.netWeight,
        ratePerQuintal: ap.rate,
        totalAmount: calc.totalAmount,
        status: 'APPROVED',
        paymentEligibility: farmer.bankVerificationStatus === 'VERIFIED',
        isFlagged: false,
        syncStatus: 'SYNCED'
      }
    });
    morePurchases.push(p);
  }
  console.log(`✅ Seeded ${morePurchases.length} additional purchases across centres.`);

  // 9. Seed Sample Completed Payment Run
  const paidPurchases = [morePurchases[0], morePurchases[1]]; // Pandurang Bhosale & Suresh Rathod
  const paidRunTotal = paidPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const batchNum = 'BATCH-20261101-001';

  const paymentRun = await prisma.paymentRun.create({
    data: {
      batchNumber: batchNum,
      totalFarmers: paidPurchases.length,
      totalPurchases: paidPurchases.length,
      totalAmount: Math.round(paidRunTotal * 100) / 100,
      status: 'PAID',
      createdBy: managerUser.fullName,
      approvedBy: managerUser.fullName,
      processedAt: new Date('2026-11-02T11:00:00Z'),
      csvFileName: `${batchNum}-BulkPayment.csv`
    }
  });

  for (const p of paidPurchases) {
    const farmer = await prisma.farmer.findUnique({ where: { id: p.farmerId } });
    await prisma.payment.create({
      data: {
        paymentRunId: paymentRun.id,
        farmerId: farmer!.id,
        amount: p.totalAmount,
        bankAccountName: farmer!.bankAccountName,
        bankAccountNumber: farmer!.bankAccountNumber,
        ifscCode: farmer!.ifscCode,
        bankReferenceNumber: `UTR-CMS-${Math.floor(10000000 + Math.random() * 90000000)}`,
        status: 'PAID',
        paidAt: new Date('2026-11-02T11:30:00Z')
      }
    });

    await prisma.purchase.update({
      where: { id: p.id },
      data: { paymentRunId: paymentRun.id, status: 'PAID' }
    });
  }

  // 10. Seed Stock Management Dispatches
  await prisma.dispatch.create({
    data: {
      centreId: centres['C07'].id,
      crop: 'Soybean',
      truckNumber: 'MH-24-AT-8912',
      driverName: 'Rameshwar Baburao Shinde',
      driverMobile: '9822998877',
      dispatchWeight: 14500.0,
      destination: 'Central Processing Plant & Warehousing Corp, MIDC Latur',
      weightLossKg: 42.0,
      notes: 'Initial harvest dispatch lot; weighbridge scale calibrated'
    }
  });

  await prisma.dispatch.create({
    data: {
      centreId: centres['C12'].id,
      crop: 'Tur',
      truckNumber: 'MH-24-AU-1422',
      driverName: 'Santosh Vitthal Patil',
      driverMobile: '9822887766',
      dispatchWeight: 8200.0,
      destination: 'Dal Mill Processing Hub, Latur APMC',
      weightLossKg: 18.0,
      notes: 'Moisture level optimal; dispatched in clean food-grade jute bags'
    }
  });
  console.log('✅ Seeded stock dispatches.');

  // 11. Seed Initial Audit Chain
  let prevHash = 'GENESIS_HASH_KRISHISETU_2026';
  const initialActions = [
    { entityType: 'FARMER', entityId: 'INIT', action: 'CREATE', details: { note: 'Registry initialized' } },
    { entityType: 'PRICE', entityId: 'ACTIVE', action: 'UPDATE', details: { note: 'Daily rates published' } },
    { entityType: 'PURCHASE', entityId: 'C07-24518', action: 'CREATE', details: { note: 'Sunil Jadhav procurement' } }
  ];

  const baseTime = Math.floor(new Date().getTime() / 1000) * 1000 - 10000;
  for (let i = 0; i < initialActions.length; i++) {
    const act = initialActions[i];
    const timestamp = new Date(baseTime + i * 1000);
    const hash = generateAuditHash({
      entityType: act.entityType,
      entityId: act.entityId,
      action: act.action,
      userId: managerUser.id,
      userName: managerUser.fullName,
      timestamp: timestamp.toISOString(),
      details: act.details,
      previousHash: prevHash
    });

    await prisma.auditLog.create({
      data: {
        entityType: act.entityType,
        entityId: act.entityId,
        action: act.action,
        userId: managerUser.id,
        userName: managerUser.fullName,
        previousHash: prevHash,
        eventHash: hash,
        details: JSON.stringify(act.details),
        timestamp
      }
    });

    prevHash = hash;
  }
  console.log('✅ Seeded immutable SHA-256 audit log chain.');
  console.log('🌾 KrishiSetu database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
