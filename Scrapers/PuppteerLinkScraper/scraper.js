const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,  // This will set the viewport to the size of the window
        args: ['--window-size=1920,1080']
    });
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
        'Header-Name': 'Header-Value'
    });

    const writeStream = fs.createWriteStream('products.json');
    writeStream.write('[');  // Start of JSON array

    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        const url = `https://www.flipkart.com/search?q=mobiles&otracker=search&otracker1=search&marketplace=FLIPKART&as-show=on&page=${currentPage}`;
        await page.goto(url);

        await page.waitForSelector('div._1AtVbE');

        const productsOnPage = await page.evaluate(() => {
            const productNodes = document.querySelectorAll('div._1AtVbE');
            let productsArray = [];
            productNodes.forEach(productNode => {
                const linkNode = productNode.querySelector('a._1fQZEK');
                if (linkNode) {
                    const link = linkNode.href;
                    const name = productNode.querySelector('div._4rR01T').innerText;
                    productsArray.push({ name, link });
                }
            });
            return productsArray;
        });

        if (!currentPage === 1) {
            writeStream.write(',');
        }

        writeStream.write(JSON.stringify(productsOnPage).slice(1, -1));  // Write data without enclosing square brackets

        // Check if there are more pages (you may need to adjust this based on the total number of pages)
        const totalProductCount = 9399;  // Replace with the actual total product count
        const productsPerPage = 24;  // Replace with the actual number of products per page
        const totalPages = Math.ceil(totalProductCount / productsPerPage);
        hasNextPage = currentPage < totalPages;
        currentPage++;
    }

    writeStream.write(']');  // End of JSON array
    writeStream.end();

    await browser.close();

})();




// (async () => {
//     const browser = await puppeteer.launch({
//         headless: false,
//         defaultViewport: null,
//         args: ['--window-size=1920,1080']
//     });
//     const page = await browser.newPage();

//     const url = 'https://www.flipkart.com/redmi-note-12-lunar-black-128-gb/p/itm6ba19bad63915?pid=MOBGNYHZEHBAZQN7&lid=LSTMOBGNYHZEHBAZQN7QGJKFC&marketplace=FLIPKART';

//     await page.goto(url, { waitUntil: 'domcontentloaded' });

//     // Wait for the "Product Description" div to appear
//     await page.waitForSelector('div._2rp71H', { visible: true });

//     const descriptionHtml = await page.evaluate(() => {
//         // Select the 15th div with class "_1AtVbE col-12-12"
//         const targetDiv = document.querySelectorAll('div._1AtVbE.col-12-12')[13];
//         if (!targetDiv) return null;
//         return targetDiv.innerHTML;
//     });

//     if (descriptionHtml) {
//         console.log('Description HTML fetched successfully');

//         // Stream the data to a JSON file
//         const writeStream = fs.createWriteStream('productDescription.json');
//         writeStream.write(JSON.stringify({ name: 'Redmi Note 12 Lunar Black 128 GB', link: url, descriptionHtml }, null, 2));
//         writeStream.end();
//     } else {
//         console.log('Failed to fetch description HTML');
//     }

//     await browser.close();
// })();