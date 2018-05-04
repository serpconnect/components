$(document).ready(function() {
    $("#login").text("profile");
    $("#login").addClass("current-view");

    window.api.v1.account.invites()
        .done(showPending)
        .done(showInvites)
        .fail(somethingWentWrong)

    window.api.ajax("GET", window.api.host + "/v1/admin").done(ok => {
        var a = el('a.view-area-tab.unactive-tab', {href : "/users.html"}, ['users'])
        var b = el('a.view-area-tab.unactive-tab', {href : "/entries.html"}, ['pending entries'])
        var c = el('a.view-area-tab.unactive-tab', {href : "/collections.html"}, ['all collections'])
        var div = document.querySelector('.profile-area-wrapper')
        div.insertBefore(a, div.lastChild)
        div.insertBefore(b, div.lastChild)
        div.insertBefore(c, div.lastChild)
        api.v1.admin.pending().done(showPendingEntries)        
    })

    //check if invites exist and display number above invitations tab on profile page
    function showInvites(invites) {
        if(invites.length > 0 ){
            var invitationsContainer = el('div.invitationContainer')
            var new_Invitations = el('a.newInvitation', {href : "/invitations.html"},invites.length + " " )
            invitationsContainer.appendChild(new_Invitations)
            document.querySelector("[href='/invitations.html']").appendChild(invitationsContainer)
         }
    }
    function showPendingEntries(entries) {
        if (entries.length > 0) {
            var div = el('div.invitationContainer', [
                el('div.newInvitation', {
                    href: '/entries.html'
                }, [entries.length.toString()])
            ])
            document.querySelector("[href='/entries.html']").appendChild(div)
         }
    }
    function decreaseInviteCounter() {
        var invitations = document.querySelector("[href='/invitations.html']")
        var container = invitations.querySelector('.invitationContainer')
        var invitation = container.querySelector('.newInvitation')
        var invites = parseInt(invitation.textContent, 10) - 1

        if (invites === 0)
            invitations.removeChild(container)
        else
            invitation.textContent = invites.toString()
    }

    function somethingWentWrong(reason, xhr) {}

    function showPending(invites) {
        var parent = $(".invitation-content")

        invites.forEach(coll => {
            var acceptBtn = el("button.invitation-btn.accept-btn", ['accept'])
            var rejectBtn = el("button.invitation-btn.reject-btn", ['reject'])

            acceptBtn.addEventListener('click', accept, false)
            rejectBtn.addEventListener('click', reject, false)

            var div = el('div.invitation-wrapper', [
                el('div.invitation-text', [
                    'You were invited to',
                    el('div.invitation-link', [`${coll.name} (${coll.id})`])
                ]),
                acceptBtn,
                rejectBtn
            ])
            div.dataset.collectionId = coll.id
            parent.append(div)
        })
    }

    function commit(node, action) {
        var id = node.parentNode.dataset.collectionId
        var parent = $(node.parentNode)

        parent.children("button").attr("disabled", true)

        window.api.ajax("POST", window.api.host + "/v1/collection/" + id + action)
        .done(obj => parent.slideToggle())
        .done(obj => decreaseInviteCounter())
        .fail(reason => window.alert(JSON.stringify(reason)))
    }

    function accept(evt) {
        commit(this, "/accept")
    }

    function reject(evt) {
        commit(this, "/reject")
    }
});
