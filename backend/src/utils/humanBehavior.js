/**
 * Waits for a random number of milliseconds between min and max.
 * @param {number} min 
 * @param {number} max 
 * @returns {Promise<void>}
 */
async function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Scrolls down the page in random increments to simulate human reading.
 * @param {import('playwright').Page} page 
 */
async function humanScroll(page) {
    const steps = Math.floor(Math.random() * (6 - 3 + 1) + 3);
    for (let i = 0; i < steps; i++) {
        const amount = Math.floor(Math.random() * (600 - 200 + 1) + 200);
        await page.mouse.wheel(0, amount);

        // 30% chance to scroll UP slightly
        if (Math.random() < 0.3) {
            const upAmount = Math.floor(Math.random() * (150 - 50 + 1) + 50);
            await randomDelay(200, 400);
            await page.mouse.wheel(0, -upAmount);
        }

        await randomDelay(300, 900);
    }
}

/**
 * Moves mouse to random positions on the page.
 * @param {import('playwright').Page} page 
 */
async function humanMouseMove(page) {
    for (let i = 0; i < 3; i++) {
        const x = Math.floor(Math.random() * (1266 - 100 + 1) + 100);
        const y = Math.floor(Math.random() * (668 - 100 + 1) + 100);
        await page.mouse.move(x, y);
        await randomDelay(100, 300);
    }
}

/**
 * Types text into an element with human-like delays.
 * @param {import('playwright').Page} page 
 * @param {string} selector 
 * @param {string} text 
 */
async function humanType(page, selector, text) {
    await page.click(selector);
    for (const char of text) {
        await page.keyboard.type(char, { delay: Math.floor(Math.random() * (150 - 50 + 1) + 50) });
    }
    await randomDelay(300, 700);
}

module.exports = {
    randomDelay,
    humanScroll,
    humanMouseMove,
    humanType
};
