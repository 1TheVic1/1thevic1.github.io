// Populates the Dota page with real OpenDota data for this account.
// Hero *names* come from the API (plain text/facts); hero *pictures* stay as
// the generic placeholder icon on purpose — not pulling Valve's hero artwork.
var DOTA_ACCOUNT_ID = "99551336";

document.addEventListener("DOMContentLoaded", function () {
  var steamNameEl = document.getElementById("steamName");
  var profilePicEl = document.getElementById("profilePic");
  var heroNameEls = document.querySelectorAll(".hero-name");

  fetch("https://api.opendota.com/api/players/" + DOTA_ACCOUNT_ID)
    .then(function (res) {
      if (!res.ok) throw new Error("player fetch failed: " + res.status);
      return res.json();
    })
    .then(function (data) {
      var profile = data.profile || {};
      if (profile.personaname) steamNameEl.textContent = profile.personaname;
      if (profile.avatarfull) {
        profilePicEl.innerHTML = "";
        var img = document.createElement("img");
        img.src = profile.avatarfull;
        img.alt = profile.personaname || "Steam avatar";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.borderRadius = "100%";
        img.style.objectFit = "cover";
        profilePicEl.appendChild(img);
      }
    })
    .catch(function (err) {
      console.log("Dota profile fetch failed:", err);
    });

  Promise.all([
    fetch("https://api.opendota.com/api/players/" + DOTA_ACCOUNT_ID + "/heroes").then(function (res) {
      if (!res.ok) throw new Error("heroes fetch failed: " + res.status);
      return res.json();
    }),
    fetch("https://api.opendota.com/api/heroes").then(function (res) {
      if (!res.ok) throw new Error("hero list fetch failed: " + res.status);
      return res.json();
    }),
  ])
    .then(function (results) {
      var played = results[0];
      var heroList = results[1];
      var nameById = {};
      heroList.forEach(function (h) {
        nameById[h.id] = h.localized_name;
      });
      var top5 = played
        .slice()
        .sort(function (a, b) {
          return b.games - a.games;
        })
        .slice(0, 5);
      top5.forEach(function (hero, i) {
        if (heroNameEls[i]) {
          heroNameEls[i].textContent = nameById[hero.hero_id] || "Hero " + (i + 1);
        }
      });
    })
    .catch(function (err) {
      console.log("Dota hero stats fetch failed:", err);
    });
});
