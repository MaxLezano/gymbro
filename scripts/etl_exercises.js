/**
 * ETL Script: Fetch and optimize exercises-dataset for GymBro
 * Source: https://github.com/hasaneyldrm/exercises-dataset
 */

const fs = require('fs');
const path = require('path');

const DATASET_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const RAW_BASE_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

const HOME_EQUIPMENT_KEYWORDS = [
  'body weight',
  'dumbbell',
  'band',
  'kettlebell',
  'stability ball',
  'weighted',
  'roller'
];

async function runETL() {
  console.log('Fetching exercise dataset from GitHub...');
  const res = await fetch(DATASET_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch dataset: ${res.status} ${res.statusText}`);
  }

  const rawExercises = await res.json();
  console.log(`Fetched ${rawExercises.length} raw exercises.`);

  const processed = rawExercises.map((item) => {
    const equipment = (item.equipment || '').toLowerCase().trim();
    const isHome = HOME_EQUIPMENT_KEYWORDS.some(k => equipment.includes(k));

    // Spanish steps or English fallback
    const steps = (item.instruction_steps && item.instruction_steps.es && item.instruction_steps.es.length > 0)
      ? item.instruction_steps.es
      : (item.instruction_steps && item.instruction_steps.en ? item.instruction_steps.en : []);

    const overviewEs = item.instructions && item.instructions.es ? item.instructions.es : '';
    const overviewEn = item.instructions && item.instructions.en ? item.instructions.en : '';

    return {
      id: item.id,
      name: item.name,
      bodyPart: item.body_part || item.category || 'other',
      target: item.target || 'general',
      secondaryMuscles: item.secondary_muscles || [],
      equipment: equipment || 'body weight',
      isHomeFriendly: isHome,
      instructions: steps.length > 0 ? steps : (overviewEs ? [overviewEs] : [overviewEn]),
      thumbnailUrl: item.image ? `${RAW_BASE_URL}${item.image}` : null,
      gifUrl: item.gif_url ? `${RAW_BASE_URL}${item.gif_url}` : null,
    };
  });

  const outputDir = path.join(__dirname, '..', 'src', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'exercises.json');
  fs.writeFileSync(outputPath, JSON.stringify(processed), 'utf8');

  console.log(`Successfully processed and saved ${processed.length} exercises to ${outputPath}`);

  // Summary stats
  const homeCount = processed.filter(e => e.isHomeFriendly).length;
  console.log(`Home-friendly exercises: ${homeCount} (${Math.round((homeCount / processed.length) * 100)}%)`);
  console.log(`Gym/Equipment exercises: ${processed.length - homeCount}`);
}

runETL().catch(err => {
  console.error('ETL Error:', err);
  process.exit(1);
});
