// Calculate Volume of Distribution of Urea using Watson et al. formulas
function calculateVolume() {
    const age = parseFloat(document.getElementById('age').value);
    const height = parseFloat(document.getElementById('height').value);
    const weight = parseFloat(document.getElementById('weight').value);
    const sex = document.getElementById('sex').value;
    const volumeInput = document.getElementById('volume');
    
    // Check if all required fields are filled
    if (!age || !height || !weight || !sex) {
        volumeInput.value = '';
        delete volumeInput.dataset.exact;
        return;
    }
    
    let volume;
    if (sex === 'male') {
        // Male Volume: 2.447 - (0.09156 * age) + (0.1074 * height) + (0.3362 * weight)
        volume = 2.447 - (0.09156 * age) + (0.1074 * height) + (0.3362 * weight);
    } else if (sex === 'female') {
        // Female Volume: -2.097 + (0.1069 * height) + (0.2466 * weight)
        volume = -2.097 + (0.1069 * height) + (0.2466 * weight);
    }
    
    // Display volume rounded to 1 decimal place; keep the unrounded value for the
    // simulation (read back by gatherPrescriptionInputs) so display rounding can't shift results
    if (volume !== undefined) {
        volumeInput.value = volume.toFixed(1);
        volumeInput.dataset.exact = volume;
    }
}

// Calculate urea nitrogen generation rate (mg urea-N/min) from nPNA using Borah formula:
// PNA (g/day) = nPNA (g/kg/day) × weight (kg)
// ureaN (g/day) = (PNA - 19) / 7.62
// ureaN (mg/min) = ureaN (g/day) × 1000 / 1440
function computeGeneration(pna, weight) {
    if (!pna || !weight) return '';
    const pnaGperDay = pna * weight;                          // g protein/day
    const ureaNGperDay = Math.max(0, (pnaGperDay - 19) / 7.62); // g urea-N/day
    return ureaNGperDay * 1000 / 1440;                        // mg urea-N/min
}

// Store treatment results - treatment2 is most recent (for graph); treatmentHistory holds up to 4
const treatments = {
    treatment2: null  // Most recent, used by graph
};
const treatmentHistory = [];  // [{results, inputs, colorIndex}, ...] - index 0 is most recent, max 4
let nextColorIndex = 0;  // Cycles 0-3; assigns each new treatment run a persistent color slot

// Read a row's "Total UF (mL)". An entered 0 is treated as 1 mL for the simulation; this
// happens here rather than by rewriting the field, so the user still sees the 0 they typed.
function readRowUF(id) {
    const uf = parseFloat(document.getElementById(id).value) || 0;
    return uf === 0 && document.getElementById(id).value !== '' ? 1 : uf;
}

