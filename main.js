const pdfreader = require("pdfreader");
const moment = require("moment");

const currentYear = new Date().getFullYear();
const lastYear = currentYear - 1;
const yearBeforeLast = currentYear - 2;

function parsePDFRows(file) {
    return new Promise((resolve, reject) => {
        const result = [];
        let rows = {};
        
        new pdfreader.PdfReader().parseFileItems(file, function(err, item) {

            // End of item or end of page
            if (!item || item.page) {
                Object.keys(rows)
                    .sort((y1, y2) => parseFloat(y1) - parseFloat(y2))
                    .forEach(y => {
                        let row = rows[y] || [];
                        row = row.join("");
                        row = row.replace(/\s/g, "");
                        result.push(row);
                    });
                
                rows = {};
            }
            
            // New text element
            if (item && item.text) {
                (rows[item.y] = rows[item.y] || []).push(item.text);
            }
        
            if (typeof err === 'undefined') resolve(result);

        }); // end new pdfreader
    }); // end Promise.resolve()
}

function getTravelDates(pdfRows) {
    const travelDates = [];

    pdfRows.forEach((row) => {
        if (row.includes("-")) {
            const firstHyphen = row.indexOf("-");

            const date = row.substring(firstHyphen - 4, firstHyphen + 6);
            const type = row[firstHyphen + 6] == "A" ? "arrival" : "departure";
            const location = row.substring(firstHyphen + 6 + type.length);

            travelDates.push({ date, type, location });
        }
    });

    travelDates.reverse();

    return travelDates;
}

function getTrips(travelDates) {

    const trips = [];

    let placeholderTrip = {};

    function pushNewTrip() {
        if (Object.keys(placeholderTrip).length !== 0) {
            trips.push(placeholderTrip);
        }
        placeholderTrip = {};
    }

    for (let i = 0; i < travelDates.length; i++) {
        const travelDate = travelDates[i];

        if (travelDate.type === "arrival") pushNewTrip();

        placeholderTrip[travelDate.type] = {
            date: travelDate.date,
            location: travelDate.location
        }

        if (travelDate.type === "departure") pushNewTrip();
    }

    
    trips.forEach((trip) => {
        if (!trip.arrival || !trip.departure) return;

        const arrival = moment(trip.arrival.date);
        const departure = moment(trip.departure.date);

        trip.duration = departure.diff(arrival, 'days');
    });

    return trips;
}


function log() {

}


(async function() {

    const pdfRows = await parsePDFRows("i94.pdf");
    const travelDates = getTravelDates(pdfRows);
    const trips = getTrips(travelDates);

    // @todo: Organise into years?

    /* 4 - Group into years */

    const daysEachYear = {}

    trips.forEach((trip) => {
        if (!trip.duration) return;

        const year = trip.arrival.date.split("-")[0];

        daysEachYear[year] = daysEachYear[year] || 0;
        daysEachYear[year] += trip.duration;
    });

    /* 4 - Calculate Totals */

    const adjustedDaysEachYear = {
        [currentYear]: daysEachYear[currentYear],
        [lastYear]: Math.ceil(daysEachYear[lastYear] * (1/3)),
        [yearBeforeLast]: Math.ceil(daysEachYear[yearBeforeLast] * (1/6))
    };
    const totalAdjustedDays = adjustedDaysEachYear[currentYear] + adjustedDaysEachYear[lastYear] + adjustedDaysEachYear[yearBeforeLast]


    console.log("==============");
    console.log("i94 RESULTS");
    console.log("==============");
    console.log("");

    console.log("Days Spent")
    console.table(daysEachYear)

    console.log("")

    console.log("Adjusted Days Spent in Last 3 Years")
    console.table(adjustedDaysEachYear)
    console.log('Total: ' + totalAdjustedDays);


})();