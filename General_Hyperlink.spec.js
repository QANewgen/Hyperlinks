const { test } = require('@playwright/test');
const { createObjectCsvWriter } = require('csv-writer');

const START_URL = 'https://www.zestmoney.in/'; // Change this

test.setTimeout(0);

test('Hyperlink Validation', async ({ browser, request }) => {

    const context = await browser.newContext({
        ignoreHTTPSErrors: true
    });

    const page = await context.newPage();

    const visitedPages = new Set();
    const checkedLinks = new Set();
    const queue = [START_URL];
    const results = [];

    const BASE = new URL(START_URL).origin;

    while (queue.length > 0) {

        const currentPage = queue.shift();

        if (visitedPages.has(currentPage))
            continue;

        visitedPages.add(currentPage);

        console.log(`\nScanning: ${currentPage}`);

        try {

            await page.goto(currentPage, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

        } catch {

            console.log("Unable to open page");
            continue;
        }

        const links = await page.$$eval('a[href]', anchors =>

            anchors.map(a => ({
                href: a.href,
                text: (a.textContent || '').trim()
            }))

        );

        const internalPages = [];

        const uniqueLinks = [];

        for (const link of links) {

            if (!link.href)
                continue;

            const href = link.href.split('#')[0];

            if (
                href.startsWith('mailto:') ||
                href.startsWith('tel:') ||
                href.startsWith('javascript:')
            )
                continue;

            if (
                href.startsWith(BASE) &&
                !visitedPages.has(href)
            ) {
                internalPages.push(href);
            }

            if (!checkedLinks.has(href)) {

                checkedLinks.add(href);

                uniqueLinks.push({
                    page: currentPage,
                    text: link.text,
                    href
                });

            }

        }

        queue.push(...internalPages);

        // Check links in parallel
        const BATCH_SIZE = 10;

        for (let i = 0; i < uniqueLinks.length; i += BATCH_SIZE) {

            const batch = uniqueLinks.slice(i, i + BATCH_SIZE);

            await Promise.all(

                batch.map(async item => {

                    let status = '';
                    let result = '';

                    try {

                        let response = await request.fetch(item.href, {
                            method: 'HEAD',
                            timeout: 15000,
                            failOnStatusCode: false
                        });

                        if (
                            response.status() === 405 ||
                            response.status() === 403
                        ) {

                            response = await request.fetch(item.href, {
                                method: 'GET',
                                timeout: 15000,
                                failOnStatusCode: false
                            });

                        }

                        status = response.status();

                        if (status >= 400)
                            result = "Broken";
                        else if (status >= 300)
                            result = "Redirect";
                        else
                            result = "Working";

                    } catch {

                        status = "No Response";
                        result = "Broken";

                    }

                    console.log(`${status} | ${item.href}`);

                    results.push({
                        SourcePage: item.page,
                        LinkText: item.text,
                        Hyperlink: item.href,
                        Status: status,
                        Result: result
                    });

                })

            );

        }

    }

    const writer = createObjectCsvWriter({

        path: 'Hyperlink_Report.csv',

        header: [

            { id: 'SourcePage', title: 'Source Page' },
            { id: 'LinkText', title: 'Link Text' },
            { id: 'Hyperlink', title: 'Hyperlink' },
            { id: 'Status', title: 'HTTP Status' },
            { id: 'Result', title: 'Result' }

        ]

    });

    await writer.writeRecords(results);

    console.log("\n==================================");
    console.log("Scan Completed");
    console.log("Pages Scanned :", visitedPages.size);
    console.log("Links Checked :", checkedLinks.size);
    console.log("Report Created: Hyperlink_Report.csv");
    console.log("==================================");

    await context.close();

});