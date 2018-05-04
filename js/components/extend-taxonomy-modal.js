(function (G) {

    /* facet, newClass, subFac, dynEntries, CID, serpTaxonomy */
    G.extendTaxonomyModal = function(facet, referenceEntityClassificiation, taxonomyExtension, allEntities, CID, serpTaxonomy) {
        var FACET = facet.toUpperCase()

        var id2Text = {}
        var text2Id = {}
        allEntities.forEach(entity => {
            id2Text[entity.id] = entity.text
            text2Id[entity.text] = entity.id
        })
        
        var extendedTaxonomy = new Taxonomy()
        extendedTaxonomy.tree(serpTaxonomy.tree())
        extendedTaxonomy.extend(taxonomyExtension.taxonomy)

        var subtree = extendedTaxonomy.tree().dfs(facet)

        /* do some init work to ensure that all taxonomy facets are present,
         * even though they may not be used to classify anything */
        var entityClassificiation = {}
        var referenceClassification = {}

        referenceEntityClassificiation.forEach(clazz => {
            entityClassificiation[clazz.facetId] = clazz.text.map(text => text2Id[text])
            referenceClassification[clazz.facetId] = clazz.text.map(text => text2Id[text])
        })
        if (!entityClassificiation[FACET]) {
            entityClassificiation[FACET] = []
            referenceClassification[FACET] = []
        }
        subtree.map(function initClazzes(node) {
            if (!entityClassificiation[node.id()]) {
                entityClassificiation[node.id()] = []
                referenceClassification[node.id()] = []
            }

            node.map(initClazzes)
        })

        /* keep track of reclassifications as they happen instead of 
         * computing them on save */
        var reclassification = [
            /* { oldFacet : string, newFacet: string, entity: id } */
        ]

        function moveEntry(oldFacet, newFacet, entityId) {
            /* remove from existing reclassification */
            for (var i = 0; i < reclassification.length; i++) {
                var reclazz = reclassification[i]
                if (reclazz.newFacet === oldFacet && reclazz.entity === entityId) {
                    /* if have moved this entity, retarget the transition but
                     * remove it since we don't know if entity will be moved 
                     * such that it's equivalent to the reference classification
                     */
                    oldFacet = reclazz.oldFacet
                    reclassification.splice(i, 1)
                    break
                }
            }

            var isReferenceClassification = referenceClassification[newFacet] && 
                referenceClassification[newFacet].indexOf(entityId) >= 0
            
            if (!isReferenceClassification)
                reclassification.push({ oldFacet: oldFacet, newFacet: newFacet, entity: entityId })

            var entityRow = document.getElementById(`entity-${entityId}`)
            var facetDiv = document.getElementById(`subfacet-${newFacet}`)
            var entityContainer = facetDiv.querySelector('.entity-container')

            var oldClazz = entityClassificiation[oldFacet]
            oldClazz.splice(oldClazz.indexOf(entityId), 1)
            entityClassificiation[newFacet].push(entityId)
            
            entityContainer.appendChild(entityRow)
        }
    
        function entityDropdown(id, subtree, facet) {
            var dropdown = el('select.dropDowns', [
                el('option', { value: subtree.id() }, [subtree.name()]),
                subtree.map(function build(node) {
                    return [
                        el('option', { value: node.id() }, [node.name()]),
                        node.map(build)
                    ]
                })
            ])
            dropdown.value = facet.id()
    
            dropdown.addEventListener('change', function (evt) {
                var oldFacet = this.parentNode.parentNode.parentNode.dataset.facet
                var newFacet = this.value
                var entityId = this.parentNode.dataset.entity
                
                moveEntry(oldFacet, newFacet, parseInt(entityId))
            }, false)
            return dropdown
        }

        function addSubfacet(evt) {
            var facetId = this.parentNode.parentNode.dataset.facet
            var facetNode = subtree.dfs(facetId)

            modals.addTextBox(function (newid, newname) {
                newid = newid.toUpperCase()
                var idExists = subtree.id() === newid || !!subtree.dfs(newid)
                if (idExists) {
                    var existing = this.querySelector('div.complaint')
                    if (existing)
                        existing.parentNode.removeChild(existing)

                    document.getElementById("confirm").parentNode.appendChild(
                        el("div.complaint", ["That name already exists"])
                    )
                    return
                }

                entityClassificiation[newid] = []

                facetNode.addChild(new FacetNode(newid, newname, [],  facetNode.id()))
                document.body.removeChild(this)

                rebuild()
            })
        }

        function removeSubfacet(evt) {
            var facetId = this.parentNode.parentNode.dataset.facet
            var facetNode = subtree.dfs(facetId)
            var parentNode = subtree.dfs(facetNode.parentId()) || subtree

            for (var i = 0; i < parentNode.tree.length; i++) {
                if (parentNode.tree[i].id() === facetNode.id()) {
                    parentNode.tree.splice(i, 1)
                    break
                }
            }

            var selfClazz = entityClassificiation[facetId]
            while (selfClazz.length) {
                /* removes from selfClazz => don't do a for loop */
                moveEntry(facetId, parentNode.id(), selfClazz[selfClazz.length - 1])
            }
            delete entityClassificiation[facetId]

            rebuild()
        }

        function build(node) {
            var isRootNode = node.id() === FACET
            /* clazz = { facetId: "ID", text: ["entity text 1", ...] } */
            var entities = entityClassificiation[node.id()]
            
            var extend = el('button', ['➕'])
            extend.addEventListener('click', addSubfacet, 'false')

            var remove = isRootNode ? undefined : el('button', ['✖'])
            if (remove)
                remove.addEventListener('click', removeSubfacet, false)
            
            return el('div.subfacet', { 
                id: `subfacet-${node.id()}`,
                'data-facet': node.id()
            }, [
                el('div.header', [
                    el('span.name', [node.name()]),
                    extend, 
                    remove
                ]),
                el('div.entity-container', [
                    entities.map(entityId => {
                        return el('div', { 
                            id: `entity-${entityId}`, 
                            'data-entity': entityId 
                        }, [
                            entityDropdown(entityId, subtree, node),
                            el('span.entity', [id2Text[entityId]])
                        ])
                    }),
                ]),
                node.map(build)
            ])
        }

        function rebuild() {
            var node = el('div#'+FACET+'.facet-container',[
                el("div.modal-divider"),
                el('div.dyn-modal-header-title', [facet]),
                build(subtree),
            ])
            
            var existing = document.getElementById(FACET)
            if (existing)
                existing.parentNode.replaceChild(node, existing)
            else
                return node
        }

        var saveBtn = el('button.btn', ['save'])    
        var modal = el('div#modal.dyn-modal', [
            el('div', [
                el('div.modal-entry-type', ['inspecting entities']),
                window.modals.closeButton(),
                rebuild(),
                el('div.dyn-modal-button-wrapper',[
                    saveBtn,
                    window.modals.cancelButton()
                ])
            ])
        ])

        saveBtn.addEventListener("click", function(evt) {
            console.log('reclassification', reclassification)

            var extension = subtree.flatten().filter(facet => !extendedTaxonomy.root.dfs(facet.id))
            extension = extension.concat(extendedTaxonomy.tree().flatten())
            extension = extension.filter(facet => !serpTaxonomy.root.dfs(facet.id))

            console.log('new taxonomy extension', extension)

            var url = `${window.api.host}/v1/collection/${CID}/reclassify`
            function again() {
                if (reclassification.length > 0) {
                    var reclazz = reclassification.pop()
                    var payload = { 
                        oldFacetId: reclazz.oldFacet,
                        newFacetId: reclazz.newFacet,
                        entities: [reclazz.entity]
                    }
                    return window.api.json("POST", url, payload).then(again)
                } else {
                    return Promise.resolve()
                }
            }

            again()
                .then(() => {
                    var url = `${window.api.host}/v1/collection/${CID}/taxonomy`
                    var data = {
                        taxonomy: extension,
                        version: taxonomyExtension.version
                    }
                    return window.api.json("PUT", url, data)
                })
                .then(() => {
                    document.body.removeChild(modal)
                })
            
        });

        document.body.appendChild(modal)
        modals.appear(modal)
    }

})(window.components || (window.components = {}));