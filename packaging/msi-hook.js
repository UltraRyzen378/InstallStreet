const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = async projectFile => {
  let xml = await fs.readFile(projectFile, 'utf8');
  if (!xml.includes('<Icon Id="InstallStreetIcon.exe"')) {
    const icon = path.resolve(__dirname, '../VaultHouse/icons/.running/running.ico').replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    xml = xml.replace(/(<Package\b[^>]*\/>)/, `$1\n    <Icon Id="InstallStreetIcon.exe" SourceFile="${icon}"/>\n    <Property Id="ARPPRODUCTICON" Value="InstallStreetIcon.exe"/>`);
  }
  xml = xml.replace('CompressionLevel="high"', 'CompressionLevel="mszip"');
  await fs.writeFile(projectFile, xml);
};

