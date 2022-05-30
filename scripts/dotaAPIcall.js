fetch("https://api.opendota.com/api/matches/271145478?api_key=ff36b53a-ef91-46ea-96ac-f7c58683a606")
    .then((response) => {
        console.log("API: " , response.json);
})
.catch();