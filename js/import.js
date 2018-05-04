(function (){
  "use strict";

  window.import = {
    fromFile:importFromFile
  }

  var fileName = "";
  var entryType = "";
  var researchMustHave = [
      {value: "reference", display: "Reference"}
  ];
  var researchOptional = [
      {value: "doi", display: "DOI"}
  ];
  var challengeMustHave = [
      {value: "description", display: "Description"}
  ];
  var challengeOptional = [];
  var extraHeaders = [
      {value: "contact", display: "Contact"},
      {value: "date", display: "Date"}
  ];
  var serpSecretHeaders = researchMustHave.concat(challengeMustHave.concat(researchOptional.concat(extraHeaders)));

  var intervention = ["Intervention"];
  var interventionLeaves = [
      {value: "intervention", display: "Supply interventions"},
  ];
  var effect = ["Effect"];
  var effectLeaves = [
      {value: "solving", display: "Solve new problem"},
      {value: "adapting", display: "Adapt testing"},
      {value: "assessing", display: "Assess testing"},
      {value: "improving", display: "Improve testing"}
  ];
  var scope = ["Scope"];
  var scopeLeaves = [
      {value: "planning", display: "Test planning"},
      {value: "design", display: "Test design"},
      {value: "execution", display: "Test execution"},
      {value: "analysis", display: "Test analysis"}
  ];
  var context = ["Context"];
  var contextLeaves = [
      {value: "people", display: "People related constraints"},
      {value: "information", display: "Availability of information"},
      {value: "sut", display: "Properties of SUT"},
      {value: "other", display: "Other"}
  ];
  var serpTaxonomyLeaves = interventionLeaves.concat(effectLeaves.concat(scopeLeaves.concat(contextLeaves)));

  var serp = serpSecretHeaders.concat(serpTaxonomyLeaves);

  var delimiters = [
      {value: ',' , display: 'Comma (,)'},
      {value: ';' , display: 'Semi-Colon (;)'},
      {value: ':' , display: 'Colon (:)'},
      {value: '|' , display: 'Pipe (|)'},
      {value: '^' , display: 'Caret (^)'},
      {value: '~' , display: 'Tilde (~)'},
      {value: '\t' , display: 'Tab'},
      {value: ' ' , display: 'Space'}
  ];

  function importFromFile(pushEntry){
    $("#input_file").click();
    $("#input_file").change(function(evt){
      var inputFiles = document.getElementById("input_file");
      if ('files' in inputFiles) {
        if (inputFiles.files.length > 0) {
          for (var i = 0; i < inputFiles.files.length; i++) {
              var file = inputFiles.files[i];
              var reader = new FileReader();
              reader.onload = function(){
                var data = reader.result.substring(0,file.size);
                fileName = file.name;
                if(fileName.indexOf(".json") != -1){
                  convertJsonfileToJsonAndQueue(data, pushEntry);
                }
                else if(fileName.indexOf(".csv") != -1){
                  convertCSVfiletoJsonAndQueue(data, pushEntry);
                } else {
                  alert("File has to be in either json or CSV format");
                }
              };
              reader.readAsText(file);
          }
        }
      }
      document.getElementById("input_file").value = "";
    });
  }

  function convertJsonfileToJsonAndQueue(data, pushEntry){
    var newCollectionModal = createjsonModal();

    window.modals.optionsModal(newCollectionModal,function (newCollectionName) {
      if(newCollectionName === ""){
        $('.complaint.import').remove();
        var error = this.modal.querySelector('input');
        error.parentNode.insertBefore(
            el('div.complaint.import', ["Please supply information"]), error.nextSibling
        );
      }
      else {
        var jsons = JSON.parse(data);
        var allEntries = jsonToEntry(jsons);
        var validEntries = allEntries.validEntries;

        if(printStatistics(allEntries, "json")){
          createCollection(validEntries, newCollectionName, pushEntry, modal);
        }
      }
    })
  }

  function createjsonModal(){
    var newCollectionModal = {
            desc: "Create new collection",
            message: "",
            //message above input boxes
            input: [['input0','text','collection name']],
            //[textbox names, types, placeholder] //else put '[]'
            //automatically takes input[0] as first paramater for method passed in.. etc
            btnText: "Create"
            //text on button
    };
    return newCollectionModal;
  }

  function createCollection(validEntries, newCollectionName, pushEntry, modal){
    window.api.v1.collection.create(newCollectionName)
    .done(ok => {
      var collectionID = ok.id;
      updateDisplayedCollectionName(collectionID, newCollectionName);
      pushEntries(collectionID, validEntries, pushEntry);
      destroy(modal);
    })
    .fail(xhr => {
      flashErrorMessage(xhr.responseText);
      destroy(modal);
    })
  }

  function destroy(modal) {
    document.body.removeChild(modal)
  }

  function updateDisplayedCollectionName(collectionID, newCollectionName){
    var collection = document.getElementById("collection");
    var option = el("option", {value:collectionID, text:newCollectionName});
    $("#collection").append(option);
    collection.value = collectionID;
  }

  function pushEntries(collectionID, validEntries, pushEntry){
    for(var i = 0; i < validEntries.length; i++){
      validEntries[i].collection = collectionID;
      pushEntry(validEntries[i]);
    }
  }

  function convertCSVfiletoJsonAndQueue(csv, pushEntry){
    var lines;
    var CSVHeaders;
    var modal = createImportModal();

    closeBtn.addEventListener('click', function() {
      destroy(modal);
    }, false);
    cancelBtn.addEventListener('click', function() {
      destroy(modal);
    }, false);

    selectDelimiterCSV.addEventListener("change", function() {
      selectDelimiterCSVChange();
    });
    function selectDelimiterCSVChange(){
      var delimiterCSV = selectDelimiterCSV.value;
      lines = CSVToArray(csv, delimiterCSV);
      CSVHeaders = lines[0];
      $(".import-option").remove();
      addOptions(CSVHeaders, ".import-select");
    }

    checkResearch.addEventListener('change', (evt) => {
      checkResearchChange();
    });
    function checkResearchChange(){
      if (document.getElementById("checkResearch").checked) {
        entryType = "research";
        $(".import-all-selects-wrapper.researchMustHave").show();
        $(".import-all-selects-wrapper.researchOptional").show();
        $(".import-all-selects-wrapper.challengeMustHave").hide();
        $(".import-all-selects-wrapper.challengeOptional").hide();
        document.getElementById("checkChallenge").checked = false;
      } else {
        entryType = "nothing";
        $(".import-all-selects-wrapper.challengeMustHave").show();
        $(".import-all-selects-wrapper.challengeOptional").show();
      }
    }

    checkChallenge.addEventListener('change', (evt) => {
      checkChallengeChange();
    });
    function checkChallengeChange(){
      if (document.getElementById("checkChallenge").checked) {
        entryType = "challenge";
        $(".import-all-selects-wrapper.researchMustHave").hide();
        $(".import-all-selects-wrapper.researchOptional").hide();
        $(".import-all-selects-wrapper.challengeMustHave").show();
        $(".import-all-selects-wrapper.challengeOptional").show();
        document.getElementById("checkResearch").checked = false;
      } else {
        entryType = "nothing";
        $(".import-all-selects-wrapper.researchMustHave").show();
        $(".import-all-selects-wrapper.researchOptional").show();
      }
    }

    // Default entrytype is research and default delimiter is comma.
    document.getElementById("checkResearch").checked = true;
    // Comma should probably not be the default value.
    selectDelimiterLeaf.selectedIndex = 3;
    checkResearchChange();
    selectDelimiterCSVChange();
    $(".import-checkbox").each(function(i, el) {
      addClickableButtonEventListener($(el), CSVHeaders);
    });

    uploadBtn.addEventListener('click', (evt) => {
      clearComplaintsImport();
      var newCollectionName = document.getElementById("importCollectionName").value;
      var collectionNameValid = isCollectionNameValid(newCollectionName);
      var entryTypeValid = isEntryTypeDataValid();
      var delimitersValid = areDelimitersValid();

      if(collectionNameValid && entryTypeValid && delimitersValid){
        var jsons = createjsons(lines, CSVHeaders);
        var allEntries = jsonToEntry(jsons);
        var validEntries = allEntries.validEntries;

        if (printStatistics(allEntries, "CSV")){
            createCollection(validEntries, newCollectionName, pushEntry, modal);
        }
      } else {
        $(uploadBtn).parent().append(
          el("div.complaint.import", {text:"Incorrect input"})
        );
      }
    });
  }

  function addClickableButtonEventListener(button, CSVHeaders){
    button.click(function() {
      if(button.is(":checked")){
        var className = button.attr('class').split(" ");
        var serpType = className[className.length-1];
        var extraSelectsContainer = button.parent().parent();
        extraSelectsContainer.append(elCheckboxAndSelect(serpType));
        var newSelect = button.parent().next().find(".import-select");
        addOptions(CSVHeaders, newSelect);
        var newCheckbox = button.parent().next().find(".import-checkbox");
        addClickableButtonEventListener(newCheckbox, CSVHeaders);
      } else {
        var extraSelectsToTheRight = button.parent().nextAll();
        extraSelectsToTheRight.remove();
      }
    });
  }

  function addOptions(CSVHeaders, divClass){
    for (var i = 0; i < CSVHeaders.length; i++){
      var option = el("option.import-option", {value:CSVHeaders[i]}, [CSVHeaders[i]]);
      $(divClass).append(option);
    }
  }

  function clearComplaintsImport(){
    $(".complaint.import").remove();
  }

  function createImportModal(){
    var modal =
    el('div.modal', [
        el('div', [
            el('div.close-btn#closeBtn', ['']),
            el("h2", ["Mapping CVS columns to taxonomy"]),
            el("div", ["Filename: " + fileName]),

            el("div.modal-spacing"),
            delimiterDiv("CSV", "Select CSV delimiter"),
            el("div.modal-spacing"),
            delimiterDiv("Leaf", "Select taxonomy leaf delimiter"),

            el("div.modal-divider"),
            el("div#importCollectionWrapper", [
                el("input.modal-input-box.import#importCollectionName",
                {type:"text", placeholder:"Name of new collection"}),
            ]),

            el("h1", ["Select your mapping"]),
            el("div#importEntryTypeWrapper", [
                el("div.import-checkbox-heading", ["Entry type "]),
                el("label", ["Research "]),
                el("input#checkResearch", {type:"checkbox"}),
                el("label", ["Challenge "]),
                el("input#checkChallenge", {type:"checkbox"}),
            ]),
            el("div.modal-divider"),

            el("h3", ["General information"]),
            mapToHeaders("researchMustHave", researchMustHave),
            mapToHeaders("researchOptional", researchOptional),
            mapToHeaders("challengeMustHave", challengeMustHave),
            mapToHeaders("challengeOptional", challengeOptional),
            mapToHeaders("extraHeaders", extraHeaders),
            el("div.modal-divider"),

            el("h3", ["Taxonomy"]),
            el("label", ["Node selected..."]),
            el("div.import-taxonomy-heading", intervention),
            el("div.modal-spacing"),
            mapToHeaders("intervention", interventionLeaves),
            el("div.import-taxonomy-heading", effect),
            el("div.modal-spacing"),
            mapToHeaders("effect", effectLeaves),
            el("div.import-taxonomy-heading", scope),
            el("div.modal-spacing"),
            mapToHeaders("scope", scopeLeaves),
            el("div.import-taxonomy-heading", context),
            el("div.modal-spacing"),
            mapToHeaders("context", contextLeaves),
            el("div.modal-divider"),

            el("div", [
                el('button#uploadBtn.btn', ["Upload"]),
                el('button#cancelBtn.btn', ["Cancel"]),
            ])
        ])
    ]);
    setTimeout(() => modal.classList.add("appear"), 100)
    document.body.appendChild(modal);
    return modal;
  }

  function delimiterDiv(name, text){
    return  el("div", {id: "delimiter" + name}, [
                el("div.import-div-delimiter." + name, [
                    el("label", [text]),
                    el("select.import-select-delimiter", {id: "selectDelimiter" + name}, [
                        delimiters.map(delimiter =>
                        el('option', { value: delimiter.value }, [ delimiter.display ])),
                    ])
                ])
            ])
  }

  function mapToHeaders(serp, serpArray){
    return serpArray.map(serpItem => {
      return el("div.import-all-selects-wrapper." + serp, [
                 el("div.import-select-first-box-wrapper." + serp, [
                     el("select.import-node-selection." + serp, [
                         el("option", {value:"default"}, ["only if related free-text examples are extracted"]),
                         el("option", {value:"everything"}, ["for all entries"]),
                     ]),
                     el("label", [serpItem.display]),
                     el("div"), [],
                 ]),
                 el("div.import-extra-headings." + serp, [elCheckboxAndSelect(serp)]),
             ])
    })
  }

  function elCheckboxAndSelect(serp){
    return el("div.import-checkbox-and-select." + serp, [
               el("select.import-select." + serp, [
                   el("option", {value:"unspecified"}, ["No mapping"]),
               ]),
               el("input.import-checkbox.extra." + serp, {type:"checkbox"}),
           ])
  }

  function isCollectionNameValid(newCollectionName){
    if(newCollectionName === ""){
      document.getElementById("importCollectionWrapper").appendChild(
          el("div.complaint.import", {text:"Please supply information"})
      );
      return false;
    }
    return true;
  }

  function isEntryTypeDataValid(){
    var validEntryTypeData = true;
    if(entryType === "nothing"){
      validEntryTypeData = false;
      document.getElementById("importEntryTypeWrapper").appendChild(
          el("div.complaint.import", {text:"Please supply information"})
      );
    }
    return validEntryTypeData;
  }

  function areDelimitersValid(){
    if(selectDelimiterCSV.value !== selectDelimiterLeaf.value){
      return true;
    }
    document.getElementById("delimiterCSV").appendChild(
        el("div.complaint.import", {text:"The delimiters have to be different"})
    );
    return false;
  }

  function createjsons(lines, CSVHeaders){
    function byNodeSelection(i, el) {
      var node = el.querySelector(".import-node-selection");
      return node && node.value === "everything";
    }
    function byImportSelection(i, el) {
      var select = el.querySelector(".import-select");
      return select && select.value !== "unspecified";
    }
    var selectedNodes = $(".import-all-selects-wrapper").filter(function (i, el) {
      return byNodeSelection(i, el) || byImportSelection(i, el)
    })

    if(entryType === "research"){
      selectedNodes = selectedNodes.add(".import-all-selects-wrapper.researchMustHave");
    } else if(entryType === "challenge"){
      selectedNodes = selectedNodes.add(".import-all-selects-wrapper.challengeMustHave");
    }

    var leafDelimiter = selectDelimiterLeaf.value;
    var jsons = [];
    for(var i=1;i<lines.length;i++){
      var currentLine = lines[i];
      var jsonObj = calculateCurrentEntry(CSVHeaders, currentLine, selectedNodes, leafDelimiter);
      jsons.push(jsonObj);
    }
    return jsons;
  }

  function calculateCurrentEntry(CSVHeaders, currentLine, selectedNodes, leafDelimiter){
    var jsonObj = {};
    var serpClassification = {};
    for(var j=0;j<selectedNodes.length;j++){
      var onlySelectedInputs = $(selectedNodes[j]).
        find(".import-select").filter(function(i, el) {return el.value !== "unspecified";}).
        map((i, e) => e.value).toArray();

      var label = $(selectedNodes[j]).find("label").text();
      var currentHeader = serp.find(value => value.display === label);
      var isTaxonomyLeaf = serpTaxonomyLeaves.indexOf(currentHeader) !== -1;
      var currentValue = calculateCurrentValue(CSVHeaders, currentLine, onlySelectedInputs, isTaxonomyLeaf, leafDelimiter);
      var includeFor = $(selectedNodes[j]).find(".import-node-selection").val();

      if(isValueValid(currentValue, selectedNodes[j], includeFor)){
        var root = isTaxonomyLeaf ? serpClassification : jsonObj;
        root[currentHeader.value] = currentValue;
      }
    }
    jsonObj.serpClassification = serpClassification;
    jsonObj.entryType = entryType;
    return jsonObj;
  }

  function calculateCurrentValue(CSVHeaders, currentLine, onlySelectedInputs, isTaxonomyLeaf, leafDelimiter){
    var currentValue;
    if(onlySelectedInputs.length === 0){
      currentValue = isTaxonomyLeaf ? ["unspecified"] : "unspecified";
    } else {
      currentValue = isTaxonomyLeaf ? [] : "";
      var firstValueHasBeenAdded = false;
      for(var k=0;k<onlySelectedInputs.length;k++){
        var currentCell = currentLine[CSVHeaders.indexOf(onlySelectedInputs[k])];
        if(currentCell){
          if(isTaxonomyLeaf){
            var splitted = currentCell.split(leafDelimiter);
            splitted.forEach(function(e) {
              currentValue.push(e);
            });
          } else {
            var separator = firstValueHasBeenAdded ? ", " : "";
            currentValue = currentValue + separator + currentCell;
            firstValueHasBeenAdded = true;
          }
        }
      }
      if(!currentValue){
        currentValue = "unspecified";
      } else if(currentValue instanceof Array && currentValue.length === 0){
        currentValue = ["unspecified"];
      }
    }
    return currentValue;
  }

  function isValueValid(currentValue, currentNode, includeFor){
    if (includeFor === "everything")
      return true;

    if (currentValue !== "unspecified" && currentValue[0] !== "unspecified")
      return true;

    var classes = currentNode.classList;
    return  classes.contains("researchMustHave") ||
            classes.contains("challengeMustHave");
  }

  // Function is taken from stackoverflow,
  // which in turn is taken from the blog:
  // https://www.bennadel.com/blog/1504-ask-ben-parsing-csv-strings-with-javascript-exec-regular-expression-command.htm
  // Here, it has been modified to not include empty lines in the CSV,
  // and also fixed a bug so it does not always push an empty line at the end.
  //
  // ref: http://stackoverflow.com/a/1293163/2343
  // This will parse a delimited string into an array of
  // arrays. The default delimiter is the comma, but this
  // can be overriden in the second argument.
  function CSVToArray( strData, strDelimiter ){
      // Check to see if the delimiter is defined. If not, then default to comma.
      strDelimiter = (strDelimiter || ",");
      // Create a regular expression to parse the CSV values.
      var objPattern = new RegExp(
          (
              // Delimiters.
              "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
              // Quoted fields.
              "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
              // Standard fields.
              "([^\"\\" + strDelimiter + "\\r\\n]*))"
          ),
          "gi"
          );
      // Create an array to hold our data. Give the array a default empty first row.
      var arrData = [[]];
      // Create an array to hold our individual pattern matching groups.
      var arrMatches = null;
      // emptyRow is true until you stumble upon a cell that has a value that is not "".
      var emptyRow = true;
      // Keep looping over the regular expression matches until we can no longer find a match.
      while (arrMatches = objPattern.exec( strData )){
          // Get the delimiter that was found.
          var strMatchedDelimiter = arrMatches[ 1 ];
          // Check to see if the given delimiter has a length
          // (is not the start of string) and if it matches
          // field delimiter. If id does not, then we know
          // that this delimiter is a row delimiter.
          if (
              strMatchedDelimiter.length &&
              strMatchedDelimiter !== strDelimiter
              ){
                // If the last row was empty, remove it from the array.
                if(emptyRow){
                    arrData.pop();
                  }
                  emptyRow = true;
                  // Since we have reached a new row of data, add an empty row to our data array.
                  arrData.push( [] );
          }
          var strMatchedValue;
          // Now that we have our delimiter out of the way,
          // let's check to see which kind of value we captured (quoted or unquoted).
          if (arrMatches[ 2 ]){
              // We found a quoted value. When we capture
              // this value, unescape any double quotes.
              strMatchedValue = arrMatches[ 2 ].replace(
                  new RegExp( "\"\"", "g" ),
                  "\""
                  );
          } else {
              // We found a non-quoted value.
              strMatchedValue = arrMatches[ 3 ];

          }
          if(strMatchedValue != ""){
              emptyRow = false;
          }
          // Now that we have our value string, let's add
          // it to the data array.
          arrData[ arrData.length - 1 ].push( strMatchedValue );
      }
      // A row with just 1 empty element is sometimes added to the array.
      // If that's the case, remove it.
      if(arrData[arrData.length - 1].length != arrData[0]){
        arrData.pop();
      }
      // Return the parsed data.
      return( arrData );
  }

  function jsonToEntry(jsons){
    var allEntries = {};
    var validEntries = [];
    var invalidEntries = [];
    for(var i = 0; i < jsons.length; i++){
      var curjson = jsons[i];
      var curEntryType = curjson.entryType;
      if(!curEntryType){
        invalidEntries.push(i+1);
        continue;
      }
      else if (curEntryType === "research"){
        for(var j = 0; j < researchMustHave.length; j++){
          if(!curjson[researchMustHave[j].value]){
            invalidEntries.push(i+1);
            break;
          }
        }
        researchOptional.forEach(function(el) {
          curjson[el.value] = curjson[el.value] === undefined ? "" : curjson[el.value];
        });
        challengeMustHave.forEach(function(el) {curjson[el.value] = ""});
        challengeOptional.forEach(function(el) {curjson[el.value] = ""});
      }
      else if(curEntryType === "challenge"){
        for(var j = 0; j < challengeMustHave.length; j++){
          if(!curjson[challengeMustHave[j].value]){
            invalidEntries.push(i+1);
            break;
          }
        }
        challengeOptional.forEach(function(el) {
          curjson[el.value] = curjson[el.value] === undefined ? "" : curjson[el.value];
        });
        researchMustHave.forEach(function(el) {curjson[el.value] = ""});
        researchOptional.forEach(function(el) {curjson[el.value] = ""});
      }
      else {
        invalidEntries.push(i+1);
        continue;
      }

      curjson.date = new Date(curjson.date);
      if(curjson.date === undefined || isNaN(curjson.date.getTime())){
         curjson.date = new Date();
      }

      var curEntry = {
          entryType: curjson.entryType,
          reference: curjson.reference,
          doi: curjson.doi,
          description: curjson.description,
          contact: curjson.contact,
          date: curjson.date,
          serpClassification: curjson.serpClassification
      };
      validEntries.push(curEntry);
    }

    allEntries.validEntries = validEntries;
    allEntries.invalidEntries = invalidEntries;
    return allEntries;
  }

  function printStatistics(allEntries, fileType){
    var entriesFormat = "The entries must follow that:\n"
                      + "\"challenge\" entries must have a description.\n"
                      + "\"research\" entries must have a reference.";

    var queueQuestion = "Do you want to queue the "
                      + allEntries.validEntries.length
                      + " valid entries?";

    var notEnoughInformation = "does not have enough information to make entries.";

    var typePlural;
    var specifiedEntries;
    if(fileType === "json"){
      typePlural = " json objects ";
      specifiedEntries = "The json objects with index " + allEntries.invalidEntries.toString() + " ";
    } else if(fileType === "CSV"){
      typePlural = " rows in the CSV ";
      specifiedEntries = "The CSV rows " + allEntries.invalidEntries.toString()
        + " (counting starts after the headers row and empty rows are not counted) ";
    }

    if(allEntries.validEntries.length === 0){
      alert("0" + typePlural + "are valid.\n\n"
      + entriesFormat);
      return false;
    }
    //Could be any number but if there are too many the alert box will be difficult to read.
    else if(allEntries.invalidEntries.length > 50){
      return confirm(allEntries.invalidEntries.length
      + typePlural + notEnoughInformation + "\n\n"
      + entriesFormat + "\n\n"
      + queueQuestion);
    }else if(allEntries.invalidEntries.length > 0){
      return confirm(specifiedEntries
      + notEnoughInformation + "\n\n"
      + entriesFormat + "\n\n"
      + queueQuestion);
    } else {
      return true;
    }
  }

})();
