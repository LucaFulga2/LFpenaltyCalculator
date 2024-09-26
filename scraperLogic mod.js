/*
LUCA FULGA - May, 2023
This program uses a variety of functions that can be called 
from an HTML file to calculate a FIS penalty
*/

let callCount = 0;
const fFactorGS = 1010.0
const fFactorSL = 730.0




// main function
async function main() {


    // grab the HTML data from the liveTiming data site
    let liveTimingData = await getLT();

    // another error check
    if (!liveTimingData) {
        alert("Failed to Fetch LiveTiming HTML Data");
    } else {
        const discipline = getDiscipline(liveTimingData);
        const f = getFactorF(discipline);
        const unsortedAthletes = getUnsortedAthletes(liveTimingData);
        const athletes = sortAthletes(unsortedAthletes);
        const fastestTime = setFastestTime(athletes);
        const penalty = await penaltyCalculator(fastestTime, f, athletes);
        buildTable(fastestTime, f, penalty, athletes);

        callCount++;
        if (callCount > 10) window.location.reload();

        return 0;
    }
}

// fetches live-timing raw data as 'liveTimingData'
async function getLT() {
    let liveTimingHtml = null;
    let input = ""

    // retrieves the URL for the race
    input = document.getElementById("raceInput").value;

    // modifies the URL to get the URL that livetiming accesses with all the data
    let liveTimingSite = "https://www.live-timing.com/includes/aj_race.php?r="
        + input.substring(input.length - 6) + "&&m=1&&u=5";

    // error testing
    console.log(liveTimingSite);

    // call fetch
    let liveTimingDoc = await fetch(liveTimingSite);

    // check response
    if (!liveTimingDoc) {
        alert("Failed to Connect to LiveTiming Web Site");
    } else {
        liveTimingHtml = await liveTimingDoc.text();
        if (!liveTimingHtml) {
            alert("Failed to Fetch LiveTiming HTML Data");
        }
    }

    // return the result from the fetch.text call
    return liveTimingHtml;
}

// uses 'liveTimingData' to fetch the discipline
function getDiscipline(rawData) {
    // find start and end indices of discipline
    const disciplineStartIndex = rawData.indexOf('hT=');

    // error check
    if (disciplineStartIndex == -1) {
        console.log("'hT=' marker not found");
        return [];
    }

    // find the next occurrence of '=' after 'hT='
    const disciplineEndIndex = rawData.indexOf('=', disciplineStartIndex + 3);

    // error check if '=' not found after 'hT='
    if (disciplineEndIndex === -1) {
        console.log("Next '=' marker not found after 'hT='");
        return [];
    }


    // extract and return the value
    return rawData.substring(disciplineStartIndex + 3, disciplineEndIndex);
}

// parses and removes all the useful data from the raw data into a 2d array
// each row is an athlete and their data
function getUnsortedAthletes(rawData) {
    // part1 of function
    // parse the data into an array with all the relevant info
    const startIndex = rawData.indexOf('hE|');
    const endIndex = rawData.indexOf('|endC');
    if (startIndex == -1) {
        console.log("'hE| marker not found");
        return [];
    }
    if (endIndex == -1) {
        console.log("'|endC' marker not found");
        return [];
    }

    // Cut the rawData from the 'hE|' marker onwards and everything after '|endC' marker
    const dataAfterMarker = rawData.substring(startIndex + 3, endIndex);

    //Split by the '|' seperators
    const flatAthletes = dataAfterMarker.split('|');


    // part2
    // push data into 2d array where the rows are the athletes
    const unsortedAthletes = [];
    let currentAthlete = [];

    for (let i = 0; i < flatAthletes.length; i++) {
        const item = flatAthletes[i];

        // If the current item starts with "b=" and it's not the first element,
        // push the current athlete's data into the athletes array and start a new one
        if (item.startsWith("b=") && currentAthlete.length > 0) {
            unsortedAthletes.push(currentAthlete);  // Push current athlete's data
            currentAthlete = [];            // Start new athlete's data
        }

        // Add the current item to the current athlete's data
        currentAthlete.push(item);
    }

    // push the last athlete's data
    if (currentAthlete.length > 0) {
        unsortedAthletes.push(currentAthlete);
    }

    return unsortedAthletes;
}

