// src/fetchGames.js
import puppeteer from "puppeteer";

export async function fetchGames() {
    console.log("Launching Puppeteer...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log("Navigating to Winsipedia...");
        await page.goto("https://www.winsipedia.com/games/duke", {
            waitUntil: "networkidle2",
        });

        console.log("Waiting for page to render...");
        await page.waitForSelector("script");

        const scripts = await page.$$eval("script", (all) =>
            all.map((s) => s.textContent)
        );

        console.log(`Found ${scripts.length} scripts, looking for game data...`);

        let games = [];

        // Recursively find all .games arrays
        const extractGamesRecursive = (obj) => {
            if (!obj || typeof obj !== "object") return;
            if (obj.games && Array.isArray(obj.games)) {
                games.push(...obj.games);
            }
            for (const key in obj) {
                extractGamesRecursive(obj[key]);
            }
        };

        for (const script of scripts) {
            if (!script) continue;

            if (script.includes("self.__next_f.push")) {
                try {
                    // Match the array inside self.__next_f.push([...])
                    const match = script.match(/self\.__next_f\.push\(\s*(\[[\s\S]*\])\s*\)/m);

                    if (match) {
                        const arrayText = match[1].trim();

                        // Step 1: Parse the outer array (e.g., [1, "86:[...]"])
                        const arrayData = JSON.parse(arrayText);

                        // Step 2: Find the string payload, which contains the game data.
                        // It's the string element in the array, usually the second one.
                        const payloadString = arrayData.find(item => typeof item === 'string');

                        if (payloadString) {
                            // The string is structured as "CHUNK_ID:[...escaped json...]"
                            const separatorIndex = payloadString.indexOf(':');

                            if (separatorIndex !== -1) {
                                // Extract the escaped JSON part
                                const escapedJsonText = payloadString.substring(separatorIndex + 1);

                                // Step 3: Unescape and parse the inner JSON string to get the structured data
                                const componentData = JSON.parse(escapedJsonText);

                                // Step 4: Recursively extract games
                                extractGamesRecursive(componentData);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error processing Winsipedia chunk (Next.js data):", err.message);
                }
            }
        }

        console.log(`Extracted ${games.length} games from page.`);
        return games;
    } catch (err) {
        console.error("Error fetching games:", err);
        return [];
    } finally {
        await browser.close();
    }
}
// src/fetchGames.js
import puppeteer from "puppeteer";

export async function fetchGames() {
    console.log("Launching Puppeteer...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log("Navigating to Winsipedia...");
        await page.goto("https://www.winsipedia.com/games/duke", {
            waitUntil: "networkidle2",
        });

        console.log("Waiting for page to render...");
        await page.waitForSelector("script");

        const scripts = await page.$$eval("script", (all) =>
            all.map((s) => s.textContent)
        );

        console.log(`Found ${scripts.length} scripts, looking for game data...`);

        let games = [];

        // Recursively find all .games arrays
        const extractGamesRecursive = (obj) => {
            if (!obj || typeof obj !== "object") return;
            if (obj.games && Array.isArray(obj.games)) {
                games.push(...obj.games);
            }
            for (const key in obj) {
                extractGamesRecursive(obj[key]);
            }
        };

        for (const script of scripts) {
            if (!script) continue;

            if (script.includes("self.__next_f.push")) {
                try {
                    // Match the array inside self.__next_f.push([...])
                    const match = script.match(/self\.__next_f\.push\(\s*(\[[\s\S]*\])\s*\)/m);

                    if (match) {
                        const arrayText = match[1].trim();

                        // Step 1: Parse the outer array (e.g., [1, "86:[...]"])
                        const arrayData = JSON.parse(arrayText);

                        // Step 2: Find the string payload, which contains the game data.
                        // It's the string element in the array, usually the second one.
                        const payloadString = arrayData.find(item => typeof item === 'string');

                        if (payloadString) {
                            // The string is structured as "CHUNK_ID:[...escaped json...]"
                            const separatorIndex = payloadString.indexOf(':');

                            if (separatorIndex !== -1) {
                                // Extract the escaped JSON part
                                const escapedJsonText = payloadString.substring(separatorIndex + 1);

                                // Step 3: Unescape and parse the inner JSON string to get the structured data
                                const componentData = JSON.parse(escapedJsonText);

                                // Step 4: Recursively extract games
                                extractGamesRecursive(componentData);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error processing Winsipedia chunk (Next.js data):", err.message);
                }
            }
        }

        console.log(`Extracted ${games.length} games from page.`);
        return games;
    } catch (err) {
        console.error("Error fetching games:", err);
        return [];
    } finally {
        await browser.close();
    }
}