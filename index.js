const fs = require('fs');

// Učitavanje podatke o grupama i prijateljskim utakmicama
const groups = JSON.parse(fs.readFileSync('groups.json', 'utf-8'));
const exibitions = JSON.parse(fs.readFileSync('exibitions.json', 'utf-8'));

// Struktura tima
class Team {
    constructor(name, isoCode, fibaRanking) {
        this.name = name;
        this.isoCode = isoCode;
        this.fibaRanking = fibaRanking;
        this.points = 0;
        this.scoredPoints = 0;
        this.receivedPoints = 0;
        this.wins = 0;
        this.losses = 0;

        this.winsAgainst = {};                      // čuva broj pobeda protiv svakog tima
        this.playedAgainst = {};                    // čuva broj odigranih utakmica protiv svakog tima
        this.scoredPointsAgainst = {};              // čuva broj postignutih poena protiv svakog tima
        this.receivedPointsAgainst = {};            // čuva broj primljenih poena protiv svakog tima
        this.playedAgainstInGroupStage = new Set();       // timovi protiv kojih je igrao u grupnoj fazi
    }

    get pointDifference() {
        return this.scoredPoints - this.receivedPoints;
    }

    // Hash mapa - Cuvanje rezultata grupne faze
    saveMatch(opponent, scoredPoints, receivedPoints, win) {
        if (!this.playedAgainst[opponent.name]) {
            this.playedAgainst[opponent.name] = 0;
            this.winsAgainst[opponent.name] = 0;
            this.scoredPointsAgainst[opponent.name] = 0;
            this.receivedPointsAgainst[opponent.name] = 0;
        }
        this.playedAgainst[opponent.name] += 1;
        this.scoredPointsAgainst[opponent.name] += scoredPoints;
        this.receivedPointsAgainst[opponent.name] += receivedPoints;
        if (win) {
            this.winsAgainst[opponent.name] += 1;
        }
         this.playedAgainstInGroupStage.add(opponent.name);
    }
}

// Kreiranje timova iz JSON fajla
const teams = {};
for (const group of Object.keys(groups)) {
    teams[group] = groups[group].map(team => new Team(team.Team, team.ISOCode, team.FIBARanking));
}

// Transformisanje exibitions u novu strukturu bez datuma
const exibitionsResults = {};
for (const teamCode of Object.keys(exibitions)) {
    exibitionsResults[teamCode] = exibitions[teamCode].map(match => ({
        Opponent: match.Opponent,
        Result: match.Result
    }));
}

function calculateFormScore(team) {
    const matches = exibitionsResults[team.isoCode];
    let wins = 0;
    let pointDifference = 0;

    matches.forEach(match => {
        const [teamScore, opponentScore] = match.Result.split('-').map(Number);
        if (teamScore > opponentScore) wins++;
        pointDifference += (teamScore - opponentScore);
    });

    return { wins, pointDifference };
}

function calculateWinProbability(team1, team2, team1Form, team2Form) {
    const fibaWinProbability = 1 - team1.fibaRanking / (team1.fibaRanking + team2.fibaRanking);

    const formAdjustment = (team1Form.wins - team2Form.wins) * 0.05 + (team1Form.pointDifference - team2Form.pointDifference) * 0.001;

    return Math.min(Math.max(fibaWinProbability + formAdjustment, 0), 1);
}

