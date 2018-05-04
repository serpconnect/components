$(document).ready(function() {
    $("#login").text("profile");
    $("#login").addClass("current-view");

    /* Add red text after the cancel button on a modal */
    function complain(text) {
        $('.modal-complaint').remove()
        modals.clearTop()
        var modal = document.querySelector(".modal") || document.querySelector(".confirm")
        var errors = modal.querySelectorAll('button')
        var error = errors[errors.length - 1]
        var complaint = el('div.modal-complaint', [text])
        error.parentNode.insertBefore(complaint, error.nextSibling)
    }

    // Load descriptions from the html page (easy editing)
    var descriptions = Array.from(document.querySelectorAll('.description-field'))
        .map(el => {
            var lvl =  el.querySelector('.level').textContent.trim()
            var dsc = el.querySelector('.description').textContent
            return { [lvl]: dsc }
        })
    var levelDescriptions = Object.assign({}, ...descriptions)

    // Check if invites exist and display number above invitations tab on profile page
    api.v1.account.invites().done(showInvites)
    function showInvites(invites) {
        if(invites.length > 0 ){
            var invitationsContainer = el('div.invitationContainer')
            var new_Invitations = el('a.newInvitation', {href : "/invitations.html"},invites.length + " " )
            invitationsContainer.appendChild(new_Invitations)
            document.querySelector("[href='/invitations.html']").appendChild(invitationsContainer)
         }
    }

    api.v1.admin.pending().done(showPendingEntries)
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

    var emails = [];
    var emailMappings = {};
    var emailsFuzzy = undefined;
    var previousValue = undefined;

    function recordPreviousValue(evt) {
        previousValue = this.value
    }
    function changeUserLevel(evt) {
        if (previousValue === this.value) return
        buildModalView($(this), this.parentNode.dataset.email, previousValue, this.value);
    }
    function createLevelOption(level) {
        return el('option', {
            'value': level,
            'title': levelDescriptions[level]
        }, [level])
    }
    function createLevelSelect(user) {
        var select = el('select.users-select',
            Object.keys(levelDescriptions).map(createLevelOption)
        )
        select.value = user.trust.toLowerCase()

        select.addEventListener('focus', recordPreviousValue, false)
        select.addEventListener('change', changeUserLevel, false)
        return select
    }

    function deleteUser(user) {
        return api.v1.admin.deleteUser(user.email)
            .done(ok => {
                modals.clearAll()
                location.reload(true)
            })
            .fail(xhr => complain(xhr.responseText))
    }

    function showDeleteAccountModal(user) {
        window.modals.optionsModal({
            desc: "Delete Account",
            message: `This will delete ${user.email}, but the users collections and entries will remain. Are you sure?`,
            btnText: "delete"
        }, () => {
            api.v1.admin.collectionsOwnedBy(user.email)
                .done(collz => {
                    if (collz.length === 0) {
                        deleteUser(user)
                        return
                    }

                    window.modals.confirmDeleteOwnerPopUp({
                        desc: "Delete Collection Owner",
                        message: "Warning the user is owner of the following collections:",
                        bottomMessage: "Deleting the user will nuke those collections, proceed?",
                        list: collz
                    }, () => {
                        deleteUser(user)
                    })
                })
        })
    }
    function createDeleteButton(user) {
        var btn = el("button.dangerous", ['✖'])

        btn.addEventListener("click", evt => {
            showDeleteAccountModal(user)
        }, false)

        return btn
    }

    api.v1.admin.users().done(users => {
        var parent = document.querySelector('.users-area')

        users.forEach(user => {
            var div = el('div.users-container', {
                    'data-email': user.email,
                }, [
                el('span', [user.email]),
                createLevelSelect(user),
                createDeleteButton(user)
            ])

            parent.appendChild(div)

            emails.push(user.email)
            emailMappings[emails.length - 1] = div
        })

        emailsFuzzy = new Fuse(emails, {
            threshold: 0.5
        });
    }).fail(xhr => {
        if (xhr.status === 403)
            window.location = "profile.html"
        else
            window.location = "login.html"
    })

    $("#users-search").on("input", function(evt) {
        var searchString = this.value;
        if (searchString) {
            $(".users-container").hide();
            var results = emailsFuzzy.search(searchString);
            if (!results.length) return

            for (var i = 0; i < results.length; ++i) {
                var matchingEmail = results[i];
                $(emailMappings[matchingEmail]).show();
            }
        } else {
            $(".users-container").show();
        }
    });

    function setDropdownSilent($dropdown, value) {
        var pv = previousValue
        previousValue = value
        $dropdown.val(value)
        previousValue = pv
    }

    function buildModalView($dropdown, userEmail, oldLevel, newLevel) {
        var modal = modals.optionsModal({
            desc: userEmail + " from " + oldLevel + " to " + newLevel,
            message: levelDescriptions[newLevel],
            btnText: 'change'
        }, function accept() {
            window.api.ajax("PUT", window.api.host + "/v1/admin/set-trust", {
                email: userEmail,
                trust: newLevel.charAt(0).toUpperCase() + newLevel.substring(1)
            }).fail(reason => {
                window.alert(reason)
                setDropdownSilent($dropdown, oldLevel)
            })
        }, function cancel() {
            setDropdownSilent($dropdown, oldLevel)
        })
    }
});
