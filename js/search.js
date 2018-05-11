$(document).ready(function () {
    $("#search").addClass("current-view");
    // clear all checkboxes upon refreshing the page
    $('input:checkbox').removeAttr('checked');
    $("#sort-dropdown").val("collections");
    $("#collection-dropdown").val("all");
    // stores all the queued entries
    var dataset = [];
    var activeTaxonomy = undefined
    var taxonomyCache = {}
    var selectedEntries = []
    var loggedIn = false
    var admin = false;
    var serpTaxonomy = undefined

    var currentClassification = {}

    function getCollectionFromPreviousPage() {
        var type = window.location.hash
        return type ? type.substring(1) : null
    }

    function getCollectionID() {
        return document.getElementById('collection-dropdown').value
    }

    function buildTaxonomyNodeCache(taxonomy) {
        taxonomyCache = {
            id2node: {},
            leaves: []
        }

        taxonomy.root.map(function cache(node) {
            taxonomyCache.id2node[node.id()] = node
            if (node.isTreeLeaf())
                taxonomyCache.leaves.push(node)
            node.map(cache)
        })
    }

    // When clicking on a table header in the inspection view, bring up all
    // entities (classified examples) and present them in a modal.
    $('th').click(evt => {
        if (!evt.target.classList.contains('clickable'))
            return
        var facet = evt.target.dataset.facet
        var entries = dataset.filter(entry => fitsCurrentClassification(entry))

        var done = function () {
            var remaining = entries.filter(entry => entry.taxonomy === undefined).length
            if (remaining !== 0) return

            var entities = entries.map(entry => entry.taxonomy[facet.toUpperCase()])

            var unique = []
            for (var i = entities.length - 1; i >= 0; i--) {
                var entity = entities[i]
                if (!entity) continue
                for (var j = entity.length - 1; j >= 0; j--) {
                    if (unique.indexOf(entity[j]) === -1)
                        unique.push(entity[j])
                }
            }
            var CID = getCollectionID()

            if (isNaN(CID)) {
                //get unique facets + entries
                window.modals.infoModal(facet, unique)
                return
            }

            api.v1.collection.isOwner(CID)
                .done(owner => {
                    if (owner)
                        showTaxonomyModal()
                    else
                        window.modals.infoModal(facet, unique)
                })

            function showTaxonomyModal() {
                Promise.all([
                    api.v1.collection.entities(CID),
                    api.v1.collection.taxonomy(CID),
                    api.v1.collection.classification(CID),
                ]).then(promise => {
                    var entities = promise[0]
                    var dynamicTaxonomy = promise[1]

                    var Facets = []
                    var dyn = JSON.parse(JSON.stringify(dynamicTaxonomy.taxonomy))
                    Facets.push(facet)
                    while (dyn.length != 0) {
                        var x = dyn.shift()
                        if (x.parent.toLowerCase() === facet.toLowerCase())
                            Facets.push(x.id)
                    }
                    var newClass = []

                    Facets.forEach(function (current) {
                        var classif = JSON.parse(JSON.stringify(promise[2]))
                        while (classif.length != 0) {
                            var x = classif.shift()
                            if (x.facetId === current.toUpperCase()) {
                                newClass.push(x)
                            }
                        }

                    })
                    //
                    if (newClass.length != 0 && newClass[0].facetId != facet.toUpperCase()) {
                        newClass.unshift({ facetId: facet, text: [] });
                    }
                    window.components.extendTaxonomyModal(facet, newClass, dynamicTaxonomy, entities, CID, serpTaxonomy)
                }).catch(console.error)
            }
        }


        var update = function (entry) {
            api.v1.entry.taxonomy(entry.id)
                .then(taxonomy => {
                    entry.taxonomy = taxonomy
                    done()
                })
        }

        for (var i = dataset.length - 1; i >= 0; i--) {
            var entry = dataset[i]

            if (entry.taxonomy && i === 0) {
                done()
            } else if (!entry.taxonomy) {
                update(entry)
            }
        }
    })

    // everything
    var mainDataset
    // entries partitioned/collection
    var collections = {}
    function processGraph(graph, collectionName, extendedTaxonomy) {
        var nodes = []
        var nodemap = {}

        graph.nodes.forEach(node => {
            node.serpClassification = {}
            node.entryType = node.type
            node.date = new Date(node.date);
            delete node.type
            if (collectionName)
                node.collection = collectionName

            nodes.push(node)
            nodemap[String(node.id)] = nodes.length - 1
        })

        // mark this facet as used, use /entry/{id}/taxonomy to get full tree
        graph.edges.forEach(edge => {
            var facet = edge.type
            var node = nodes[nodemap[String(edge.source)]]

            node.serpClassification[edge.type] = true
        })

        return nodes
    }
    function getCollection(id, cb) {
        var cc = collections[id]
        if (cc && cc.entries && cc.taxonomy) {
            cb(cc.entries, cc.taxonomy)
            return
        }

        Promise.all([
            api.v1.collection.graph(id),
            api.v1.collection.taxonomy(id)
        ])
            .then(promise => {
                var graph = promise[0]
                var taxonomy = promise[1].taxonomy

                var cc = collections[id]
                cc.entries = processGraph(graph, collections[id].name, taxonomy)
                cc.taxonomy = new Taxonomy()
                cc.taxonomy.root = serpTaxonomy.tree()
                cc.taxonomy.extend(taxonomy)

                cb(cc.entries, cc.taxonomy)
            })
            .catch(reason => {
                cb([], new Taxonomy())
                console.error(reason)
            })
    }
    function updateDataset(toset, taxonomy) {
        dataset = toset
        activeTaxonomy = taxonomy
        buildTaxonomyNodeCache(activeTaxonomy)
        updateViews()
    }
    function updateViews() {
        updateTableHeader(activeTaxonomy)
        updateFilterList(activeTaxonomy)
        updateLists(dataset, activeTaxonomy)
    }
    function selectDataset(value) {
        if (value === "all") {
            // set dataset = all
            if (mainDataset) {
                updateDataset(mainDataset, serpTaxonomy)
                return
            }

            api.v1.entry.all()
                .done(graph => {
                    mainDataset = processGraph(graph)
                    updateDataset(mainDataset, serpTaxonomy)
                })
                .fail((reason, err) => window.alert(err))
        } else if (value === "mine") {
            // get all collections user is part of
            updateDataset([])
            Object.keys(collections).forEach(id => {
                getCollection(id, entries => {
                    for (var i = 0; i < entries.length; i++) {
                        var exists = false
                        for (var j = 0; j < dataset.length; j++) {
                            if (dataset[j].id === entries[i].id) {
                                exists = true
                                break
                            }
                        }
                        if (!exists)
                            dataset.push(entries[i])
                    }
                    updateDataset(dataset, serpTaxonomy)
                })
            })
        } else {
            // use specific collection
            getCollection(value, updateDataset)
        }
    }

    function selectAllEntries() {
        //  var length = $('.table-view-area tr').length-1;
        for (var i = 0; i < dataset.length; i++) {
            var entry = dataset[i];
            if (selectedEntries.indexOf(entry.id) === -1) {
                selectedEntries.push(entry.id);
            }
        }
        $('.table-view-area tr').find('input[type=checkbox]').prop('checked', true);
    }

    function exportEntries() {
        if (!selectedEntries.length) {
            return
        }

        window.modals.exportModal(selectedEntries, collections)
        selectedEntries = []
        $('input[type=checkbox]').prop('checked', false)
    }

    // Append a select element if logged in so user can export to new/existing
    // collection/
    window.api.v1.account.self().done(self => {
        var view = document.querySelector('.table-view-area')

        var exportBtn = el('button.edit-btn', ['export'])
        exportBtn.addEventListener('click', exportEntries, false)
        view.appendChild(exportBtn)

        var selectAllBtn = el('button.edit-btn', ['select all'])
        selectAllBtn.addEventListener('click', selectAllEntries, false)
        view.appendChild(selectAllBtn)

        loggedIn = true
        admin = self.trust === "Admin";

        /* Regen everything to make sure user can export */
        if (activeTaxonomy)
            updateViews()
    })

    api.v1.taxonomy().then(data => {
        serpTaxonomy = new Taxonomy(data.taxonomy)
        return window.api.v1.account.collections()
    }).then(collz => {
        var selector = document.getElementById('collection-dropdown')
        var requested = getCollectionFromPreviousPage()

        var mine = document.createElement('option')
        mine.setAttribute('value', "mine")
        mine.text = "show mine"

        selector.appendChild(mine)
        if (!requested || requested === 'all')
            selector.value = "all"

        collz.forEach(coll => {
            var opt = document.createElement('option')
            opt.setAttribute('value', coll.id)
            opt.text = coll.name

            collections[coll.id] = coll

            selector.appendChild(opt)
            if (requested === String(coll.id))
                selector.value = coll.id
        })
    }).always(() => {
        var selector = document.getElementById('collection-dropdown')
        var requested = getCollectionFromPreviousPage()

        if (requested && selector.value !== requested
            && requested !== 'all' && requested !== 'mine') {
            collections[requested] = { id: requested }
            var opt = document.createElement('option')
            opt.setAttribute('value', requested)
            opt.text = '#' + requested
            selector.appendChild(opt)

            selector.value = requested
        }

        selectDataset(selector.value)
    })



    $("#collection-dropdown").change(function (evt) {
        selectDataset(this.value)
        window.location.hash = this.value
    })

    function handleFilterEvent(evt) {
        var subfacet = this.name
        currentClassification[subfacet] = !currentClassification[subfacet];
        updateLists(dataset, activeTaxonomy);
    }
    function createCheckboxElement(node) {
        var div = el('input', { 'type': 'checkbox', 'name': node.id() })
        div.addEventListener('change', handleFilterEvent, false)
        return div
    }
    function updateFilterList(taxonomy) {
        var div = document.querySelector('div.facets > div.filters')
        while (div.lastChild)
            div.removeChild(div.lastChild)

        var facets = taxonomy.root.map(function build(node, i) {
            if (!node.isTreeLeaf()) {
                return el('div.facet-title', [
                    node.name(),
                    el('label.checkbox', [
                        el('input', { 'type':'checkbox', name:node.id() }),
                        el('span', [' '])
                    ]),
                    node.map(build)
                ])
            }

            var title = taxonomyCache.id2node[node.id()].desc ||
                window.info.getInfo(node.id().toLowerCase()).description

            return el('label.sub-facet', {
                'title': title,
                'for': 'checkbox'
            }, [
                node.name(),
                el('label.checkbox', [
                    createCheckboxElement(node),
                    el('span', [' '])
                ])
            ])
        })

        for (var i = 0; i < facets.length; i++)
            div.appendChild(facets[i])
    }

    /* This will rebuild the overview table based on the given taxonomy */
    function updateTableHeader(taxonomy) {
        var div = document.getElementById('table-view')
        while (div.lastChild)
            div.removeChild(div.lastChild)

        var thead = el('thead', [
            el('tr', [
                el('th', ['entries']),
                taxonomyCache.leaves.map(node => {
                    return el('th.clickable', {
                        'data-facet': node.id(),
                        'title': `inspect ${node.name()}`
                    }, [node.name()])
                }),
                loggedIn && el('th', ['export'])
            ])
        ])

        div.appendChild(thead)
        div.appendChild(el('tbody'))
    }

    function updateLists(dataset, taxonomy) {
        clearViews();

        var overview = document.querySelector(".overview-area")
        var table = document.getElementById('table-view')

        var currentEntries = 0;
        for (var i = 0; i < dataset.length; i++) {
            var entry = dataset[i];
            if (fitsCurrentClassification(entry)) {
                currentEntries++;
                insertIntoTable(table, entry, i);
                insertIntoOverview(overview, entry, i);
            }
        }
        updateResultsText(currentEntries, dataset.length);
    }

    function updateResultsText(currentAmount, totalAmount) {
        $("#search-results-text").text("showing " + currentAmount + "/" + totalAmount + " entries");
    }

    function filterIsDefined() {
        return Object.keys(currentClassification).length > 0;
    }

    function fitsCurrentClassification(entry) {
        // Algorithm:
        //  for each selected facet filter
        //      find facet node in taxonomy (using id->node memo cache)
        //      check if any entry classification exists in its sub tree
        //      if not: entry does not have filtering facet, return false
        //      if yes: entry is classified with this facet, continue
        //  return true
        //
        var filterFacets = Object.keys(currentClassification)
        for (var i = 0; i < filterFacets.length; i++) {
            var subfacet = filterFacets[i]
            if (currentClassification[subfacet]) {
                var facetNode = taxonomyCache.id2node[subfacet] //activeTaxonomy.root.dfs(subfacet)
                /* no entry uses this node? */
                if (!facetNode) return false

                var entryFacets = Object.keys(entry.serpClassification)
                var found = false
                for (var j = 0; j < entryFacets.length; j++) {
                    if (facetNode.dfs(entryFacets[j])) {
                        found = true
                        break
                    }
                }
                if (!found)
                    return false
            }
        }
        return true;
    }

    function toggleTabs() {
        $(".view-area").toggleClass("overview-bg");
        $(".table-view-area").toggleClass("hidden");
        $(".overview-area").toggleClass("hidden");
        $("#overview-tab").toggleClass("active-tab").toggleClass("unactive-tab");
        $("#table-view-tab").toggleClass("active-tab").toggleClass("unactive-tab");
    }

    $(".view-area-tab").on("click", function (evt) {
        if ($(this).hasClass("unactive-tab")) {
            toggleTabs();
        }
    });

    $("#sort-dropdown").on("change", function (evt) {
        var sortingOption = $(this).val();
        if (sortingOption == "newest") {
            dataset.sort(newestComparator);
        } else if (sortingOption == "oldest") {
            dataset.sort(oldestComparator);
        } else if (sortingOption == "collections") {
            dataset.sort(alphabeticalComparator);
        }
        updateLists(dataset, activeTaxonomy);
    });

    function clearViews() {
        var overview = document.querySelector('.overview-area')
        while (overview.lastChild)
            overview.removeChild(overview.lastChild)

        var table = document.getElementById('table-view')
        table.removeChild(table.querySelector('tbody'))
        table.appendChild(el('tbody'))
    }

    function createOverviewTags(entry) {
        var facets = Object.keys(entry.serpClassification)

        return facets.map(facet => {
            var node = taxonomyCache.id2node[facet] // activeTaxonomy.root.dfs(facet)
            return node && el('div.entry-tag', [
                currentClassification[node.id()] ?
                    el('strong', [node.name()]) : node.name()
            ])
        })
    }

    function insertIntoOverview(overview, entry, entryNumber) {
        var entryTitleText = entry["description"] || entry["reference"] || entry["doi"];

        // created the individual html elements
        var div = el('div.overview-entry', [
            el('div.entry-type', [entry.entryType]),
            el('div.entry-title', {
                'data-entry-number': entryNumber
            }, [
                entryTitleText
            ]),
            el('div.entry-tags', createOverviewTags(entry))
        ])

        div.querySelector('.entry-title')
            .addEventListener("click", handleEntryClickEvent, false)

        // insert into the DOM
        overview.appendChild(div);
    }

    function inspectEntry(entryNumber, entryId, collectionId) {
        function deleteEntry() {
            toggleButtonState()
            api.v1.admin.deleteEntry(entryId)
                .done(() => {
                    window.modals.clearAll();
                    dataset.splice(entryNumber, 1);
                    updateLists(dataset, activeTaxonomy);
                })
                .fail(xhr => alert(xhr.responseText))
        }

        var removeBtn = el("button.btn", ["delete entry"])
        removeBtn.addEventListener('click', deleteEntry, false)

        Promise.all([
            window.api.v1.entry.get(entryId),
            window.api.v1.entry.taxonomy(entryId)
        ]).then(promise => {
            window.modals.entryModal(collectionId, promise[0], promise[1],
                admin ? { button: removeBtn } : {}
            )
        })
    }

    function handleEntryClickEvent(evt) {
        var entryNumber = parseInt(this.dataset.entryNumber)
        var entryId = dataset[entryNumber].id
        var collectionId = getCollectionID()
        inspectEntry(entryNumber, entryId, collectionId)
    }

    function handleExportCheckbox (evt) {
        var entryId = this.value
        if (this.checked) {
            if (selectedEntries.indexOf(entryId) === -1)
                selectedEntries.push(entryId)
        } else {
            selectedEntries.splice(selectedEntries.indexOf(entryId), 1)
        }
    }
    function createExportCheckbox(entry) {
        var exportCheckbox = el('input', {
            'type':'checkbox',
            'value':entry.id
        })

        if (selectedEntries.indexOf(entry.id) >= 0)
            exportCheckbox.setAttribute('checked', 'checked')

        exportCheckbox.addEventListener('change', handleExportCheckbox, false)
    }
    function insertIntoTable(table, entry, entryNumber) {
        var classification = entry.serpClassification

        var row = el('tr', [
            el('td', {'data-entry-number': entryNumber }, [
                el('div.scroll-wrapper', [
                        entry.description || entry.reference
                ])
            ]),
            taxonomyCache.leaves.map(node => {
                var classified = classification[node.id()] ? '.filled-cell' : ''
                return el('td' + classified)
            }),
            loggedIn && createExportCheckbox(entry)
        ])

        row.firstChild
            .addEventListener('click', handleEntryClickEvent, false)
        table.querySelector('tbody').appendChild(row)
    }
});



// Switch all buttons between disabled and enabled state
function toggleButtonState() {
    var btns = document.querySelectorAll('.btn')
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('submit-disabled')
        if (btns[i].getAttribute('disabled'))
            btns[i].removeAttribute('disabled')
        else
            btns[i].setAttribute('disabled', true)

    }
}

function newestComparator(a, b) {
    return b.date - a.date;
}

function oldestComparator(a, b) {
    return a.date - b.date;
}

function alphabeticalComparator(a, b) {
    return a.collection.localeCompare(b.collection);
}

// more efficient way of creating elements than purely using jquery;
// basically an alias for document.createElement - returns a jquery element
function Element(elementType) {
    return $(document.createElement(elementType));
}
