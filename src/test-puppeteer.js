const puppeteer = require('puppeteer');

(async () => {
  console.log('🔧 Testando Puppeteer...');
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ Puppeteer OK! Chromium funcionando.');
    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao iniciar Puppeteer:', error);
    process.exit(1);
  }
})();
