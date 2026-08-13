import { execSync } from 'node:child_process';

const products = [
  'catalog',
  'suite',
  'sell',
  'stock',
  'ops',
  'talk',
  'calendar',
];

const iconGenerators = {
  catalog: 'node scripts/generate-catalog-icons.mjs',
  suite: 'node scripts/generate-suite-icons.mjs',
  sell: 'node scripts/generate-sell-icons.mjs',
  stock: 'node scripts/generate-stock-icons.mjs',
  ops: 'node scripts/generate-ops-icons.mjs',
  talk: 'node scripts/generate-talk-icons.mjs',
  calendar: 'node scripts/generate-calendar-icons.mjs',
};

for (const product of products) {
  console.log(`\n-- build: ${product} --`);
  if (iconGenerators[product]) {
    execSync(iconGenerators[product], { stdio: 'inherit' });
  }
  execSync(`node scripts/prepare-product-build.mjs ${product}`, {
    stdio: 'inherit',
  });
  execSync(`vite build --mode ${product}`, { stdio: 'inherit' });
}

execSync('node scripts/prepare-product-build.mjs suite', { stdio: 'inherit' });
console.log('\nAll product builds done.');