// Funkcija za simulaciju utakmice
function simulateGame(team1, team2) {
    const winProbabilityTeam1 = calculateWinProbability(team1, team2, calculateFormScore(team1), calculateFormScore(team2))
    const team1Wins = Math.random() < winProbabilityTeam1 ? true : false;

    // Ako je team1Wins true, prvo se generiše rezultat za team1 u opsegu od 80 do 100. 
    // Zatim se generiše rezultat za team2 u opsegu između 70 i team1Score
    if (team1Wins) {
        team1Score = Math.floor(Math.random() * (100 - 80) + 80);
        team2Score = Math.floor(Math.random() * (team1Score - 70) + 70);
    } else {
        team2Score = Math.floor(Math.random() * (100 - 80) + 80);
        team1Score = Math.floor(Math.random() * (team2Score - 70) + 70);
    }

    // Provera da li je rezultat nerešen i dodavanje produžetka
    while (team1Score === team2Score) {
        const overtime1 = Math.floor(Math.random() * (15 - 5) + 5);
        const overtime2 = Math.floor(Math.random() * (15 - 5) + 5);
        team1Score += overtime1;
        team2Score += overtime2;
    }

    if (team1Wins) {
        team1.wins++;
        team2.losses++;
        team1.points += 2;
        team2.points += 1;
        team1.saveMatch(team2, team1Score, team2Score, true);
        team2.saveMatch(team1, team2Score, team1Score, false);
    } else {
        team2.wins++;
        team1.losses++;
        team2.points += 2;
        team1.points += 1;
        team2.saveMatch(team1, team2Score, team1Score, true);
        team1.saveMatch(team2, team1Score, team2Score, false);
    }

    team1.scoredPoints += team1Score;
    team1.receivedPoints += team2Score;
    team2.scoredPoints += team2Score;
    team2.receivedPoints += team1Score;

    if (!exibitionsResults[team1.isoCode]) {
        exibitionsResults[team1.isoCode] = [];
    }

    exibitionsResults[team1.isoCode].push({
        Opponent: team2.isoCode,
        Result: `${team1Score}-${team2Score}`
    });

    return { team1, team2, team1Score, team2Score };
}

// Simulira sve utakmice u grupi
function simulateGroupStage() {
    console.log(`\nGrupna faza - I kolo:`);
    for (const group of Object.keys(teams)) {
        console.log(`\nGrupa ${group}:`);
        const groupTeams = teams[group];

        for (let i = 0; i < groupTeams.length; i++) {
            for (let j = i + 1; j < groupTeams.length; j++) {
                const team1 = groupTeams[i];
                const team2 = groupTeams[j];
                const { team1Score, team2Score } = simulateGame(team1, team2);

                console.log(`${team1.name} - ${team2.name} (${team1Score}:${team2Score})`);
            }
        }
    }
}


// Rangiranje timova po grupama

// Ako više timova ima isti broj bodova, koristi se razlika u poenima u međusobnim utakmicama kako bi se odredio redosled.
// Funkcija za izračunavanje razlike u poenima u međusobnim utakmicama između timova koji imaju isti broj bodova
function calculatePointDifferenceInCircle(teams) {
    let pointDifference = {};
    teams.forEach(team => {
        pointDifference[team.name] = 0;
    });

    teams.forEach(team1 => {
        teams.forEach(team2 => {
            if (team1 !== team2 && team1.playedAgainst[team2.name]) {
                // Računanje razlike u poenima između timova samo za utakmice između vezanih timova
                pointDifference[team1.name] += (team1.scoredPointsAgainst[team2.name] - team1.receivedPointsAgainst[team2.name]);
            }
        });
    });

    return pointDifference;
}

// Prvo se rangiraju timovi prema bodovima
// Ako dva tima imaju isti broj bodova, proverava se međusobni susret
// Ako više timova ima isti broj bodova, koristi se razlika u poenima u međusobnim utakmicama kako bi se odredio redosled
// Funkcija za rangiranje timova unutar grupe
function rankTeamsInGroup(group) {
    const groupTeams = teams[group];

    // Sortiranje timova prema bodovima
    groupTeams.sort((a, b) => b.points - a.points);

    // Grupisanje timova sa istim brojem bodova
    let tieGroups = [];
    let start = 0;

    for (let i = 1; i < groupTeams.length; i++) {
        if (groupTeams[i].points === groupTeams[i - 1].points) {
            tieGroups.push(groupTeams[i - 1]);
            if (i === groupTeams.length - 1) tieGroups.push(groupTeams[i]);
        } else {
            if (tieGroups.length > 0) {
                tieGroups.push(groupTeams[i - 1]);
                // Računanje razlike u poenima za timove sa istim brojem bodova
                const pointDiff = calculatePointDifferenceInCircle(tieGroups);
                tieGroups.sort((a, b) => pointDiff[b.name] - pointDiff[a.name]);
                groupTeams.splice(start, tieGroups.length, ...tieGroups);
                tieGroups = [];
            }
            start = i;
        }
    }

    // Sortiranje timova prema razlici u poenima u međusobnim utakmicama
    groupTeams.sort((a, b) => {
        // 1. Broj bodova
        if (b.points !== a.points) return b.points - a.points;

        // 2. Razlika u poenima u međusobnim utakmicama
        const pointDiff = (b.scoredPointsAgainst[a.name] - b.receivedPointsAgainst[a.name]) - (a.scoredPointsAgainst[b.name] - a.receivedPointsAgainst[b.name]);
        if (pointDiff !== 0) return pointDiff;

        // 3. Ukupna koš razlika
        if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;

        // 4. Ukupan broj postignutih poena
        return b.scoredPoints - a.scoredPoints;
    });

    return groupTeams;
}

