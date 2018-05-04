$(document).ready(function () {
    $("#search").addClass("current-view");
    // clear all checkboxes upon refreshing the page
    $('input:checkbox').removeAttr('checked');
    $("#sort-dropdown").val("collections");
    $("#collection-dropdown").val("all");
    // stores all the queued entries
    var dataset = [];
    var selectedEntries = []
    var loggedIn = false
    var admin = false;
    var serpTaxonomy = undefined

    var currentClassification = {
        adapting: false,
        solving: false,
        assessing: false,
        improving: false,
        planning: false,
        design: false,
        execution: false,
        analysis: false,
        people: false,
        information: false,
        sut: false,
        other: false
    }

    function getCollectionFromPreviousPage() {
        var type = window.location.hash
        return type ? type.substring(1) : null
    }

    function getCollectionID() {
        return document.getElementById('collection-dropdown').value
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

        // Map extended facet onto parent in serp taxonomy
        var ext2serp = {}
        if (extendedTaxonomy) {
            while (extendedTaxonomy.length) {
                var facet = extendedTaxonomy.shift()

                if (ext2serp[facet.parent]) {
                    ext2serp[facet.id] = ext2serp[facet.parent]
                    continue
                }

                var parent = serpTaxonomy.root.dfs(facet.parent)
                if (parent) {
                    ext2serp[facet.id] = parent.id()
                    continue
                }

                extendedTaxonomy.push(facet)
            }
        }

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

            if (ext2serp[facet]) {
                var parent = ext2serp[facet]
                node.serpClassification[parent.toLowerCase()] = true
            }

            node.serpClassification[edge.type.toLowerCase()] = true
        })

        return nodes
    }
    function getCollection(id, cb) {
        if (collections[id].entries) {
            cb(collections[id].entries)
            return
        }

        Promise.all([
            api.v1.collection.graph(id),
            api.v1.collection.taxonomy(id)
        ])
            .then(promise => {
                var graph = promise[0]
                var taxonomy = promise[1].taxonomy

                collections[id].entries = processGraph(graph, collections[id].name, taxonomy)
                collections[id].taxonomy = taxonomy

                cb(collections[id].entries)
            })
            .catch(reason => cb([]))
    }
    function updateDataset(toset) {
        dataset = toset
        updateViews()
    }
    function selectDataset(value) {
        if (value === "all") {
            // set dataset = all
            if (mainDataset) {
                updateDataset(mainDataset)
                return
            }

            api.v1.entry.all()
                .done(graph => {
                    mainDataset = processGraph(graph)
                    updateDataset(mainDataset)
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
                    updateDataset(dataset)
                })
            })
        } else {
            // use specific collection
            getCollection(value, entries => updateDataset(entries))
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
        $('tr').append(Element('th').text("export"))

        $('.table-view-area')
            .append(Element('button').addClass('edit-btn').text('export').click(exportEntries))
            .append(Element('button').addClass('edit-btn').text('select all').click(selectAllEntries))

        loggedIn = true
        admin = self.trust === "Admin";
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

    // classification took place
    $(".checkbox input").on("change", function (event) {
        var subfacet = $(this).attr("name");
        currentClassification[subfacet] = !currentClassification[subfacet];
        updateViews(dataset);
    });

    function updateViews(entries) {
        clearViews();
        var currentEntries = 0;
        for (var i = 0; i < dataset.length; i++) {
            var entry = dataset[i];
            if (fitsCurrentClassification(entry)) {
                currentEntries++;
                insertIntoTable(entry);
                insertIntoOverview(entry);
            }
        }
        updateResultsText(currentEntries, dataset.length);
    }

    function updateResultsText(currentAmount, totalAmount) {
        $("#search-results-text").text("showing " + currentAmount + "/" + totalAmount + " entries");
    }

    function filterIsDefined() {
        for (var subfacet in currentClassification) {
            if (currentClassification[subfacet]) {
                return true;
            }
        }
        return false;
    }

    function fitsCurrentClassification(entry) {
        // check if classification exists and then if entry isn't classified,
        // if that's the case: throw it from the list
        for (var subfacet in currentClassification) {
            if (currentClassification[subfacet] && !entry.serpClassification[subfacet]) {
                return false;
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
        updateViews(dataset);
    });

    function getClassification() {
        var classification = {
            "intevention": null,
            "adapting": null,
            "solving": null,
            "assessing": null,
            "improving": null,
            "planning": null,
            "design": null,
            "execution": null,
            "analysis": null,
            "people": null,
            "information": null,
            "sut": null,
            "other": null
        };

        // iterate over each checkbox that has been checked
        $(".checkbox input:checked").each(function () {
            var subfacet = $(this).attr("name");
            classification[subfacet] = [];
            var $parent = $(this).closest(".sub-facet");
        });
        return classification;
    }

    function clearViews() {
        $(".overview-area").children().empty();
        $(".overview-entry").remove();
        $("#table-body").children().empty();
    }

    function createOverviewTags(entry) {
        var $entryTags = Element("div").addClass("entry-tags");

        if (filterIsDefined()) {
            for (var subfacet in currentClassification) {
                if (!currentClassification[subfacet] && entry.serpClassification[subfacet]) {
                    var $tag = Element("div").addClass("entry-tag").text(subfacet);
                    $entryTags.append($tag);
                }
            }
        } else {
            for (var subfacet in entry.serpClassification) {
                if (entry.serpClassification[subfacet]) {
                    var $tag = Element("div").addClass("entry-tag").text(subfacet);
                    $entryTags.append($tag);
                }
            }
        }
        return $entryTags;
    }

    function insertIntoOverview(entry) {
        var classification = entry["serpClassification"];

        // created the individual html elements
        var $overviewEntry = Element("div").addClass("overview-entry");
        var $entryType = Element("div").addClass("entry-type").text(entry["entryType"]);


        var entryTitleText = entry["description"] || entry["reference"] || entry["doi"];
        var $entryTitle = Element("div").addClass("entry-title").text(entryTitleText);
        $entryTitle.data("entry-number", dataset.indexOf(entry));

        var $entryTags = createOverviewTags(entry);

        // append them to the parent element
        $overviewEntry.append($entryType);
        $overviewEntry.append($entryTitle);
        $overviewEntry.append($entryTags);
        // insert into the DOM
        $(".overview-area").append($overviewEntry);




        $(".entry-title").unbind("click").on("click", function (evt) {
            var entryNumber = $(this).data("entry-number");
            var id = dataset[entryNumber].id
            var CID = getCollectionID()
            function deleteEntry() {
                toggleButtonState()
                api.v1.admin.deleteEntry(id)
                    .done(() => {
                        window.modals.clearAll();
                        dataset.splice(entryNumber, 1);
                        updateViews();
                    })
                    .fail(xhr => alert(xhr.responseText))

            }

            var removeBtn = el("button.btn", ["delete entry"])
            removeBtn.addEventListener('click', deleteEntry, false)

            function insertid(id) { return 0 }


            Promise.all([
                window.api.v1.entry.get(id),
                window.api.v1.entry.taxonomy(id)
            ]).then(promise => {
                window.modals.entryModal(CID, promise[0], promise[1],
                    admin ? { button: removeBtn } : {}
                )
            })
        })
    }

    // creates a table row with the data contained in entry
    function insertIntoTable(entry, position) {
        var classification = entry["serpClassification"];

        // let's build the table row for this entry
        var $row = Element("tr");
        var maxLength = 35;
        // choose as the row descriptor either the project name, description
        // (for challenges), or the reference (for research results)
        var entryTitle = entry["projectName"] || entry["description"] || entry["reference"];
        entryTitle = entryTitle.length > maxLength ?
            entryTitle.substring(0, maxLength - 3) + "..." :
            entryTitle.substring(0, maxLength);
        var titleCell = Element("td").text(entryTitle || entry["description"] || entry["reference"]);
        titleCell.data("entry-number", dataset.indexOf(entry));

        $row.append(titleCell);

        createCell("intervention", true);

        // effect
        createCell("solving");
        createCell("adapting");
        createCell("assessing");
        createCell("improving");

        // scope
        createCell("planning", true);
        createCell("design", true);
        createCell("execution", true);
        createCell("analysis", true);

        // context
        createCell("people");
        createCell("information");
        createCell("sut");
        createCell("other");

        if (loggedIn) {
            var mark = Element("input").attr("type", "checkbox").val(entry.id)

            if (selectedEntries.indexOf(entry.id) >= 0)
                mark.attr('checked', 'checked')

            mark.on('change', function (evt) {
                if (this.checked) {
                    if (selectedEntries.indexOf(entry.id) === -1)
                        selectedEntries.push(entry.id)
                } else {
                    selectedEntries.splice(selectedEntries.indexOf(entry.id), 1)
                }
            })

            $row.append(mark)
        }

        // insert the row into the specified position
        if (position) {
            $("#table-view tbody tr:nth-child(" + position + ")").replaceWith($row);
        } else {
            // append row to the end of the table
            $("#table-body").append($row);
        }



        // refresh on-click listeners for all entries in first column;
        // (a click initiates an entry inspection)
        $("td:first-child").unbind("click").on("click", function (evt) {
            var entryNumber = $(this).data("entry-number");
            var id = dataset[entryNumber].id
            var CID = getCollectionID()
            function deleteEntry() {
                toggleButtonState()
                api.v1.admin.deleteEntry(id)
                    .done(() => {
                        window.modals.clearAll();
                        dataset.splice(entryNumber, 1);
                        updateViews();
                    })
                    .fail(xhr => alert(xhr.responseText))

            }

            var removeBtn = el("button.btn", ["delete entry"])
            removeBtn.addEventListener('click', deleteEntry, false)

            Promise.all([
                window.api.v1.entry.get(id),
                window.api.v1.entry.taxonomy(id)
            ]).then(promise => {
                window.modals.entryModal(CID, promise[0], promise[1],
                    admin ? { button: removeBtn } : {}
                )
            })
        })

        function createCell(subfacet, alternating) {
            var $td = Element("td");
            classification[subfacet] ? $td.addClass("filled-cell") : "";
            alternating ? $td.addClass("alternating-group") : "";
            $row.append($td);
        }
    }



    // convenience function for capitalizing sentences
    // TODO: rip performance (don't extend prototype, use function instead)
    String.prototype.capitalize = function () {
        return this.charAt(0).toUpperCase() + this.slice(1);
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