// sorts the a 2d athlete array from fastest to slowest
function sortAthletes(unsortedAthletes) {
    // Sort the athletes by times
    const sortedAthletes = unsortedAthletes.sort((a, b) => {
        // Extract 'tt' from each athlete's data
        let ttAField = a.find(field => field.startsWith('tt='));
        let ttBField = b.find(field => field.startsWith('tt='));

        // Remove 'tt=' field if it doesn't contain a colon (':')
        if (ttAField && !ttAField.includes(':')) {
            a.splice(a.indexOf(ttAField), 1);  // Remove invalid 'tt=' field from athlete A
            ttAField = null;
        }
        if (ttBField && !ttBField.includes(':')) {
            b.splice(b.indexOf(ttBField), 1);  // Remove invalid 'tt=' field from athlete B
            ttBField = null;
        }

        // If an athlete doesn't have a 'tt', they should go to the bottom
        if (!ttAField && !ttBField) return 0;  // If both athletes don't have 'tt', keep their relative order
        if (!ttAField) return 1;  // If athlete A doesn't have 'tt', push it down
        if (!ttBField) return -1; // If athlete B doesn't have 'tt', push it down

        // Get the actual tt values and convert them to seconds
        const ttA = ttAField.split('=')[1];
        const ttB = ttBField.split('=')[1];

        return convertToSeconds(ttA) - convertToSeconds(ttB);
    });

    return sortedAthletes;
}


