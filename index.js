const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const jsdom = require('jsdom');
const {JSDOM} = jsdom;
const fs = require('fs');

async function main() {

    const {NYSE_API_URL, NASDAQ_API_URL} = process.env;

    axios.get(NYSE_API_URL).then(async (res) => {
        await createPromises(res.data.data.rows, 'nyse');
    });

    axios.get(NASDAQ_API_URL).then(async (res) => {
        await createPromises(res.data.data.rows, 'nasdaq');
    });

}

async function createPromises(tickers, exchange) {
    const DATA_API_URL = process.env.DATA_API_URL;

    let promises = [];

    for (let i = 0; i < tickers.length; i++) {
        let ticker = tickers[i].symbol;

        promises.push(axios.get(DATA_API_URL + ticker.replace('^', '.').replace('/', '.').toLowerCase(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        }));

        if ((promises.length !== 0 && i % 50 === 0) || i === tickers.length - 1) {
            console.log(`progress:  ${i}/${tickers.length}`);
            await resolvePromises(promises, exchange);
            promises = [];
        }
    }

}

async function resolvePromises(promises, exchange) {

    await Promise.allSettled(promises).then(async (values) => {

        for (let res of values) {
            let ticker = res.value.config.url.split('t=')[1];
            if (res.value.data !== '') {
                const dom = new JSDOM(res.value.data, {
                    runScripts: "dangerously",
                    virtualConsole: new jsdom.VirtualConsole()
                });
                await csvWrite(ticker.toUpperCase(), exchange, dom.window.dataDaily);
            } else console.log('error:', ticker);
        }

    }).catch(e => {
        console.log("Oopsie!!")
        process.exit(1);
    });

}

async function csvWrite(ticker, exchange, records) {
    const path = `./tickers/${exchange}/`
    const csvWriter = createCsvWriter({
        path: `${path}${ticker}.csv`,
        header: [
            {id: 'd', title: 'DATE'},
            {id: 'o', title: 'OPEN'},
            {id: 'h', title: 'HIGH'},
            {id: 'l', title: 'LOW'},
            {id: 'c', title: 'CLOSE'},
            {id: 'v', title: 'VOLUME'},
            {id: 'ma50', title: 'MA50'}
        ]
    });

    if (!fs.existsSync(path)){
        fs.mkdirSync(path, { recursive: true });
    }

    await csvWriter.writeRecords(records).catch(() => console.log('error:', ticker));

}

main();