// Funkcija za prikaz konačnih rezultata po grupama
function displayGroupResults() {
    console.log("\nKonačan plasman u grupama:");
    for (const group of Object.keys(teams)) {
        const rankedTeams = rankTeamsInGroup(group);
        console.log(`\nGrupa ${group}:`);
        rankedTeams.forEach((team, index) => {
            console.log(`${index + 1}. ${team.name} - Pobede: ${team.wins}, Porazi: ${team.losses}, Bodovi: ${team.points}, Postignuti koševi: ${team.scoredPoints}, Primljeni koševi: ${team.receivedPoints}, Koš razlika: ${team.pointDifference}`);
        });
    }
}


// ŽREB

// Kreiranje eliminacione faze
// Formiramo šešire i parove za eliminacionu fazu prema rangovima timova

// Funkcija za formiranje šešira za žreb
function formSeededPots() {
    const pots = { D: [], E: [], F: [], G: [] };
    const allRankedTeams = [];

    for (const group of Object.keys(teams)) {
        const rankedTeams = rankTeamsInGroup(group);
        allRankedTeams.push(...rankedTeams);
    }

    // Timovi iz grupa A, B i C se medjusobno rangiraju po primarno po broju bodova, 
    // zatim koš razlici (u slučaju jednakog broja bodova),
    // i zatim broja postignutih koševa (u slučaju jednakog broja bodova i koš razlike)

    allRankedTeams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
        return b.scoredPoints - a.scoredPoints;
    });

    // Podela timove po šeširima
    pots.D.push(allRankedTeams[0], allRankedTeams[1]);
    pots.E.push(allRankedTeams[2], allRankedTeams[3]);
    pots.F.push(allRankedTeams[4], allRankedTeams[5]);
    pots.G.push(allRankedTeams[6], allRankedTeams[7]);

    return pots;
}

