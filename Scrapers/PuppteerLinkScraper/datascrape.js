// const puppeteer = require('puppeteer');
// const fs = require('fs');

// // Assume products.json is the file containing your product links
// const products = require('./products.json');

// (async () => {
//     const browser = await puppeteer.launch({ headless: false, defaultViewport: null, args: ['--window-size=1920,1080'] });

//     // Split products into chunks of 15 for concurrent processing
//     const chunks = chunkArray(products, 15);

//     let allProductData = [];

//     for (let chunk of chunks) {
//         const promises = chunk.map(async product => {
//             const page = await browser.newPage();
//             await page.goto(product.link, { waitUntil: 'domcontentloaded' });

//             const description = await page.evaluate(() => {
//                 const descriptionNode = document.querySelector('div._1AtVbE col-12-12 div._1A1InN div._2rp71H');
//                 return descriptionNode ? descriptionNode.innerText : null;
//             });

//             await page.close();
//             return { name: product.name, link: product.link, description };
//         });

//         // Wait for all promises in the current chunk to resolve
//         const productData = await Promise.all(promises);
//         allProductData = allProductData.concat(productData);
//     }

//     fs.writeFileSync('productDescriptions.json', JSON.stringify(allProductData, null, 2));

//     await browser.close();
// })();

// function chunkArray(myArray, chunk_size) {
//     var index = 0;
//     var arrayLength = myArray.length;
//     var tempArray = [];

//     for (index = 0; index < arrayLength; index += chunk_size) {
//         const chunk = myArray.slice(index, index + chunk_size);
//         tempArray.push(chunk);
//     }

//     return tempArray;
// }


// const puppeteer = require('puppeteer');
// const fs = require('fs');





const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: ['--window-size=1920,1080']
    });
    const page = await browser.newPage();

    const url = 'https://www.flipkart.com/redmi-note-12-lunar-black-128-gb/p/itm6ba19bad63915?pid=MOBGNYHZEHBAZQN7&lid=LSTMOBGNYHZEHBAZQN7QGJKFC&marketplace=FLIPKART';

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for the "Product Description" div to appear
    await page.waitForSelector('div._2rp71H', { visible: true });

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

    if (description) {
        console.log('Description fetched:', description);

        // Stream the data to a JSON file
        const writeStream = fs.createWriteStream('productDescription.json');
        writeStream.write(JSON.stringify({ name: 'Redmi Note 12 Lunar Black 128 GB', link: url, description }, null, 2));
        writeStream.end();
    } else {
        console.log('Failed to fetch description');
    }

    await browser.close();
})();