// builds and populates table using sorted athlete array
function buildTable(fastestTime, f, penalty, athletes) {
    // Hard coded table headers and fields
    const headers = ['RANK', 'BIB', 'NAME', 'TEAM', 'CLASS', 'FP', 'TOTAL', 'SCORE'];
    const fields = ['b=', 'm=', 't=', 's=', 'fp=', 'tt='];

    // Get the table container
    const container = document.getElementById('table-container');
    container.innerHTML = ''; // Clear any existing table

    // Create the table element
    const table = document.createElement('table');

    // Create the header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');


    headers.forEach(headers => {
        const th = document.createElement('th');
        th.textContent = headers;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);



    // Create the body rows
    const tbody = document.createElement('tbody');
    let placement = 1;
    athletes.forEach(athlete => {
        const row = document.createElement('tr');

        // rank section
        if (athlete.find(data => data.startsWith('tt='))) {
            const td = document.createElement('td');
            td.textContent = placement++;
            row.appendChild(td);
        }
        else {
            const td = document.createElement('td');
            td.textContent = '';
            row.appendChild(td);
        }

        // rest of data
        fields.forEach(field => {
            const td = document.createElement('td');
            const fieldData = athlete.find(data => data.startsWith(field));

            // If the field is 'fp', divide by 100
            if (field === 'fp=' && fieldData) {
                const fpValue = parseInt(fieldData.split('=')[1]);  // Ensure it's treated as a number
                td.textContent = (fpValue / 100).toFixed(2);  // Divide by 100 and format to 2 decimal places
            }
            else if (field == 'tt=' && !fieldData) {
                td.textContent = fieldData ? fieldData.split('=')[1] : 'DNF';  // Handle missing times
            }
            else {
                td.textContent = fieldData ? fieldData.split('=')[1] : 'N/A';  // Handle general missing data
            }

            row.appendChild(td);
        });

        // score section
        if (athlete.find(data => data.startsWith('tt='))) {
            const td = document.createElement('td');
            ttData = athlete.find(data => data.startsWith('tt='));
            const athleteTime = convertToSeconds(ttData.split('=')[1]);
            td.textContent = (getRacePoints(fastestTime, f, athleteTime) + penalty).toFixed(2);

            row.appendChild(td);
        }
        else {
            const td = document.createElement('td');
            td.textContent = '';
            row.appendChild(td);
        }



        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    // Append the table to the container
    container.appendChild(table);
}

/*
this function does all the math (I'm probably going to change this into
a main-type function that calls all the others)
*/
async function penaltyCalculator(fastestTime, f, athletes) {

    /*
    Race point calculation

    The formula for race points is:

    = ((F * Tx) / To) - F

    Where F is the 'fudge factor' which is a constant depending on the skiing discipline
    that changes each year (they are defined at the top of the file)

    Where Tx is the time of the given racer

    and where To is the time of the winning racer
    */


    /*
    these are the factors that go into the penalty calculation
    A is the sum of the fis points of the top 5 skiers in the top ten (based on fis points)
    B is the sum of the fis points of the best 5 athletes that are going into the race (based on fis points)
    C is the sum of the race points of the top 5 skiers in the top ten
    The formula for the penalty = (A + B - C) / 10
    */

    const a = getFactorA(athletes);
    const b = getFactorB(athletes);
    const c = getFactorC(fastestTime, f, athletes);
    const penalty = ((a + b - c) / 10);

    if (penalty < 23) {
        const raceType = await modal();
        if (raceType == 1) {
            return 23;
        }
        else if (raceType == 2) {
            return 20;
        }
        else if (raceType == 3) {
            return 15;
        }
        else{

        }
    }
    else {
        return penalty;
    }

}

// calculates the fastest time
function setFastestTime(athletes) {
    // setting the fastest time (in seconds)
    const ttField = athletes[0].find(field => field.startsWith('tt='));
    if (ttField && ttField.includes(':')) {
        return convertToSeconds(ttField.split('=')[1]);
    }
    else {
        return null;
    }
}

// uses discipline to get f
function getFactorF(discipline) {
    // setting the valid fudge factor
    let f;

    if (discipline == 'Slalom') {
        f = fFactorSL;
    }
    else if (discipline == 'Giant Slalom') {
        f = fFactorGS;
    }
    else {
        alert('You did not enter a GS or SL race');
        return null;
    }

    return f;
}

// uses athlete array to get a
function getFactorA(athletes) {
    let fp = []; // all fis points array

    // takes the fis points of every athlete and puts them into the fp array
    for (let i = 0; i < 10; i++) {
        fpField = athletes[i].find(field => field.startsWith('fp='));
        if (fpField) {
            fp[i] = fpField.split('fp=')[1] / 100;
        }
        else {
            return null;
        }
    }
    fp = fp.sort((a, b) => a - b); // sorts from least to greatest

    // stores sum of five best points in fp first index
    for (let i = 1; i < 5; i++) {
        fp[0] += fp[i];
    }

    return fp[0];
}

// uses athlete array to get b
function getFactorB(athletes) {
    let fp = []; // all fis points array

    // takes the fis points of every athlete and puts them into the fp array
    for (let i = 0; i < athletes.length; i++) {
        fpField = athletes[i].find(field => field.startsWith('fp='));
        if (fpField) {
            fp[i] = fpField.split('fp=')[1] / 100;
        }
        else {
            return null;
        }
    }
    fp = fp.sort((a, b) => a - b); // sorts from least to greatest

    // stores sum of five best points in fp first index
    for (let i = 1; i < 5; i++) {
        fp[0] += fp[i];
    }

    return fp[0];
}

// uses the fastest time, fFactor, and athlete array to get c
function getFactorC(fastestTime, f, athletes) {
    let c = 0;

    // sorts top 10 by fis points
    const topAthletes = athletes.slice(0, 10).sort((a, b) => {
        // Extract 'fp=' from each athlete's data
        const fpAField = a.find(field => field.startsWith('fp='));
        const fpBField = b.find(field => field.startsWith('fp='));

        // If an athlete doesn't have a 'fp=', they should go to the bottom
        if (!fpAField || !fpBField) return 0;  // If both athletes don't have 'fp=', keep their relative order
        if (!fpAField) return 1;  // If athlete A doesn't have 'fp=', push it down
        if (!fpBField) return -1; // If athlete B doesn't have 'fp=', push it down

        // Get the actual fp values
        const fpA = parseFloat(fpAField.split('=')[1]);
        const fpB = parseFloat(fpBField.split('=')[1]);

        return (fpA - fpB) / 100;
    });


    // sums top five topAthletes's race points
    for (let i = 0; i < 5; i++) {
        const ttField = topAthletes[i].find(field => field.startsWith('tt=')); // extract 'tt=' from the athlete's data

        if (!ttField) return 0; // if somehow there is less than 5 finishers

        c += getRacePoints(fastestTime, f, convertToSeconds(ttField.split('=')[1])); // seperates it into the actual value, turns it to seconds, makes sure result is type 'float'

    }


    return c;
}

// given fastest time, fFactor, and a given athlete's time
// calculates their race points
function getRacePoints(fastestTime, f, athleteTime) {
    return ((f * athleteTime) / fastestTime) - f;
}

// coverts mm:ss.ms to seconds
function convertToSeconds(timeString) {
    const [minutes, rest] = timeString.split(':');
    const [seconds, centiseconds] = rest.split('.');
    return parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;
}


// makes HTML element read only and faded
function makeReadOnly(elementId) {
    var myInput = document.getElementById(elementId);
    myInput.disabled = true;
    myInput.classList.add("faded");
}


// modal for choosing what kind of race
function modal() {
    // get html elements
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modal = document.getElementById('myModal');
    const dropdownMenu = document.getElementById('dropdownMenu');

    // Initially disable the button until a selection is made
    closeModalBtn.disabled = true;
    closeModalBtn.classList.add("faded");

    // Show the modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Disable scrolling

    // Listen for changes in the dropdown menu
    dropdownMenu.addEventListener('change', function () {
        // Enable the button if a valid option is selected (not the default one)
        if (dropdownMenu.value !== '-') {
            closeModalBtn.disabled = false;
            closeModalBtn.classList.remove("faded");
        } else {
            closeModalBtn.disabled = true;
            closeModalBtn.classList.add("faded");
        }
    });

    return new Promise((resolve) => {
        closeModalBtn.addEventListener('click', function () {
            modal.style.display = 'none'; // Hide the modal
            document.body.style.overflow = 'auto';
            const selectedValue = dropdownMenu.value; // Get the selected value
            resolve(selectedValue); // Return the selected value
        });
    });
}