// Funkcija za prikaz šešira i parova eliminacione faze
function displayEliminationPairs(pots) {
    const quarterFinals = [];
    const usedMatches = new Set();

    console.log("\nŠeširi:");
    for (const pot in pots) {
        console.log(`Šešir ${pot}:`);
        pots[pot].forEach(team => console.log(`\t${team.name}`));
    }

    const possiblePairs = [];

    // Formiranje svih mogućih parova bez ponavljanja timova (koji nisu medjusobno igrali u grupnoj fazi)
    for (let i = 0; i < pots.D.length; i++) {
        for (let j = 0; j < pots.G.length; j++) {
            if (!pots.D[i].playedAgainstInGroupStage.has(pots.G[j].name)) {
                possiblePairs.push({ home: pots.D[i], away: pots.G[j] });
            }
        }
    }

    for (let i = 0; i < pots.E.length; i++) {
        for (let j = 0; j < pots.F.length; j++) {
            if (!pots.E[i].playedAgainstInGroupStage.has(pots.F[j].name)) {
                possiblePairs.push({ home: pots.E[i], away: pots.F[j] });
            }
        }
    }

    // Prilikom izbora parova, proveravamo da li su već izabrani
    while (quarterFinals.length < 4) {
        if (possiblePairs.length === 0) {
            console.log("Nema više mogućih parova koji ispunjavaju uslove. Moramo dodati preostale timove.");
            // Dodavanje preostalih timova koji nisu izabrani, čak i ako su igrali međusobno
            for (let i = 0; i < pots.D.length; i++) {
                if (!usedMatches.has(pots.D[i])) {
                    for (let j = 0; j < pots.G.length; j++) {
                        if (!usedMatches.has(pots.G[j])) {
                            quarterFinals.push({ home: pots.D[i], away: pots.G[j] });
                            usedMatches.add(pots.D[i]);
                            usedMatches.add(pots.G[j]);
                            break;
                        }
                    }
                }
            }

            for (let i = 0; i < pots.E.length; i++) {
                if (!usedMatches.has(pots.E[i])) {
                    for (let j = 0; j < pots.F.length; j++) {
                        if (!usedMatches.has(pots.F[j])) {
                            quarterFinals.push({ home: pots.E[i], away: pots.F[j] });
                            usedMatches.add(pots.E[i]);
                            usedMatches.add(pots.F[j]);
                            break;
                        }
                    }
                }
            }

            break;
        }

        const index = Math.floor(Math.random() * possiblePairs.length);
        const pair = possiblePairs.splice(index, 1)[0];

        if (!usedMatches.has(pair.home) && !usedMatches.has(pair.away)) {
            quarterFinals.push(pair);
            usedMatches.add(pair.home);
            usedMatches.add(pair.away);
        }
    }

    console.log("\nEliminaciona faza:");
    quarterFinals.forEach(match => {
        console.log(`${match.home.name} - ${match.away.name}`);
    });

    return quarterFinals;
}


// Simulacija Eliminacione Faze
function simulateEliminationRound(matches) {
    const nextRound = [];
    matches.forEach(match => {
        const { home, away } = match;
        const { team1, team2, team1Score, team2Score } = simulateGame(home, away);
        console.log(`${team1.name} - ${team2.name} (${team1Score}:${team2Score})`);
        nextRound.push(team1Score > team2Score ? team1 : team2);
    });
    return nextRound;
}


function simulateEliminationRoundFinals(matches) {
    const nextRound = [];
    matches.forEach(match => {
        const { home, away } = match;
        const { team1, team2, team1Score, team2Score } = simulateGame(home, away);
        console.log(`${team1.name} - ${team2.name} (${team1Score}:${team2Score})`);

        const winner = team1Score > team2Score ? team1 : team2;
        const loser = team1Score < team2Score ? team1 : team2;

        nextRound.push(winner, loser);    // Prvo dodajemo pobednika, pa poraženog
    });

    // for (let i = 0; i < nextRound.length; i++) {
    //     console.log(`Next round: ${i % 2 === 0 ? 'Winner' : 'Loser'}: ${nextRound[i].name}`);
    // }
    
    return nextRound;
}

// Funkcija za simulaciju i prikaz medalja
function simulateEliminationStage(quarterFinals) {
    console.log("\nČetvrtfinale:");
    const semiFinals = simulateEliminationRound(quarterFinals);

    console.log("\nPolufinale:");
    const finals = simulateEliminationRoundFinals([
        { home: semiFinals[0], away: semiFinals[1] },
        { home: semiFinals[2], away: semiFinals[3] }
    ]);

    console.log("\nUtakmica za treće mesto:");
    const thirdPlaceMatch = simulateEliminationRoundFinals([{ home: finals[1], away: finals[3] }]);

    console.log("\nFinale:");
    const winner = simulateEliminationRoundFinals([{ home: finals[0], away: finals[2] }]);

    console.log("\nMedalje:");
    console.log(`1. ${winner[0].name}`);
    console.log(`2. ${winner[1].name}`);
    console.log(`3. ${thirdPlaceMatch[0].name}`);
}


// Glavna funkcija koja pokreće sve faze turnira
function runTournament() {

    simulateGroupStage();
    displayGroupResults();
    const pots = formSeededPots();
    const quarterFinals = displayEliminationPairs(pots);
    simulateEliminationStage(quarterFinals);
}

// Pokreni simulaciju
runTournament();


