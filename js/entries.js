$(document).ready(function() {
    $("#login").text("profile");
    $("#login").addClass("current-view");
    
    var CID = window.location.hash.substring(1)

    api.v1.account.invites().done(showInvites)
    //check if invites exist and display number above invitations tab on profile page
    function showInvites(invites) {
        if(invites.length > 0 ){
            var invitationsContainer = el('div.invitationContainer')
            var new_Invitations = el('a.newInvitation', {href : "/invitations.html"},invites.length + " " )
            invitationsContainer.appendChild(new_Invitations)
            document.querySelector("[href='/invitations.html']").appendChild(invitationsContainer)
         }
    }

    // stores all the queued entries
    var entries = [];
    api.v1.admin.pending().done(pending => {
        pending.forEach(entry => {
            api.v1.entry.taxonomy(entry.id).done(taxonomy => {
                entries.push(entry)
                entry.taxonomy = taxonomy
                insertIntoTable(entry, entries.length - 1)
            })
        })
    }).fail(xhr => {
        if (xhr.status === 403)
            window.location = "/profile.html"
        else
            window.location = "/login.html"
    })

    function acceptEntry(entryNumber) {
        return api.v1.admin.acceptEntry(entries[entryNumber].id)
    }
    function rejectEntry(entryNumber) {
        return api.v1.admin.rejectEntry(entries[entryNumber].id)
    }

    function commit(entryNumber, action) {
        action(entryNumber)
            .done(ok => {
                modals.clearAll()
                removeEntry(entryNumber);
            })
            .fail(xhr => window.alert(xhr.responseText))
    }

    function acceptEntryCallback(evt) {
        commit(Number(this.dataset.entryNumber), acceptEntry)
    }

    function rejectEntryCallback(evt) {
        commit(Number(this.dataset.entryNumber), rejectEntry)
    }

    function entryButton(name, style, entryNumber, fn) {
        var btn = el(`button.${style}`, {
            'data-entry-number': entryNumber
        }, [name]);

        if (name === 'accept')
            btn.addEventListener("click", acceptEntryCallback, false);
        else
            btn.addEventListener("click", rejectEntryCallback, false);

        return btn;
    }
    
    function createCell(taxonomy, subfacet, alternating) {
        var filled = taxonomy[subfacet.toUpperCase()] ? '.filled-cell' : ''
        var alt = alternating ? '.alternating-group' : ''
        return el(`td${filled}${alt}`)
    }

    var maxLength = 35;
    function insertIntoTable(entry, entryNumber) {
        var entryTitle = entry["description"] || entry["reference"];
        if (entryTitle.length > maxLength)
            entryTitle = entryTitle.substring(0, maxLength - 3) + "..." 

        var title = el('td', [entryTitle])
        title.addEventListener('click', buildModalView, false)

        // let's build the table row for this entry
        var row = el('tr', {'data-entry-number': entryNumber }, [
            title,

            createCell(entry.taxonomy, "intervention", true),

            // effect
            createCell(entry.taxonomy, "solving"),
            createCell(entry.taxonomy, "adapting"),
            createCell(entry.taxonomy, "assessing"),
            createCell(entry.taxonomy, "improving"),

            // scope
            createCell(entry.taxonomy, "planning", true),
            createCell(entry.taxonomy, "design", true),
            createCell(entry.taxonomy, "execution", true),
            createCell(entry.taxonomy, "analysis", true),

            // context
            createCell(entry.taxonomy, "people"),
            createCell(entry.taxonomy, "information"),
            createCell(entry.taxonomy, "sut"),
            createCell(entry.taxonomy, "other"),

            el('td', [entryButton('accept', 'entries-accept-btn', entryNumber)]),
            el('td', [entryButton('reject', 'entries-reject-btn', entryNumber)])
        ])

        document.getElementById("table-body").appendChild(row);
    }

    function buildModalView(evt) {
        var entryNumber = Number(this.parentNode.dataset.entryNumber);
        var entry = entries[entryNumber];

        var modalOpt = {
            button: [
                entryButton('accept', 'btn', entryNumber),
                entryButton('reject', 'btn', entryNumber)
            ]
        }
        modals.entryModal(CID,entry, entry.taxonomy, modalOpt)
    }

    function removeEntry(entryNumber) {
        var table = document.getElementById("table-body")

        entries.splice(entryNumber, 1); 

        // Update data attribute of the table cells _after_ the entry
        for (var i = entryNumber + 1; i < table.children.length; i++) {
            var row = table.children[i]
            var num = Number(row.dataset.entryNumber) - 1

            var btns = row.querySelectorAll('button')
            for (var j = 0; j < btns.length; j++)
                btns[j].dataset.entryNumber = num
                
            row.dataset.entryNumber = num
        }

        // Remove after loop to reduce jank
        table.removeChild(table.children[entryNumber])
    }

});
