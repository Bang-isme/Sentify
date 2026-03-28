import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  await page.goto('http://localhost:5173/admin');
  await page.waitForSelector('input[name="email"]');
  await page.fill('input[name="email"]', 'demo.admin@sentify.local');
  await page.fill('input[name="password"]', 'DemoPass123!');
  await page.click('button[type="submit"]');
  // Wait for the admin page to load inside the router
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.waitForTimeout(1000);
  
  const layout = await page.evaluate(() => {
    const main = document.querySelector('.flex-1.min-w-0');
    if (!main) return 'NO MAIN CONTENT FOUND';
    
    // Dump the main box and its direct children
    const dumpNode = (el, depth=0) => {
      // Limit recursion to 5
      if (depth > 5) return [];
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      let summary = `${'  '.repeat(depth)}<${el.tagName.toLowerCase()} class="${el.className}">: w=${rect.width}, h=${rect.height}`;
      if (style.display.includes('flex')) summary += ` [flex-dir: ${style.flexDirection}]`;
      if (style.display.includes('grid')) summary += ` [grid-cols: ${style.gridTemplateColumns}]`;
      
      let out = [summary];
      for (const child of el.children) {
         out.push(...dumpNode(child, depth + 1));
      }
      return out;
    };
    
    return dumpNode(main.parentElement).join('\\n');
  });

  console.log(layout);
  await browser.close();
})();
