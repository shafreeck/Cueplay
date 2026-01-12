const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];

if (!newVersion) {
    console.error('Please provide a version number: node scripts/set-version.js 0.2.0');
    process.exit(1);
}

const filesToUpdate = [
    'package.json',
    'apps/desktop/package.json',
    'apps/www/package.json',
    'services/api/package.json',
    'packages/protocol/package.json', // Assuming this exists based on prev read
    'apps/desktop/src-tauri/tauri.conf.json'
];

const cargoFiles = [
    'apps/desktop/src-tauri/Cargo.toml'
];

const rootDir = path.resolve(__dirname, '..');

// Update JSON files
filesToUpdate.forEach(file => {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        content.version = newVersion;
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n'); // Keep trailing newline
        console.log(`Updated ${file} to ${newVersion}`);
    } else {
        console.warn(`File not found, skipping: ${file}`);
    }
});

// Update Cargo.toml (Basic Regex replacement for version = "x.y.z")
// Note: This is a simple replacement and might need adjustment if multiple version fields exist indiscriminately
// But usually top-level package version is what we want.
cargoFiles.forEach(file => {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf-8');
        // Replace version = "..." with version = "newVersion"
        // We look for [package] section usually, but simple regex works for simple Cargo.toml
        content = content.replace(/^version = ".*"/m, `version = "${newVersion}"`);
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file} to ${newVersion}`);
    } else {
        console.warn(`File not found, skipping: ${file}`);
    }
});

console.log(`\nAll files updated to version ${newVersion}`);