// Gather form inputs for a specific prescription
function gatherPrescriptionInputs(prescriptionNum) {
    const prefix = `p${prescriptionNum}`;
    
    // Get patient data
    const kru = parseFloat(document.getElementById('kru').value);
    const mtacElement = document.getElementById('mtac');
    const mtac = parseFloat(mtacElement.value || mtacElement.options[mtacElement.selectedIndex]?.value);
    const volumeInput = document.getElementById('volume');
    const volume = parseFloat(volumeInput.dataset.exact ?? volumeInput.value);
    const pna = parseFloat(document.getElementById('pna').value);
    const weight = parseFloat(document.getElementById('weight').value);
    const gen = computeGeneration(pna, weight);
    
    // Get selected days
    const days = [];
    const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    dayIds.forEach((day, index) => {
        if (document.getElementById(`${prefix}-${day}`).checked) {
            days.push(dayNames[index]);
        }
    });
    
    // Get exchange data
    const volumeData = [];
    const timeData = [];
    const ufData = [];
    const numberData = [];
    
    // Repeated exchanges
    const repNumber = parseFloat(document.getElementById(`${prefix}-rep-number`).value) || 0;
    const repVolume = parseFloat(document.getElementById(`${prefix}-rep-volume`).value) || 0;
    const repTimeTotal = parseFloat(document.getElementById(`${prefix}-rep-time`).value) || 0;
    const repUF = readRowUF(`${prefix}-rep-uf`);
    
    if (repNumber > 0 && repVolume > 0 && repTimeTotal > 0) {
        const repTimePerExchange = repTimeTotal / repNumber;
        const repUFPerExchange = repUF / repNumber;
        for (let i = 0; i < repNumber; i++) {
            volumeData.push(repVolume);
            timeData.push(repTimePerExchange); // Time in hours per exchange
            ufData.push(repUFPerExchange);     // UF in mL per exchange
        }
    }
    
    // Additional Exchange #1
    const add1Number = parseFloat(document.getElementById(`${prefix}-add1-number`).value) || 0;
    const add1Volume = parseFloat(document.getElementById(`${prefix}-add1-volume`).value) || 0;
    const add1TimeTotal = parseFloat(document.getElementById(`${prefix}-add1-time`).value) || 0;
    const add1UF = readRowUF(`${prefix}-add1-uf`);
    
    if (add1Number > 0 && add1Volume > 0 && add1TimeTotal > 0) {
        const add1TimePerExchange = add1TimeTotal / add1Number;
        const add1UFPerExchange = add1UF / add1Number;
        for (let i = 0; i < add1Number; i++) {
            volumeData.push(add1Volume);
            timeData.push(add1TimePerExchange); // Time in hours per exchange
            ufData.push(add1UFPerExchange);     // UF in mL per exchange
        }
    }
    
    // Additional Exchange #2
    const add2Number = parseFloat(document.getElementById(`${prefix}-add2-number`).value) || 0;
    const add2Volume = parseFloat(document.getElementById(`${prefix}-add2-volume`).value) || 0;
    const add2TimeTotal = parseFloat(document.getElementById(`${prefix}-add2-time`).value) || 0;
    const add2UF = readRowUF(`${prefix}-add2-uf`);
    
    if (add2Number > 0 && add2Volume > 0 && add2TimeTotal > 0) {
        const add2TimePerExchange = add2TimeTotal / add2Number;
        const add2UFPerExchange = add2UF / add2Number;
        for (let i = 0; i < add2Number; i++) {
            volumeData.push(add2Volume);
            timeData.push(add2TimePerExchange); // Time in hours per exchange
            ufData.push(add2UFPerExchange);     // UF in mL per exchange
        }
    }
    
    // Calculate total fluid removal
    const totalUF = ufData.reduce((sum, uf) => sum + uf, 0);
    const totalTime = timeData.reduce((sum, time) => sum + time, 0);
    
    return {
        kru,
        mtac,
        volume,
        gen,
        days,
        volumeData,
        timeData,
        ufData,
        totalUF,
        totalTime
    };
}

