$(document).ready(function() {

    window.addEventListener("beforeunload", function (e) {
      if(queuedEntries.length > 0){
         var message = "You have unsaved entries queued.\n\n"
            + "Do you still want to leave?";
         e.returnValue = message;
         return message;
      }
    });

    var loggedIn = false;
    api.v1.account.loggedIn()
        .done(() => loggedIn = true)
        .fail(() => loggedIn = false)

    /* Set by selectCollection() when loading a collection */
    var collectionTaxonomy = undefined

     /* All interactive/clickable elements */
     function getUIElements() {
        return ["#submit-queue-btn", "#submit-btn", "#queue-btn",
                "#load-btn", "#collection",
                "#submit-create-collection"
        ]
    }

    var querystring = {}
    /* Naive querystring ?a=1&b=c --> {a:1, b:'c'} mapping */
    if (window.location.search) {
        var params = window.location.search.substring(1).split('&')
        for (var i = 0; i < params.length; i++) {
            var split = params[i].indexOf('=')
            var name = params[i].substring(0, split)
            var value = params[i].substring(split + 1)

            querystring[name] = value
        }
    }

    // set the little white line underneath the submit title
    $("#submit").addClass("current-view");

    /* Update the select element with user's collections */
    function updateCollectionList() {
        return window.api.v1.account.collections()
        .then(collz => {
            var select = document.getElementById('collection')
            var def = collz[0].id

            while (select.firstChild)
                select.removeChild(select.firstChild)

            collz
                .map(coll => {
                    return el('option', {value:coll.id}, [coll.name])
                })
                .forEach(option => select.appendChild(option))
            select.value = querystring.c || def

            if (!querystring.e)
                return selectCollection(querystring.c || def)
        }).catch(err => {
            selectCollection(undefined)
        })
    }

    //booleans to limit number of error messages
    var researchComplaint=false;
    var challengeComplaint=false;

    // load the requested entry if we have one
    var currentEntry = undefined
    function loadLinkedEntry(entryId) {
        if (!entryId) return

        return api.v1.entry.collection(entryId)
        .then(collection => {
            return selectCollection(collection.id)
        }).catch(err => {
            var msg = "You are not a member of the collection this entry " +
                      "belongs to and cannot edit this entry." +
                      "\n\nSelect a collection and click 'submit' to add " +
                      "this entry to your own collection instead."
            flashErrorMessage(msg)
            var collections = document.querySelectorAll('#collection > option')
            // We pick first collection available as default
            return selectCollection(parseInt(collections[0].value))
        }).then(() => {
            return Promise.all([
                api.v1.entry.get(entryId),
                api.v1.entry.taxonomy(entryId)
            ]).then(promise => {
                var entry = promise[0]
                entry.entryType = entry.type
                entry.serpClassification = promise[1]
                currentEntry = entry

                fillAccordingToEntry(entry, true)
            })
        })
    }

    /* LAUNCH! */
    updateCollectionList()
        .then(() => loadLinkedEntry(querystring.e))

    /* Clear any browser-cached data */
    $('input:checkbox').removeAttr('checked');
    $("#new-collection").val("");

    // stores all the queued entries
    var queuedEntries = [];

    /**
     * Map facet to entities:
     * {
     *     'PLANNING': ['someday maybe', 'tuesday afternoon']
     * }
     */
    var autocompleteMap = {};
    function getFacetEntities(facet) {
        return autocompleteMap[facet] || []
    }

    /* Load the above map; will succeed iff user is member of collection */
    function reloadAutocomplete(collectionId) {
        if (!collectionId) return

        return api.v1.collection.classification(collectionId)
            .then(classification => {
                for (var i = 0; i < classification.length; i++) {
                    var facet = classification[i]
                    var samples = facet.text.filter(txt => txt !== 'unspecified')
                    autocompleteMap[facet.facetId] = samples
                }
            })
    }

    /* Sort the generated classification using this function */
    function byNbrOfChildren (a, b) {
        return a.children.length - b.children.length
    }

    function removeParent(evt) {
        var sample = this.parentNode
        sample.parentNode.removeChild(sample)
    }

    /* when user clicks the [+] of a facet */
    function classification_add_row(evt) {
        var remove = el("div.remove", ["✖"])
        remove.addEventListener('click', removeParent)

        var input = el('input')
        var row = el('div.entity-sample', [
            input,
            remove
        ])
        this.parentNode.appendChild(row)

        var facet = this.parentNode.querySelector('.header').dataset.facetId
        new Awesomplete( input, {
            list: autocompleteMap[facet],
            filter: ausomplete.autocompleteFilter,
            replace: ausomplete.autocompleteUpdate
        })

        return row
    }

    /* when user changes the checkbox value of a facet */
    function classification_checkbox_click(evt) {
        var header = this.parentNode

        if (!this.checked) {
            /* the [+] and inputs are siblings to the header */
            while (header.nextSibling)
                header.parentNode.removeChild(header.nextSibling)
        } else {
            // TODO: Load text from somewhere
            var add = el("div.additional-data", ["click to add new leaf +"])
            add.addEventListener('click', classification_add_row, false)
            header.parentNode.insertBefore(add, header.nextSibling)
        }
    }

    function generate_checkbox () {
        var box = el("input", {type:"checkbox"})
        box.addEventListener('change', classification_checkbox_click, false)
        return box
    }

    function generateClassification(taxonomy) {
        /**
         * div.classification
         *     div.node
         *         span "Effect"
         *         div.leaf
         *             div.header
         *                 label "Solve new problem"
         *                 input "[x]"
         *             div.additional-data "click to add description +"
         *             div.entity-sample
         *                 input
         *                 div.remove "x"
         */
        var clazz = el('div.classification#classification', taxonomy.tree().map(
            function build(node, i) {
                if (node.isTreeLeaf()) {
                    return el("div.leaf", [
                        el("div.header", {'data-facet-id': node.short}, [
                            el("label", [node.name()]),
                            generate_checkbox()
                        ])
                    ])
                } else {
                    return el("div.node", [
                        el("span", [node.name()]),
                        node.map(build).sort(byNbrOfChildren)
                    ])
                }
            }).sort(byNbrOfChildren))

        var div = document.querySelector('.submit-facets')
        while (div.firstChild)
            div.removeChild(div.lastChild)
        div.appendChild(clazz)
    }

    // show the corresponding input boxes depending on the previously set entry type
    var currentType = $(".circular-checkbox input:checked").val();
    if (currentType === "research") {
        $("#description-area").hide();

    } else if (currentType === "challenge") {
        $("#reference-area").hide();
        $("#doi-area").hide();
    }

    function submitEntry(entry) {
        var id = entry.id

        if (!id)
            return window.api.json("POST", window.api.host + "/v1/entry/new", entry)

        delete entry.id
        return window.api.json("PUT", window.api.host + "/v1/entry/" + id, entry)
    }

    function getClassification() {
        var classification = {}

        $(".header > input:checked").each(function() {
            var parent = this.parentNode
            var facet = parent.dataset.facetId
            var samples = Array.from(parent.
                parentNode.querySelectorAll(".entity-sample input"))
                .map(sample => sample.value)

            if (samples && samples.length > 0)
                classification[facet] = samples
            else
                classification[facet] = ['unspecified']
        });

        return classification;
    }

    function clearPageState() {
        clearInputBoxes();
        clearCheckboxes();
        clearComplaints();
    }

    function clearCheckboxes() {
        // iterate over each checkbox that has been checked
        $(".header > input:checked").each(function() {
            this.checked = false
            classification_checkbox_click.apply(this, [])
        });
    }

    // clear input boxes (but leave collection selection intact for workflow reasons)
    function clearInputBoxes() {
        $("#doi").val("");
        $("#reference").val("");
        $("#description").val("");
    }

    /* User clicked row in queued entries table => edit entry */
    function editQueuedEntry(evt) {
        var row = this

        var table = document.getElementById('queue-table')
        var rows = table.querySelectorAll('tr')
        for (var i = 0; i < rows.length; i++)
            rows[i].classList.remove('in-edit')

        row.classList.add('in-edit')

        var entryNumber = parseInt(row.dataset.entryNumber)
        var entry = queuedEntries[entryNumber]

        /* Maybe warn user if another row was active */
        document.getElementById("submit-btn").dataset.currentEntry = entryNumber
        discardEntryChanges()
        fillAccordingToEntry(entry)
    }

    /* Either add or replace a row in the table: position decides */
    function insertIntoTable(entry, position) {
        var table = document.getElementById('queue-table')
        var classification = entry.serpClassification
        var entryNumber = position != null ? position : queuedEntries.length - 1

        var row = el('tr', {'data-entry-number': entryNumber }, [
            el('td', [
                el('div.scroll-wrapper', [
                        entry.description || entry.reference
                ])
            ]),
            collectionTaxonomy.tree().map(function build(node) {
                if (!node.isTreeLeaf())
                    return node.map(build)
                var classified = classification[node.short] ? '.filled-cell' : ''
                return el('td' + classified)
            })
        ])

        if (position != null) {
            var existing = table.querySelector('tbody').childNodes[position]
            existing.parentNode.replaceChild(row, existing)
        } else {
            table.querySelector('tbody').appendChild(row)
        }

        row.addEventListener('click', editQueuedEntry, false)
    }

    function getEntry() {
        var entry = {
            entryType: $(".circular-checkbox input:checked").val(),
            collection: $("#collection").val(),
            reference: $("#reference").val(),
            description: $("#description").val(),
            doi: $("#doi").val(),
            date: new Date(),
            serpClassification: getClassification(),
            id: currentEntry && currentEntry.id,
            contact: currentEntry && currentEntry.contact
        };
        currentEntry = undefined

        return entry;
    }

    function entryIsValid(entry) {
        if (entry.entryType == "research") {
            return entry.reference.length > 0;
        } else if (entry.entryType == "challenge") {
            return entry.description.length > 0;
        }
        return true;
    }

    function complain(entry) {
        if (entry.entryType == "research") {
            if (researchComplaint==false && entry.reference.length < 1) {
                researchComplaint=true;
                $("#reference-area").append(jqEl("div").addClass("complaint").text("please supply information"));
            }
        } else if (entry.entryType == "challenge") {
            if (challengeComplaint==false && entry.description.length < 1) {
                challengeComplaint=true;
                $("#description-area").append(jqEl("div").addClass("complaint").text("please supply information"));
            }
        }
    }

    //removes all error messages
    function clearComplaints() {
        $(".complaint").remove();
        researchComplaint=false;
        challengeComplaint=false;
    }

    function fillAccordingToEntry(entry, noswap) {
        // fill in the input fields
        var fields = ['reference', 'doi', 'description']
        fields.forEach(key => document.getElementById(key).value = entry[key])

        // toggle the correct radio button
        $("#" + entry["entryType"] + "-button").trigger("click");
        var classification = entry.serpClassification

        // fill in the correct checkboxes
        for (var key in classification) {
            var header = document.querySelector(`[data-facet-id="${key}"]`)

            // The entry contains facets the current taxonomy either has
            // subclassed or doesn't have (yet). Either way we can't proceed.
            if (!header) continue

            var checkbox = header.querySelector('input')
            checkbox.checked = true
            classification_checkbox_click.apply(checkbox, [])

            var leaf = header.parentNode
            var addData = leaf.querySelector('.additional-data')

            var entities = classification[key];
            if (entities[0] === "unspecified")
               continue

            // fill in the additional data that's been specified for the checkboxes
            for (var i = 0; i < entities.length; i++) {
                var row = classification_add_row.apply(addData, [])
                row.querySelector('input').value = entities[i]
            }
        }

        if (!noswap)
            swapButtons();
    }

    function swapButtons() {
        $("#queue-btn").text("cancel");
        $("#submit-btn").text("save");
        $('#load-btn').hide()
        $("#remove-btn").show();
    }

    function restoreButtons() {
        $("#queue-btn").text("queue");
        $("#submit-btn").text("submit");
        $('#load-btn').show()
        $("#remove-btn").hide();
    }

    function saveEntryChanges(entryNumber) {
        var editedEntry = getEntry();
        queuedEntries[entryNumber] = editedEntry;
        insertIntoTable(editedEntry, entryNumber);
    }

    function removeEntry(entryNumber) {
        var table = document.getElementById('queue-table')
        var tbody = table.querySelector('tbody')

        console.log('removing', entryNumber, tbody.childNodes[entryNumber])

        queuedEntries.splice(entryNumber, 1)

        /* Update position references before removing the node itself
           to avoid waiting for DOM update when reading childNodes. */
        for (var i = entryNumber + 1; i < tbody.childElementCount; i++) {
            tbody.childNodes[i].dataset.entryNumber = i - 1
        }

        tbody.removeChild(tbody.childNodes[entryNumber])

        // clear the input boxes
        discardEntryChanges();
    }

      function discardEntryChanges() {
        clearPageState();
        // clear data on submit-btn
        //delete document.getElementById('submit-btn').dataset.currentEntry

        // clear checkbox related stuff
        $('input:checkbox').removeAttr('checked');
        $(".additional-data").remove();
        $(".additional-data-wrapper").remove();

        // clear stuff related to creating a new collection
        $("#submit-create-collection").text("create a new collection");
    }

    /* Wrapper for toggling buttons */
    function disableButton(btn) {
        btn.disabled = true
        btn.classList.add('submit-disabled')
    }
    function enableButton(btn) {
        btn.disabled = false
        btn.classList.remove('submit-disabled')
    }
    function updateUI(enableDisable) {
        getUIElements().forEach(selector => {
            var btn = document.querySelector(selector)
            enableDisable(btn)
        })
    }

    /* Placeholder for something more legit */
    function flashErrorMessage(msg) {
        window.alert(`Error: ${msg}`)
    }

    /**
     * Goes through the queued entries and posts them to backend, disabling
     * the button while submitting to prevent multiple submissions. Will stop
     * when any entry didn't succeed, or when all entries were posted.
     */
    function submitQueue() {
        return new Promise(function startSubmit(resolve, reject) {
            var submitNext = function () {
                if (queuedEntries.length === 0) {
                    resolve()
                    return
                }

                // Post entries in the same order as the table
                var entry = queuedEntries[0]

                submitEntry(entry).fail(reject)
                .done(() => {
                    // Only remove entries if they are successfully added - improves workflow
                    removeEntry(0)
                    setTimeout(submitNext, 0)
                })
            }

            submitNext()
        })
    }

    $("#submit-queue-btn").on("click", function(evt) {
        updateUI(disableButton)

        submitQueue().catch(xhr => {
            flashErrorMessage(xhr.responseText)
        }).then(() => {
            updateUI(enableButton)
        })
    });

    var newCollectionModal = {
        desc: "create new collection",
        message: "",
        input: [['input0','text','collection name']],
        btnText: "Create"
    };

    $("#submit-create-collection").on("click", function(evt) {
        var colId = window.components.createCollectionModal().then(col => {
            updateCollectionList()
        })
    });

    $("#submit-btn").on("click", function(evt) {
        var isSubmitBtn = this.textContent === "submit"
        if (isSubmitBtn) {
            var entry = getEntry()

            if (!entryIsValid(entry)) {
                complain(entry)
                return
            }

            updateUI(disableButton)
            submitEntry(entry).done(ok => clearPageState())
                .fail(xhr => {
                    flashErrorMessage(xhr.responseText)
                }).always(() => {
                    updateUI(enableButton)
                })
        // acts as save button
        } else {
            var entryNumber = parseInt(this.dataset.currentEntry)
            saveEntryChanges(entryNumber);
            clearPageState();
            restoreButtons();
            discardEntryChanges();
        }
    });

    $("#load-btn").on("click", function(evt) {
        if(loggedIn){
          window.api.v1.account.self().done(user => {
              var conf = {
                  desc: "Load an entry",
                  input: user.entries
              };
              window.modals.listModal(conf, function (entryId) {
                  api.v1.entry.get(entryId).done(entry => {
                        $("#" + entry.type + "-button").trigger("click");
                        api.v1.getTaxonomyEntry(entryId).done(taxonomy =>{
                          entry["serpClassification"] = taxonomy;
                          fillAccordingToEntry(entry, true);
                        })

                  }) // Only error if race condition?
              })
          }).fail(xhr => {
            flashErrorMessage(xhr.responseText);
          })
        } else {
          flashErrorMessage("Must be logged in");
        }
    });

    $("#queue-btn").on("click", function(evt) {
        var $thisEl = $(this);
        clearComplaints();
        // used as the queue button
        if ($thisEl.text() === "queue") {
            pushEntry(getEntry());
        // used as the cancel button
        } else {
            $("tr").removeClass("in-edit");
            restoreButtons();
            discardEntryChanges();
        }
    });

    function pushEntry(entry){
        if (entryIsValid(entry)) {
          clearPageState();
          queuedEntries.push(entry);
          insertIntoTable(entry);
          discardEntryChanges();
        } else {
            complain(entry);
        }
    }

    $("#remove-btn").on("click", function(evt) {
        // data's stored in the submit button
        var entryNumber = parseInt(document.getElementById('submit-btn').dataset.currentEntry)
        removeEntry(entryNumber);
        restoreButtons();
    });

    $("#toggle-queue").on("click", function(evt) {
        $("#queue-table").toggle();

        if ($("#toggle-queue").text().indexOf("hide") > -1) {
            $("#toggle-queue").text("show table");
            $("#toggle-chevron").removeClass("hide-chevron");
            $("#toggle-chevron").addClass("show-chevron");
        } else {
            $("#toggle-queue").text("hide table");
            $("#toggle-chevron").removeClass("show-chevron");
            $("#toggle-chevron").addClass("hide-chevron");
        }
    });

    // an entry type was chosen
    $(".circular-checkbox input").on("change", function(evt) {
        $("#reference-area").slideToggle();
        $("#description-area").slideToggle();
        $("#doi-area").slideToggle();
        clearComplaints();
    });

    /* This will rebuild the overview table based on the given taxonomy */
    function generateOverviewTable(taxonomy) {
        var div = document.getElementById('queue-table')
        while (div.firstChild)
            div.removeChild(div.lastChild)

        var thead = el('thead', [
            el('tr', [
                el('th'),
                taxonomy.tree().map(function build(node, i) {
                    if (!node.isTreeLeaf())
                        return node.map(build)
                    return el('th', [node.long])
                })
            ])
        ])

        div.appendChild(thead)
        div.appendChild(el('tbody'))
    }

    /**
     *  If id is undefined, only display the serp taxonomy.
     *  If the collection taxonomy fails to load, only display the serp taxonomy.
     *  If both taxonomies load, then extend the serp taxonomy and show it.
     **/
    function selectCollection(id) {
        if (id) {
            $("#collection").val(id)
        }

        return api.v1.taxonomy()
        .then(root => {
            collectionTaxonomy = new Taxonomy(root.taxonomy)
            return id ? api.v1.collection.taxonomy(id) : undefined
        }).then(collData => {
            if (collData)
                collectionTaxonomy.extend(collData.taxonomy)
            return collectionTaxonomy
        }).catch(err => {
            return collectionTaxonomy
        }).then(taxonomy => {
            generateClassification(taxonomy)
            generateOverviewTable(taxonomy)
        }).then(() => {
            if (currentEntry)
                fillAccordingToEntry(currentEntry, true)
        }).then(() => reloadAutocomplete(id))
    }

    document.getElementById("collection").addEventListener('change', function (evt) {
        selectCollection(this.value)
    }, false)

    // more efficient way of creating elements than purely using jquery;
    // basically an alias for document.createElement - returns a jquery element
    function jqEl(elementType) {
        return $(document.createElement(elementType));
    }

});
