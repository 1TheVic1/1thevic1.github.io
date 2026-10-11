// OpenDota API key removed from source — was previously hardcoded here and exposed in the public repo.
// Real key is saved locally at .secrets/opendota-api-key.txt (gitignored, not committed).
var DOTA_API_KEY = ""; // fill in locally before running, never commit a real key here
fetch("https://api.opendota.com/api/matches/271145478" + (DOTA_API_KEY ? "?api_key=" + DOTA_API_KEY : ""))
    .then((response) => {
        console.log("API: " , response.json);
})
.catch();