// Main PD Calculator function
// Unit system: concentrations in mg/L, volumes in mL, fluxes in mg/min, VoD in mL
// Body water volume is time-varying: UF drains it during the effective dwell of each
// exchange, and a steady daily fluid-addition rate (the patient's intake) refills it,
// so volume returns to the Watson baseline at the start of every day. No refill on
// skipped days. Solute removal by dialysis is diffusion-only (no convective term).
function pdCalculator(kru, mtac, volume, gen, volumeData, timeData, ufData, days) {
    // Convert whole plasma clearances to plasma water clearances (× 0.93)
    kru = kru * 0.93;

    const V_mL = volume * 1000;                          // L → mL (baseline body water)
    const dailyUF = ufData.reduce((s, v) => s + v, 0);   // total UF per treatment day (mL)
    const dayMinutes = 24 * 60;
    const fillVolume = volumeData.map(v => v * 1000);    // L → mL per exchange
    const numExchange = fillVolume.length;
    const numOfTreatment = days.length;

    const deadTime_min = 15;                             // 15 min dead time
    const deadVolume_mL = 150;                           // mL residual in peritoneum

    // All arrays: minute-by-minute over 7 days
    let plasmaConc    = new Array(7 * 24 * 60).fill(0); // mg/L
    let dialysateConc = new Array(7 * 24 * 60).fill(0); // mg/L
    let amountBody    = new Array(7 * 24 * 60).fill(0); // mg
    let amountDial    = new Array(7 * 24 * 60).fill(0); // mg
    let fluxDial      = new Array(7 * 24 * 60).fill(0); // mg/min (plasma→dialysate)
    let excretion     = new Array(7 * 24 * 60).fill(0); // mg/min (renal)
    let netMovtIn     = new Array(7 * 24 * 60).fill(0); // mg/min (net body change)
    let bodyVolume    = new Array(7 * 24 * 60).fill(0); // mL (time-varying body water)
    let volRate       = new Array(7 * 24 * 60).fill(0); // mL/min (net body volume change)
    let peakConc      = new Array(numOfTreatment).fill(0); // mg/L, start of each treatment day

    const daysOfWeek = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

    let initial_Concentration = 200; // mg/L starting estimate
    let previousWeekEnd = null;
    const tolerance = 0.1;   // mg/L
    const max_iter  = 10000;
    let steady = 0;
    let iterCount = 0;
    let t = 0;
    let peak_index = 0;
    // Tracks the dialysate concentration left in the dead volume at end of each exchange
    let prevDialysateConc_mgL = 0; // mg/L; 0 for very first exchange of simulation

    while (steady === 0 && iterCount++ < max_iter) {
        t = 0;
        peak_index = 0;
        // prevDialysateConc_mgL carries over from previous iteration (continuous wrap-around)

        for (let day = 0; day < 7; day++) {
            const isTreatmentDay = days.includes(daysOfWeek[day]);
            // Steady daily fluid intake replacing the day's UF (mL/min); none on skipped days
            const addRate = isTreatmentDay ? dailyUF / dayMinutes : 0;

            if (isTreatmentDay) {
                for (let exchange = 0; exchange < numExchange; exchange++) {
                    // uf: mL/min UF rate during the effective dwell; also drains body volume
                    const effectiveTime_min = (timeData[exchange] * 60) - deadTime_min;
                    const uf = ufData[exchange] / effectiveTime_min; // mL/min

                    const totalTime_min = timeData[exchange] * 60;
                    const initialTime = t;

                    // --- Start of exchange (fresh dialysate instilled) ---
                    // Dialysate volume = residual + instilled + total UF for the exchange
                    // (manuscript simplification: all UF present from the start of the dwell).
                    if (t === 0) {
                        // Very first minute: initialize from initial_Concentration
                        bodyVolume[t]    = V_mL;                                     // mL (baseline)
                        amountBody[t]    = initial_Concentration * bodyVolume[t] / 1000; // mg
                        plasmaConc[t]    = initial_Concentration;                    // mg/L
                        // Dead volume carries previous end-of-exchange dialysate conc (0 on first exchange)
                        amountDial[t]    = deadVolume_mL * prevDialysateConc_mgL / 1000; // mL × mg/L / 1000 = mg
                        dialysateConc[t] = amountDial[t] / (deadVolume_mL + fillVolume[exchange] + ufData[exchange]) * 1000;
                    } else {
                        // Carry mass and volume forward from previous minute, derive concentration
                        bodyVolume[t]    = bodyVolume[t - 1] + volRate[t - 1];      // mL
                        amountBody[t]    = amountBody[t - 1] + netMovtIn[t - 1];    // mg
                        plasmaConc[t]    = amountBody[t] / bodyVolume[t] * 1000;    // mg/L
                        // Dead volume retains the dialysate concentration from end of previous exchange
                        amountDial[t]    = deadVolume_mL * prevDialysateConc_mgL / 1000;
                        dialysateConc[t] = amountDial[t] / (deadVolume_mL + fillVolume[exchange] + ufData[exchange]) * 1000;
                    }

                    // Diffusion-only flux (mg/min): MTAC (mL/min) × ΔC (mg/L) / 1000
                    fluxDial[t]  = (plasmaConc[t] - dialysateConc[t]) * mtac / 1000;
                    excretion[t] = plasmaConc[t] * kru / 1000;                      // mg/L × mL/min / 1000 = mg/min
                    netMovtIn[t] = gen - excretion[t] - fluxDial[t];               // mg/min
                    volRate[t]   = addRate - uf;                                    // mL/min (UF drains during dwell)

                    if (exchange === 0) {
                        peakConc[peak_index++] = plasmaConc[t];
                    }
                    t += 1;

                    // --- Active dwell ---
                    while (t < initialTime + effectiveTime_min) {
                        bodyVolume[t]    = bodyVolume[t - 1] + volRate[t - 1];
                        amountBody[t]    = amountBody[t - 1] + netMovtIn[t - 1];
                        plasmaConc[t]    = amountBody[t] / bodyVolume[t] * 1000;
                        amountDial[t]    = amountDial[t - 1] + fluxDial[t - 1];    // accumulate urea in dialysate
                        dialysateConc[t] = amountDial[t] / (deadVolume_mL + fillVolume[exchange] + ufData[exchange]) * 1000;
                        fluxDial[t]      = (plasmaConc[t] - dialysateConc[t]) * mtac / 1000;
                        excretion[t]     = plasmaConc[t] * kru / 1000;
                        netMovtIn[t]     = gen - excretion[t] - fluxDial[t];
                        volRate[t]       = addRate - uf;
                        t += 1;
                    }

                    // Save dialysate concentration at end of active dwell for dead volume carry-forward
                    prevDialysateConc_mgL = dialysateConc[t - 1]; // mg/L

                    // --- Dead time (drain/fill, no mass transfer; no UF) ---
                    while (t < initialTime + totalTime_min) {
                        bodyVolume[t]    = bodyVolume[t - 1] + volRate[t - 1];
                        amountBody[t]    = amountBody[t - 1] + netMovtIn[t - 1];
                        plasmaConc[t]    = amountBody[t] / bodyVolume[t] * 1000;
                        amountDial[t]    = 0;
                        dialysateConc[t] = 0;
                        fluxDial[t]      = 0;
                        excretion[t]     = plasmaConc[t] * kru / 1000;
                        netMovtIn[t]     = gen - excretion[t];
                        volRate[t]       = addRate;
                        t += 1;
                    }
                }
            }

            // --- Non-treatment minutes for the day (no dialysis) ---
            if (t === 0) {
                // Day 0 not a treatment day: initialize
                bodyVolume[t] = V_mL;
                amountBody[t] = initial_Concentration * bodyVolume[t] / 1000;
                plasmaConc[t] = initial_Concentration;
                amountDial[t] = 0;
                dialysateConc[t] = 0;
                fluxDial[t]   = 0;
                excretion[t]  = plasmaConc[t] * kru / 1000;
                netMovtIn[t]  = gen - excretion[t];
                volRate[t]    = addRate;
                t += 1;
            }

            while (t < (day + 1) * 24 * 60) {
                bodyVolume[t]    = bodyVolume[t - 1] + volRate[t - 1];
                amountBody[t]    = amountBody[t - 1] + netMovtIn[t - 1];
                plasmaConc[t]    = amountBody[t] / bodyVolume[t] * 1000;
                amountDial[t]    = 0;
                dialysateConc[t] = 0;
                fluxDial[t]      = 0;
                excretion[t]     = plasmaConc[t] * kru / 1000;
                netMovtIn[t]     = gen - excretion[t];
                volRate[t]       = addRate;
                t += 1;
            }
        }
        
        // Steady state: end-of-week concentration stops changing between iterations
        const weekEnd = plasmaConc[t - 1];
        if (previousWeekEnd !== null) {
            const absDiff = Math.abs(weekEnd - previousWeekEnd);
            if (absDiff < tolerance) {
                steady = 1;
                console.log(`Steady state after ${iterCount} iterations: weekEnd=${weekEnd.toFixed(4)} mg/L, diff=${absDiff.toFixed(4)} mg/L`);
            }
        }
        previousWeekEnd = weekEnd;
        initial_Concentration = weekEnd;
    }

    if (iterCount >= max_iter) {
        console.warn(`pdCalculator: max iterations reached without converging. Final weekEnd=${plasmaConc[t-1].toFixed(2)} mg/L`);
    }

    // Log all arrays minute-by-minute for inspection
    const debugTable = [];
    for (let i = 0; i < t; i++) {
        debugTable.push({
            t: i,
            plasmaConc_mgL:     +plasmaConc[i].toFixed(4),
            dialysateConc_mgL:  +dialysateConc[i].toFixed(4),
            bodyVolume_mL:      +bodyVolume[i].toFixed(4),
            amountBody_mg:      +amountBody[i].toFixed(4),
            amountDial_mg:      +amountDial[i].toFixed(4),
            fluxDial_mgPerMin:  +fluxDial[i].toFixed(6),
            excretion_mgPerMin: +excretion[i].toFixed(6),
            netMovtIn_mgPerMin: +netMovtIn[i].toFixed(6),
        });
    }
    console.table(debugTable);

    return {
        plasmaConcentration: plasmaConc,
        peakConcentration: peakConc,
        dialysateConcentration: dialysateConc,
        bodyVolume,
        plasmaToDialysate: fluxDial,
        excretion,
        gen
    };
}

