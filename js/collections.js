$(function() {
    //stores friends emails of the logged in user
    var friends = [];
    var collections = [];
    var collectionsMappings = {};

    var collectionsFuzzy = undefined;

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

    /* Add red text after the cancel button on a modal */
    function complain(text) {
        $('.modal-complaint').remove()
        modals.clearConfirm()
        var modal = document.querySelector(".modal") || document.querySelector(".confirm")
        var errors = modal.querySelectorAll('button')
        var error = errors[errors.length - 1]
        var complaint = el('div.modal-complaint', [text])
        error.parentNode.insertBefore(complaint, error.nextSibling)
    }

    function cleanup(modal) {
        modals.clearAll()
        api.v1.account.self().done(update)
    }

    function invite(evt) {
        var parent = this.parentNode.parentNode.parentNode
        var id = parent.dataset.collectionId
        var name = parent.querySelector('.collection-title').textContent

        var inviteUserModal = {
            desc: "Invite User to " + name,
            message: "",
            input: [['input0','email','user email']],
            btnText: "Invite"
        }

        window.modals.optionsModal(inviteUserModal,function (email) {
            api.v1.collection.invite(email, id)
                .done(ok => cleanup(this.modal))
                .fail(xhr => complain(xhr.responseText))
        })

        new Awesomplete('#input0', {
                        list: friends,
                        filter: ausomplete.autocompleteFilter,
                        replace: ausomplete.autocompleteUpdate
                })
    }

    function kick(evt) {
        var parent = this.parentNode.parentNode.parentNode
        var id = parent.dataset.collectionId
        var name = parent.querySelector('.collection-title').textContent

        var myemail = document.getElementsByClassName('user-email')[0].innerHTML
        var indx = myemail.indexOf(' ')
        myemail=myemail.substring(0,indx);
        api.v1.collection.members(id,"all").done(data =>  {
          var emails=[];
          for(i = 0; i<data.length;i++){
            if(data[i].email != myemail){
              emails[i]=data[i].email;
            }
          }


        var kickUserModal = {
            desc: "Kick User from " + name,
            message: "",
            list: emails,
            input: [['input0','email','user email']],
            btnText: "Kick"
        }

        //fix alternatives so only people in the collection shows up
        window.modals.fuzzyModal(kickUserModal,function (email) {
            window.modals.confirmKickPopUp(`Are you sure you want to Kick ${email}?`, () => {
                api.v1.collection.kick(email, id)
                    .done(ok => cleanup(this.modal))
                    .fail(xhr => complain(xhr.responseText))
            })

        })


          new Awesomplete('#input0', {
                          list: emails,
                          filter: ausomplete.autocompleteFilter,
                          replace: ausomplete.autocompleteUpdate
                  })
        })
    }

    function submit(evt) {
        var id = getId(this.parentNode)
        window.location = window.location.origin + "/submit.html?c=" + id
    }

    function search(evt) {
        var id = getId(this.parentNode)
        window.location = window.location.origin + "/search.html#" + id
    }

    function explore(evt) {
          var id = getId(this.parentNode)
        window.location = window.location.origin + "/explore.html#" + id
    }

    function manage(evt) {
        var id = getId(this.parentNode)
        window.location = window.location.origin + "/collection.html#" + id
    }

    function getId(parent){
      while(parent.className!='collection-wrapper'){
        parent=parent.parentNode;
      }
      return parent.dataset.collectionId
    }

    function deleteColl(evt){
      var id=getId(this.parentNode);
      window.components.deleteCollectionModal(id)
        .then(cleanup)
        .catch(complain)
    }

    function collectionOption(name, callback) {
        var option = el('div.collection-option', [name])
        option.addEventListener('click', callback, false)
        return option
    }

    /* X member(s), Y entr(y|ies) */
    function formatStats(members, entries) {
        var mems = members === 1 ? "member" : "members"
        var entr = entries === 1 ? "entry" : "entries"

        return `${members} ${mems}, ${entries} ${entr}`
    }

    function appendCollection(self, coll, isCollectionOwner,mine) {
        var adminActions = el('div.collection-row', [
          collectionOption('delete', deleteColl),
        ])

    	var obj = el('div.collection-wrapper', [
			el('div.collection-info', [
    			el('a.collection-title', {href: "/collection.html#" + coll.id}, [
                    el('span', [coll.name]),
                    el('span.collection-id', [" #" + coll.id]),
                    el('span.collection-owner',[isCollectionOwner ? " (owner)" : ""])
                ]),
    			el('div.collection-stats', [formatStats(coll.members, coll.entries)])
    		]),
            el('div.collection-options', [
                el('div.collection-row', [
                    collectionOption('search', search),
                    collectionOption('explore', explore),
                ]),
                adminActions
            ])
		])

		  obj.dataset.collectionId = coll.id
      if(mine){
          document.querySelector("div.my-collections-container").appendChild(obj)
      }else{
        document.querySelector("div.all-collections-container").appendChild(obj)
      }
      collections.push(coll.name + " #" + coll.id)
      collectionsMappings[collections.length - 1] = obj

    }

    function update(self) {
        $(".user-email").text(`${self.email} (${self.trust})`)
        $("div.collection-wrapper").remove()

        self.collections.forEach(coll => {
            api.v1.collection.stats(coll.id).then(data => {
                coll.members = data.members
                coll.entries = data.entries
            }).then(function(){
                return api.v1.collection.isOwner(coll.id)
            }).then(owner => {
                appendCollection(self, coll, owner,true)
            })
        })

        api.v1.account.friends(self.email).done(data => friends = data)
    }

    function updateStats(showing) {
        var ncoll = $(".collection-wrapper").length
        if (showing === -1)
            showing = ncoll

        var stats = ` (Showing ${showing}/${ncoll})`
        document.getElementById('stats').textContent = stats
    }

    $("#collections-search").on("input", function(evt) {
        var searchString = this.value;

        if (searchString) {
            //console.log($(".collection-wrapper"));
            $(".collection-wrapper").hide();
            var results = collectionsFuzzy.search(searchString);
            if (results.length) {
                for (var i = 0; i < results.length; ++i) {
                    var matchingCollection = results[i];
                    $(collectionsMappings[matchingCollection]).show();
                }
            }
            updateStats(results.length)
        } else {
            $(".collection-wrapper").show();
            updateStats(-1)
        }
    });

    function setup(self) {

        if (self.trust !== "Admin") {
            window.location = "/profile.html"
        }

        update(self)

        window.api.ajax("GET", window.api.host + "/v1/admin/collections").done(collections =>{
          collections.forEach(coll => {
              api.v1.collection.stats(coll.id).then(data => {
                  coll.members = data.members
                  coll.entries = data.entries
              }).then(function(){
                  return api.v1.admin.isCollectionOwner(coll.id)
              }).then(owner => {
                  appendCollection(self, coll, owner,false)
                  updateStats(-1)
              })
          })
        })

        collectionsFuzzy = new Fuse(collections, {
            threshold: 0.5
        });
    }

    // Load logged in user and proceed to setup otherwise redirect to login
    api.v1.account.self()
        .done(setup)
        .fail(xhr => window.location = "/login.html")

    $("#profile").addClass("current-view");
})
