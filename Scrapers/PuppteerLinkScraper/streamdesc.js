const puppeteer = require('puppeteer');
const fs = require('fs');

// Assume products.json is the file containing your product links
const products = require('./products.json');

(async () => {
    const browser = await puppeteer.launch({ headless: false, defaultViewport: null, args: ['--window-size=1920,1080'] });

    // Split products into chunks of 20 for concurrent processing
    const chunks = chunkArray(products, 20);

    // Create a writable stream
    const writeStream = fs.createWriteStream('productDescriptions.json');

    // Write the opening bracket of the JSON array
    writeStream.write('[');

    let isFirstChunk = true;

    for (let chunk of chunks) {
        const promises = chunk.map(async product => {
            const page = await browser.newPage();
            await page.goto(product.link, { waitUntil: 'domcontentloaded' });

            // Wait for the "Product Description" div to appear
            try {
                // Wait for the "Product Description" div to appear, but for no more than 2 seconds
                await page.waitForSelector('div._2rp71H', { visible: true, timeout: 7000 });
            } catch (error) {
                // If the element doesn't appear within 2 seconds, close the page and skip to the next product
                console.error(`Skipping ${product.link} due to timeout: ${error.message}`);
                await page.close();
                return null;  // Return null to indicate that this product was skipped
            }

            const description = await page.evaluate(() => {
                // Select the 15th div with class "_1AtVbE col-12-12"
                const targetDiv = document.querySelectorAll('div._1AtVbE.col-12-12')[13];
                if (!targetDiv) return null;

                const descriptionDivs = targetDiv.querySelectorAll('div._2k6Cpt');
                let descriptionText = '';

                // Iterate over each description div and concatenate the text content
                descriptionDivs.forEach(div => {
                    const title = div.querySelector('div._3qWObK');
                    const text = div.querySelector('div._3zQntF');
                    if (title && text) {
                        descriptionText += `${title.innerText}\n${text.innerText}\n\n`;
                    }
                });

                return descriptionText.trim();
            });

            await page.close();
            return { name: product.name, link: product.link, description };
        });

        // Wait for all promises in the current chunk to resolve
        const productData = await Promise.all(promises);

        // Write the data to the stream, prefixed with a comma if it's not the first chunk
        writeStream.write((isFirstChunk ? '' : ',') + JSON.stringify(productData, null, 2));
        isFirstChunk = false;
    }

    // Write the closing bracket of the JSON array
    writeStream.write(']');
    writeStream.end();

    await browser.close();
})();

function chunkArray(myArray, chunk_size) {
    var index = 0;
    var arrayLength = myArray.length;
    var tempArray = [];

    for (index = 0; index < arrayLength; index += chunk_size) {
        const chunk = myArray.slice(index, index + chunk_size);
        tempArray.push(chunk);
    }

    return tempArray;
}