// Update graph with treatment data from treatmentHistory (up to 4 most recent)
function updateGraphWithTreatment(treatmentNum, results) {
    const timeData = [];
    for (let i = 0; i < (treatmentHistory[0]?.results.plasmaConcentration.length || 0); i += 10) {
        timeData.push(i);
    }
    
    // Slot by colorIndex (not array position) so a treatment run keeps its color as history shifts
    const treatmentsData = [{ data: [], avg: null }, { data: [], avg: null }, { data: [], avg: null }, { data: [], avg: null }];
    treatmentHistory.forEach((entry, i) => {
        const arr = entry.results.plasmaConcentration
            .filter((_, j) => j % 10 === 0)
            .map(v => v / 10 * 0.93); // mg/L → mg/dL (plasma)
        const avg = arr.length > 0 ? arr.reduce((sum, val) => sum + val, 0) / arr.length : null;
        // num = the tx column this entry occupies in the results table (newest = Prescription 1),
        // so the graph legend and the table use one numbering. Color still tracks colorIndex.
        treatmentsData[entry.colorIndex] = { data: arr, avg, num: i + 1 };
    });
    
    if (typeof updateGraph === 'function') {
        updateGraph(timeData, treatmentsData);
    }
}

// Compute the four reported metrics for one treatmentHistory entry.
// tac and apc are returned in internal units (mg/L plasma water); kurea and ktv are final.
function computeMetrics({ results, inputs }) {
    const { plasmaConcentration, peakConcentration, plasmaToDialysate, excretion } = results;
    const totalMinutes = plasmaConcentration.length; // 10080

    // TAC: mean plasma conc over the week (mg/L plasma water)
    const tac = plasmaConcentration.reduce((s, v) => s + v, 0) / totalMinutes;
    // APC: mean of start-of-day peak concentrations (mg/L plasma water)
    const apc = peakConcentration.length > 0
        ? peakConcentration.reduce((s, v) => s + v, 0) / peakConcentration.length : 0;
    // Total weekly solute removal (mg): dialysate flux + renal excretion, each mg/min × 1 min
    const weeklyRemoval = plasmaToDialysate.reduce((s, v) => s + v, 0)
        + excretion.reduce((s, v) => s + v, 0);
    // Time-averaged Kurea (mL plasma/min): total weekly removal / (whole-plasma TAC × minutes).
    // Whole-plasma TAC is tac × 0.93; × 1000 converts L → mL.
    const kurea = tac > 0 ? weeklyRemoval / (tac * 0.93 * totalMinutes) * 1000 : 0;
    // Weekly Kt/Vurea = time-averaged Kurea × 10080 min / Vd (mL, baseline body water)
    const ktv = kurea * totalMinutes / (inputs.volume * 1000);

    return { ktv, apc, tac, kurea };
}

