import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Productions',
      slug: 'acme-productions',
    },
  });

  console.log('✅ Created organization:', org.name);

  // Create project
  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Demo Feature Film',
      description: 'A sample film production for testing SetSync',
      status: 'PRE_PRODUCTION',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-05-31'),
    },
  });

  console.log('✅ Created project:', project.name);

  // Create script
  const script = await prisma.script.create({
    data: {
      projectId: project.id,
      version: 'White Draft',
      color: 'WHITE',
      isActive: true,
      content: 'INT. COFFEE SHOP - DAY\n\nTwo characters meet for the first time.',
    },
  });

  console.log('✅ Created script version:', script.version);

  // Create locations
  const coffeeShop = await prisma.location.create({
    data: {
      projectId: project.id,
      name: 'Downtown Coffee Shop',
      address: '123 Main Street, Los Angeles, CA',
      locationType: 'PRACTICAL',
      interiorExterior: 'INT',
      permitStatus: 'APPROVED',
      contactName: 'John Manager',
      contactPhone: '555-0100',
    },
  });

  const park = await prisma.location.create({
    data: {
      projectId: project.id,
      name: 'Griffith Park',
      address: '4730 Crystal Springs Dr, Los Angeles, CA',
      locationType: 'PRACTICAL',
      interiorExterior: 'EXT',
      permitStatus: 'APPLIED',
    },
  });

  const warehouse = await prisma.location.create({
    data: {
      projectId: project.id,
      name: 'Industrial Warehouse',
      address: '789 Factory Rd, Los Angeles, CA',
      locationType: 'STUDIO',
      interiorExterior: 'BOTH',
      permitStatus: 'APPROVED',
    },
  });

  console.log('✅ Created 3 locations');

  // Create cast members
  const protagonist = await prisma.castMember.create({
    data: {
      projectId: project.id,
      characterName: 'Sarah Martinez',
      actorName: 'Emma Stone',
      castNumber: 1,
      contractStart: new Date('2024-03-01'),
      contractEnd: new Date('2024-04-30'),
      workStatus: 'CONFIRMED',
      unionAffiliation: 'SAG-AFTRA',
      hairMakeupMins: 90,
    },
  });

  const antagonist = await prisma.castMember.create({
    data: {
      projectId: project.id,
      characterName: 'Detective Mike Chen',
      actorName: 'Ryan Gosling',
      castNumber: 2,
      contractStart: new Date('2024-03-15'),
      contractEnd: new Date('2024-04-25'),
      workStatus: 'CONFIRMED',
      unionAffiliation: 'SAG-AFTRA',
      hairMakeupMins: 60,
    },
  });

  const supporting1 = await prisma.castMember.create({
    data: {
      projectId: project.id,
      characterName: 'Barista',
      actorName: 'John Doe',
      castNumber: 3,
      contractStart: new Date('2024-03-10'),
      contractEnd: new Date('2024-03-15'),
      workStatus: 'ON_HOLD',
      unionAffiliation: 'SAG-AFTRA',
      hairMakeupMins: 45,
    },
  });

  const supporting2 = await prisma.castMember.create({
    data: {
      projectId: project.id,
      characterName: 'Park Jogger',
      actorName: 'Jane Smith',
      castNumber: 4,
      workStatus: 'ON_HOLD',
      hairMakeupMins: 30,
    },
  });

  const supporting3 = await prisma.castMember.create({
    data: {
      projectId: project.id,
      characterName: 'Warehouse Guard',
      actorName: 'Bob Johnson',
      castNumber: 5,
      workStatus: 'ON_HOLD',
      hairMakeupMins: 45,
    },
  });

  console.log('✅ Created 5 cast members');

  // Create departments
  await prisma.department.createMany({
    data: [
      {
        projectId: project.id,
        name: 'Camera',
        headName: 'Rachel Director',
        headEmail: 'rachel@example.com',
      },
      {
        projectId: project.id,
        name: 'Art',
        headName: 'Pablo Designer',
        headEmail: 'pablo@example.com',
      },
      {
        projectId: project.id,
        name: 'Costume',
        headName: 'Maria Wardrobe',
        headEmail: 'maria@example.com',
      },
    ],
  });

  console.log('✅ Created 3 departments');

  // Create elements
  const carElement = await prisma.element.create({
    data: {
      projectId: project.id,
      category: 'VEHICLE',
      name: '2015 Ford Crown Victoria (Police Car)',
      description: 'Black and white police cruiser',
    },
  });

  const gunElement = await prisma.element.create({
    data: {
      projectId: project.id,
      category: 'PROP',
      name: 'Police Badge',
      description: 'LAPD detective badge',
    },
  });

  const laptopElement = await prisma.element.create({
    data: {
      projectId: project.id,
      category: 'PROP',
      name: 'Laptop Computer',
      description: 'Silver MacBook Pro',
    },
  });

  console.log('✅ Created 3 elements');

  // Create scenes
  const scene1 = await prisma.scene.create({
    data: {
      projectId: project.id,
      scriptId: script.id,
      sceneNumber: '1',
      synopsis: 'Sarah orders coffee and meets the barista',
      intExt: 'INT',
      dayNight: 'DAY',
      locationId: coffeeShop.id,
      pageCount: 1.875, // 1 7/8 pages
      scriptDay: 'Day 1',
      estimatedMinutes: 15,
      castMembers: {
        create: [
          { castMemberId: protagonist.id },
          { castMemberId: supporting1.id },
        ],
      },
      elements: {
        create: [{ elementId: laptopElement.id, quantity: 1 }],
      },
    },
  });

  const scene2 = await prisma.scene.create({
    data: {
      projectId: project.id,
      scriptId: script.id,
      sceneNumber: '2',
      synopsis: 'Detective Chen jogs through the park',
      intExt: 'EXT',
      dayNight: 'MORNING',
      locationId: park.id,
      pageCount: 1.25, // 1 2/8 pages
      scriptDay: 'Day 1',
      estimatedMinutes: 10,
      castMembers: {
        create: [
          { castMemberId: antagonist.id },
          { castMemberId: supporting2.id },
        ],
      },
    },
  });

  const scene3 = await prisma.scene.create({
    data: {
      projectId: project.id,
      scriptId: script.id,
      sceneNumber: '3',
      synopsis: 'Sarah discovers clue at the warehouse',
      intExt: 'INT',
      dayNight: 'NIGHT',
      locationId: warehouse.id,
      pageCount: 2.5, // 2 4/8 pages
      scriptDay: 'Day 2',
      estimatedMinutes: 20,
      castMembers: {
        create: [
          { castMemberId: protagonist.id },
          { castMemberId: supporting3.id },
        ],
      },
      elements: {
        create: [{ elementId: gunElement.id, quantity: 1 }],
      },
    },
  });

  const scene4 = await prisma.scene.create({
    data: {
      projectId: project.id,
      scriptId: script.id,
      sceneNumber: '4',
      synopsis: 'Chen confronts Sarah at the warehouse',
      intExt: 'EXT',
      dayNight: 'NIGHT',
      locationId: warehouse.id,
      pageCount: 3.125, // 3 1/8 pages
      scriptDay: 'Day 2',
      estimatedMinutes: 25,
      castMembers: {
        create: [
          { castMemberId: protagonist.id },
          { castMemberId: antagonist.id },
        ],
      },
      elements: {
        create: [{ elementId: carElement.id, quantity: 1 }],
      },
    },
  });

  const scene5 = await prisma.scene.create({
    data: {
      projectId: project.id,
      scriptId: script.id,
      sceneNumber: '5',
      synopsis: 'Final meeting at the coffee shop',
      intExt: 'INT',
      dayNight: 'DAY',
      locationId: coffeeShop.id,
      pageCount: 2.0,
      scriptDay: 'Day 3',
      estimatedMinutes: 18,
      castMembers: {
        create: [
          { castMemberId: protagonist.id },
          { castMemberId: antagonist.id },
          { castMemberId: supporting1.id },
        ],
      },
    },
  });

  console.log('✅ Created 5 scenes');

  // Create shooting days
  const shootingDay1 = await prisma.shootingDay.create({
    data: {
      projectId: project.id,
      date: new Date('2024-03-10'),
      dayNumber: 1,
      unit: 'MAIN',
      generalCall: new Date('2024-03-10T07:00:00'),
      shootingCall: new Date('2024-03-10T08:00:00'),
      estimatedWrap: new Date('2024-03-10T18:00:00'),
      status: 'SCHEDULED',
      scenes: {
        create: [
          { sceneId: scene1.id, sortOrder: 1, estimatedMins: 15 },
          { sceneId: scene5.id, sortOrder: 2, estimatedMins: 18 },
        ],
      },
    },
  });

  const shootingDay2 = await prisma.shootingDay.create({
    data: {
      projectId: project.id,
      date: new Date('2024-03-12'),
      dayNumber: 2,
      unit: 'MAIN',
      generalCall: new Date('2024-03-12T06:30:00'),
      shootingCall: new Date('2024-03-12T07:30:00'),
      estimatedWrap: new Date('2024-03-12T17:00:00'),
      status: 'SCHEDULED',
      scenes: {
        create: [{ sceneId: scene2.id, sortOrder: 1, estimatedMins: 10 }],
      },
    },
  });

  const shootingDay3 = await prisma.shootingDay.create({
    data: {
      projectId: project.id,
      date: new Date('2024-03-15'),
      dayNumber: 3,
      unit: 'MAIN',
      generalCall: new Date('2024-03-15T17:00:00'),
      shootingCall: new Date('2024-03-15T18:00:00'),
      estimatedWrap: new Date('2024-03-16T04:00:00'),
      status: 'SCHEDULED',
      weatherNotes: 'Clear night expected',
      scenes: {
        create: [
          { sceneId: scene3.id, sortOrder: 1, estimatedMins: 20 },
          { sceneId: scene4.id, sortOrder: 2, estimatedMins: 25 },
        ],
      },
    },
  });

  console.log('✅ Created 3 shooting days');

  // Create a call sheet for the first shooting day
  await prisma.callSheet.create({
    data: {
      shootingDayId: shootingDay1.id,
      version: 1,
      nearestHospital: 'Cedars-Sinai Medical Center - 8700 Beverly Blvd',
      safetyNotes: 'Watch for hot coffee props. Wear closed-toe shoes.',
      parkingNotes: 'Crew parking available in Lot B behind location',
      mealNotes: 'Lunch catered by Local Kitchen at 1:00 PM',
      departmentCalls: {
        create: [
          {
            department: 'Camera',
            callTime: new Date('2024-03-10T07:00:00'),
          },
          {
            department: 'Art',
            callTime: new Date('2024-03-10T06:30:00'),
            notes: 'Early call for set dressing',
          },
          {
            department: 'Costume',
            callTime: new Date('2024-03-10T07:30:00'),
          },
        ],
      },
    },
  });

  console.log('✅ Created call sheet');

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('Sample data created:');
  console.log('  - 1 Organization (Acme Productions)');
  console.log('  - 1 Project (Demo Feature Film)');
  console.log('  - 5 Cast Members');
  console.log('  - 3 Locations');
  console.log('  - 5 Scenes');
  console.log('  - 3 Shooting Days');
  console.log('  - 1 Call Sheet');
  console.log('\nYou can now test the application!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
