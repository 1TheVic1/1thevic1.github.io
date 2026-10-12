// Fills the Warframe page dashboard from window.WF_DATA (scripts/warframe_data.js).
(function () {
    var data = window.WF_DATA;
    if (!data) return;

    var pct = function (done, total) { return total ? (done / total) * 100 : 0; };
    var fmt = function (n) { return n.toFixed(1) + '%'; };

    document.getElementById('wfRankNum').textContent = 'MR ' + data.masteryRank;
    document.getElementById('wfRankName').textContent = data.rankName || '';

    var total = 0, mastered = 0;
    var cards = document.getElementById('wfCards');
    data.groups.forEach(function (g) {
        total += g.total;
        mastered += g.mastered;
        var card = document.createElement('div');
        card.className = 'wf-card';
        var rows = [['Total', g.total], ['Mastered', g.mastered], ['Remaining', g.total - g.mastered], ['Completion', fmt(pct(g.mastered, g.total))]];
        var head = document.createElement('div');
        head.className = 'wf-card-head';
        head.textContent = g.name;
        card.appendChild(head);
        rows.forEach(function (r) {
            var row = document.createElement('div');
            row.className = 'wf-card-row';
            var k = document.createElement('span');
            k.textContent = r[0];
            var v = document.createElement('span');
            v.textContent = r[1];
            row.appendChild(k);
            row.appendChild(v);
            card.appendChild(row);
        });
        var bar = document.createElement('div');
        bar.className = 'wf-card-bar';
        var barFill = document.createElement('span');
        barFill.style.width = pct(g.mastered, g.total) + '%';
        bar.appendChild(barFill);
        card.appendChild(bar);
        cards.appendChild(card);
    });

    var overall = pct(mastered, total);
    document.getElementById('wfTotalPct').textContent = fmt(overall);
    document.getElementById('wfTotalCount').textContent = mastered + ' / ' + total;

    // Donut: circumference of r=50 drawn as a dash, filled to the overall %.
    var fill = document.getElementById('wfDonutFill');
    var c = 2 * Math.PI * 50;
    fill.style.strokeDasharray = c;
    fill.style.strokeDashoffset = c * (1 - overall / 100);

    document.getElementById('wfUpdated').textContent = 'Updated ' + data.updated;
})();