// Update results table - populates all 4 columns from treatmentHistory
function updateAllResults() {
    const metrics = ['apc', 'tac', 'kurea', 'ktv'];
    
    for (let col = 1; col <= 4; col++) {
        const entry = treatmentHistory[col - 1];
        const suffix = `tx${col}`;
        const dot = document.getElementById(`color-dot-${suffix}`);

        if (!entry) {
            metrics.forEach(m => {
                const el = document.getElementById(`${m}-${suffix}`);
                if (el) el.textContent = '-';
            });
            if (dot) dot.style.backgroundColor = 'transparent';
            continue;
        }

        if (dot) dot.style.backgroundColor = TREATMENT_COLORS[entry.colorIndex];

        const { ktv, apc, tac, kurea } = computeMetrics(entry);

        document.getElementById(`apc-${suffix}`).textContent = (apc / 10 * 0.93).toFixed(1);
        document.getElementById(`tac-${suffix}`).textContent = (tac / 10 * 0.93).toFixed(1);
        document.getElementById(`kurea-${suffix}`).textContent = kurea.toFixed(2);
        document.getElementById(`ktv-${suffix}`).textContent = ktv.toFixed(2);
    }

    if (treatmentHistory.length > 0) {
        const { ktv, apc, tac, kurea } = computeMetrics(treatmentHistory[0]);
        console.log(`APC: ${(apc/10*0.93).toFixed(2)} mg/dL, TAC: ${(tac/10*0.93).toFixed(2)} mg/dL, Kurea: ${kurea.toFixed(2)} mL plasma/min, weekly Kt/V: ${ktv.toFixed(2)}`);
    }
}

// Handle run treatment button clicks
function runTreatment(treatmentNum) {
    try {
        const inputs = gatherPrescriptionInputs(treatmentNum);
        
        if (inputs.volumeData.length === 0) {
            alert('Please enter at least one exchange for the prescription.');
            return;
        }
        
        if (inputs.days.length === 0) {
            alert('Please select at least one day of the week.');
            return;
        }
        
        console.log('=== pdCalculator inputs ===');
        console.log(`kru=${inputs.kru} mL/min, mtac=${inputs.mtac} mL/min, volume=${inputs.volume} L`);
        console.log(`gen=${inputs.gen?.toFixed(4)} mg/min, nPNA=${document.getElementById('pna').value} g/kg/day, weight=${document.getElementById('weight').value} kg`);
        console.log(`exchanges: ${inputs.volumeData.length}, days: ${inputs.days.join(',')}`);
        console.log(`volumeData (L): ${inputs.volumeData}, timeData (hr): ${inputs.timeData}, ufData (mL): ${inputs.ufData}`);

        const results = pdCalculator(
            inputs.kru,
            inputs.mtac,
            inputs.volume,
            inputs.gen,
            inputs.volumeData,
            inputs.timeData,
            inputs.ufData,
            inputs.days
        );
        
        treatments.treatment2 = results;
        treatmentHistory.unshift({ results, inputs, colorIndex: nextColorIndex });
        nextColorIndex = (nextColorIndex + 1) % 4;
        if (treatmentHistory.length > 4) treatmentHistory.pop();
        
        // Update graph (shows most recent)
        updateGraphWithTreatment(treatmentNum, results);
        
        // Update results table (all 4 columns)
        updateAllResults();
        
    } catch (error) {
        console.error(`Error running treatment ${treatmentNum}:`, error);
        alert(`Error calculating prescription: ${error.message}`);
    }
}

// Validate if all required inputs are filled for a prescription
function validatePrescription(prescriptionNum) {
    const prefix = `p${prescriptionNum}`;
    
    // Check patient data (required for all prescriptions)
    const age = document.getElementById('age').value;
    const height = document.getElementById('height').value;
    const weight = document.getElementById('weight').value;
    const sex = document.getElementById('sex').value;
    const volume = document.getElementById('volume').value;
    const pna = document.getElementById('pna').value;
    const kru = document.getElementById('kru').value;
    const mtac = document.getElementById('mtac').value;
    
    if (!age || !height || !weight || !sex || !volume || !pna || !kru || !mtac) {
        return false;
    }
    
    // Check if at least one day is selected
    const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const hasDay = dayIds.some(day => document.getElementById(`${prefix}-${day}`).checked);
    if (!hasDay) {
        return false;
    }
    
    // Check if at least one exchange has data (all fields must be filled)
    const exchanges = [
        {
            number: document.getElementById(`${prefix}-rep-number`).value,
            volume: document.getElementById(`${prefix}-rep-volume`).value,
            time: document.getElementById(`${prefix}-rep-time`).value,
            uf: document.getElementById(`${prefix}-rep-uf`).value
        },
        {
            number: document.getElementById(`${prefix}-add1-number`).value,
            volume: document.getElementById(`${prefix}-add1-volume`).value,
            time: document.getElementById(`${prefix}-add1-time`).value,
            uf: document.getElementById(`${prefix}-add1-uf`).value
        },
        {
            number: document.getElementById(`${prefix}-add2-number`).value,
            volume: document.getElementById(`${prefix}-add2-volume`).value,
            time: document.getElementById(`${prefix}-add2-time`).value,
            uf: document.getElementById(`${prefix}-add2-uf`).value
        }
    ];
    
    const hasValidExchange = exchanges.some(ex => 
        ex.number && ex.volume && ex.time && ex.uf
    );
    
    return hasValidExchange;
}

// Update button states based on validation
function updateButtonStates() {
    const button2 = document.getElementById('run-treatment-2');
    const prescription2Valid = validatePrescription(2);
    button2.disabled = !prescription2Valid;
}

// Add event listeners to all inputs that affect volume calculation
document.getElementById('age').addEventListener('input', calculateVolume);
document.getElementById('height').addEventListener('input', calculateVolume);
document.getElementById('weight').addEventListener('input', calculateVolume);
document.getElementById('sex').addEventListener('change', calculateVolume);

// Add event listeners to update button states when inputs change
document.addEventListener('DOMContentLoaded', () => {
    // Patient data inputs
    ['age', 'height', 'weight', 'sex', 'pna', 'kru', 'mtac'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateButtonStates);
            element.addEventListener('change', updateButtonStates);
        }
    });
    
    // Day checkboxes and prescription inputs for treatment 2
    [2].forEach(num => {
        const prefix = `p${num}`;
        
        // Day checkboxes
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(day => {
            const checkbox = document.getElementById(`${prefix}-${day}`);
            if (checkbox) {
                checkbox.addEventListener('change', updateButtonStates);
            }
        });
        
        // Exchange inputs
        ['rep', 'add1', 'add2'].forEach(type => {
            ['number', 'volume', 'time', 'uf'].forEach(field => {
                const input = document.getElementById(`${prefix}-${type}-${field}`);
                if (input) {
                    input.addEventListener('input', updateButtonStates);
                    if (field === 'volume') {
                        input.addEventListener('change', () => {
                            const val = parseFloat(input.value);
                            if (input.value !== '' && val > 4) {
                                alert(`Warning: Exchange volume is ${val} L, which exceeds the typical 4 L maximum. Please confirm this is intended.`);
                            }
                        });
                    }
                    if (field === 'time') {
                        input.addEventListener('change', () => {
                            const repTime = parseFloat(document.getElementById(`${prefix}-rep-time`).value) || 0;
                            const add1Time = parseFloat(document.getElementById(`${prefix}-add1-time`).value) || 0;
                            const add2Time = parseFloat(document.getElementById(`${prefix}-add2-time`).value) || 0;
                            const totalHours = repTime + add1Time + add2Time;
                            if (totalHours > 24) {
                                alert(`Warning: Total prescription time is ${totalHours.toFixed(1)} hours, which exceeds 24 hours. Please adjust the number of exchanges or dwell times.`);
                            }
                        });
                    }
                }
            });
        });
    });
    
    // Initial button state check
    updateButtonStates();
});

// Reset: clear graph, prescription inputs, and numeric outputs — preserve patient data
function resetAll() {
    // Clear treatment history and graph data
    treatmentHistory.length = 0;
    treatments.treatment2 = null;
    nextColorIndex = 0;

    // Reset graph to empty state
    if (typeof updateGraph === 'function') {
        updateGraph([], [{data:[], avg:null},{data:[], avg:null},{data:[], avg:null},{data:[], avg:null}]);
    }

    // Reset numeric results table
    ['apc', 'tac', 'kurea', 'ktv'].forEach(metric => {
        for (let col = 1; col <= 4; col++) {
            const el = document.getElementById(`${metric}-tx${col}`);
            if (el) el.textContent = '-';
        }
    });
    for (let col = 1; col <= 4; col++) {
        const dot = document.getElementById(`color-dot-tx${col}`);
        if (dot) dot.style.backgroundColor = 'transparent';
    }

    // Reset prescription inputs (exchange table)
    ['rep', 'add1', 'add2'].forEach(type => {
        ['number', 'volume', 'time', 'uf'].forEach(field => {
            const input = document.getElementById(`p2-${type}-${field}`);
            if (input) input.value = '';
        });
    });

    // Reset day checkboxes back to all checked
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(day => {
        const checkbox = document.getElementById(`p2-${day}`);
        if (checkbox) checkbox.checked = true;
    });

    updateButtonStates();
}

// Add event listener for run treatment button
document.getElementById('run-treatment-2').addEventListener('click', () => runTreatment(2));

// Add event listener for reset button
document.getElementById('reset-all').addEventListener('click', resetAll);
